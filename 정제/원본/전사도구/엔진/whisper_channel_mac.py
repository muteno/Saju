# -*- coding: utf-8 -*-
"""
whisper_channel_mac.py — Apple Silicon (M-series) YouTube channel/playlist/video -> Whisper transcripts.

Primary engine: mlx-whisper (Mac GPU, fast).  Fallback: faster-whisper (CPU) if mlx is unavailable.
Usage:
  python3 whisper_channel_mac.py <URL> [--out DIR] [--model large-v3] [--lang ko|auto]
                                 [--format txt|md] [--cookies PATH] [--limit N]
Membership: put a Netscape cookies.txt in the OUTPUT folder (or --cookies). Needs Node.js.
mlx path needs ffmpeg (brew install ffmpeg). Resumable (skips existing "[<id>]" files).
"""
import os, sys, re, glob, time, json, shutil, argparse, subprocess

MLX_REPO = {
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "medium": "mlx-community/whisper-medium-mlx",
    "small":  "mlx-community/whisper-small-mlx",
    "base":   "mlx-community/whisper-base-mlx",
    "tiny":   "mlx-community/whisper-tiny-mlx",
}


def sanitize(t, fallback):
    t = t or fallback
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', t)
    t = re.sub(r'\s+', ' ', t).strip().rstrip('. ')
    return (t[:110].strip() or fallback)


def fmt_dur(s):
    s = int(s or 0); h = s // 3600; m = (s % 3600) // 60; ss = s % 60
    return ("%d:%02d:%02d" % (h, m, ss)) if h else ("%d:%02d" % (m, ss))


def find_node():
    n = shutil.which("node")
    if n:
        return n
    for p in ("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"):
        if os.path.exists(p):
            return p
    return None


def find_cookies(out_dir, explicit, script_dir):
    for c in (explicit, os.path.join(out_dir, "cookies.txt"), os.path.join(os.getcwd(), "cookies.txt"),
              os.path.join(script_dir, "cookies.txt"), os.path.join(os.path.expanduser("~"), ".whisper_cookies.txt")):
        if c and os.path.exists(c):
            return c
    return None


def channel_videos_url(url):
    if re.search(r"youtube\.com/(@[\w.\-]+|channel/[\w\-]+|c/[\w.\-]+|user/[\w.\-]+)/?$", url):
        return url.rstrip("/") + "/videos"
    return url


def enumerate_videos(url):
    import yt_dlp
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    title = info.get("title") or info.get("id") or "whisper"
    acc = []
    def collect(node):
        ents = node.get("entries")
        if ents is None:
            if node.get("id"):
                acc.append((node["id"], node.get("title") or ""))
            return
        for e in ents:
            if e:
                collect(e)
    if info.get("entries") is None:
        acc.append((info["id"], info.get("title") or ""))
    else:
        collect(info)
    seen = set(); out = []
    for vid, t in acc:
        if vid not in seen:
            seen.add(vid); out.append((vid, t))
    return title, out


def download_audio(vid, tmp_dir, cookies, node_path, retries=3):
    for c in glob.glob(os.path.join(tmp_dir, vid + ".*")):
        try: os.remove(c)
        except Exception: pass
    out_tmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")
    base = [sys.executable, "-m", "yt_dlp", "-f", "bestaudio/best",
            "--no-warnings", "--no-progress", "--write-info-json", "-o", out_tmpl]
    url = "https://www.youtube.com/watch?v=" + vid
    env = dict(os.environ)
    if node_path:
        env["PATH"] = os.path.dirname(node_path) + os.pathsep + env.get("PATH", "")
    def locate():
        infos = glob.glob(os.path.join(tmp_dir, vid + "*.info.json"))
        info = json.load(open(infos[0], encoding="utf-8")) if infos else {}
        auds = [f for f in glob.glob(os.path.join(tmp_dir, vid + ".*")) if not f.endswith(".info.json")]
        if not auds:
            raise RuntimeError("no audio produced")
        return auds[0], info
    members = (["--cookies", cookies, "--js-runtimes", "node:" + node_path,
                "--extractor-args", "youtube:ejs=npm"] if (cookies and node_path) else None)
    last = None
    for _ in range(retries):
        try:
            subprocess.run(base + [url], check=True, capture_output=True, text=True, timeout=1800, env=env)
            return locate()
        except Exception as e:
            last = e
        if members:
            try:
                subprocess.run(base + members + [url], check=True, capture_output=True, text=True, timeout=1800, env=env)
                return locate()
            except Exception as e:
                last = e
        time.sleep(5)
    raise last


class Engine:
    """mlx-whisper first (Mac GPU); faster-whisper (CPU) as fallback."""
    def __init__(self, model, lang):
        self.lang = None if lang == "auto" else lang
        self.kind = None
        try:
            import mlx_whisper
            self._mlx = mlx_whisper
            self.repo = MLX_REPO.get(model, MLX_REPO["large-v3"])
            self.kind = "mlx"
            print("engine: mlx-whisper (Mac GPU)  repo=%s" % self.repo, flush=True)
        except Exception as e:
            print("mlx-whisper unavailable (%s) -> faster-whisper fallback" % (repr(e)[:90]), flush=True)
            from faster_whisper import WhisperModel
            try:
                self._fw = WhisperModel(model, device="cuda", compute_type="int8")
                print("engine: faster-whisper cuda/int8", flush=True)
            except Exception:
                self._fw = WhisperModel(model, device="cpu", compute_type="int8")
                print("engine: faster-whisper CPU int8 (slow)", flush=True)
            self.kind = "fw"

    def transcribe(self, audio_path):
        if self.kind == "mlx":
            kw = {"path_or_hf_repo": self.repo}
            if self.lang:
                kw["language"] = self.lang
            res = self._mlx.transcribe(audio_path, **kw)
            return (res.get("text") or "").strip(), (res.get("language") or self.lang)
        segs, info = self._fw.transcribe(audio_path, language=self.lang, vad_filter=True, beam_size=5)
        return "\n".join(s.text.strip() for s in segs).strip(), getattr(info, "language", self.lang)


def build_md_header(info, vid, det_lang):
    ud = info.get("upload_date") or ""
    ud = ("%s-%s-%s" % (ud[0:4], ud[4:6], ud[6:8])) if len(ud) == 8 else "?"
    return ("# %s\n\n- **Upload:** %s\n- **Length:** %s\n- **Views:** %s\n"
            "- **URL:** https://www.youtube.com/watch?v=%s\n"
            "- **Transcript:** local Whisper large-v3 (auto, unreviewed) · lang=%s\n\n---\n\n"
            % (info.get("title") or vid, ud, fmt_dur(info.get("duration")),
               info.get("view_count") or "?", vid, det_lang or "?"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--out", default=None)
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--lang", default="auto")
    ap.add_argument("--format", default="txt", choices=["txt", "md"])
    ap.add_argument("--cookies", default=None)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    script_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        import yt_dlp  # noqa
    except Exception:
        print("MISSING_DEPS: pip3 install -U yt-dlp yt-dlp-ejs mlx-whisper  (and: brew install ffmpeg)", flush=True)
        sys.exit(2)

    title, vids = enumerate_videos(channel_videos_url(a.url))
    if a.limit > 0:
        vids = vids[:a.limit]
    out = a.out or os.path.join(os.getcwd(), sanitize(title, "whisper") + "_자막")
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, "_audio_tmp"); os.makedirs(tmp, exist_ok=True)
    logpath = os.path.join(out, "_whisper.log")

    def log(m):
        line = time.strftime("%H:%M:%S ") + m
        try: print(line, flush=True)
        except Exception: pass
        with open(logpath, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    cookies = find_cookies(out, a.cookies, script_dir)
    node_path = find_node()
    ext = a.format
    log("=== WHISPER(mac): %s ===" % title)
    log("videos=%d  out=%s  format=%s" % (len(vids), out, ext))
    log("cookies=%s  node=%s  -> membership support: %s"
        % (bool(cookies), bool(node_path), "ON" if (cookies and node_path) else "OFF"))
    if not cookies:
        log("NOTE: for membership videos, drop a YouTube cookies.txt (Netscape) into: %s" % out)

    done = set()
    for f in glob.glob(os.path.join(out, "*." + ext)):
        m = re.search(r'\[([A-Za-z0-9_\-]{11})\]\.' + ext + r'$', os.path.basename(f))
        if m: done.add(m.group(1))
    log("already done (resume): %d" % len(done))

    eng = Engine(a.model, a.lang)

    t0 = time.time(); ok = len(done); fail = 0; proc = 0; TOTAL = len(vids)
    for idx, (vid, vtitle) in enumerate(vids, 1):
        if vid in done:
            continue
        ts = time.time()
        try:
            audio, info = download_audio(vid, tmp, cookies, node_path)
            text, det = eng.transcribe(audio)
            name = sanitize(info.get("title") or vtitle, vid)
            fpath = os.path.join(out, "%03d - %s [%s].%s" % (idx, name, vid, ext))
            with open(fpath, "w", encoding="utf-8") as f:
                if ext == "md":
                    f.write(build_md_header(info, vid, det))
                f.write(text + "\n")
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
            ok += 1; proc += 1; dt = time.time() - ts
            avg = (time.time() - t0) / max(proc, 1); left = (TOTAL - idx) * avg / 3600.0
            log("[%d/%d] OK %-34.34s %5.0fs | ok=%d fail=%d ~%.1fh left" % (idx, TOTAL, name, dt, ok, fail, left))
        except Exception as e:
            fail += 1; proc += 1
            log("[%d/%d] FAIL %s : %s" % (idx, TOTAL, vid, repr(e)[:150]))
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
    log("=== DONE ok=%d fail=%d elapsed=%.1fh ===" % (ok, fail, (time.time() - t0) / 3600.0))


if __name__ == "__main__":
    main()
