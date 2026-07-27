# -*- coding: utf-8 -*-
"""
saju_resume_mac.py — 도화도레 사주 폴더를 mlx-whisper(맥 M5 GPU)로 '이어서' 전사.
  · 완료(Whisper)된 .md는 건너뜀 · 옛 자동자막/멤버십 .md를 '그 자리에' Whisper 대본으로 덮어씀.
  · 공개 영상 먼저 → 그다음 멤버십(홍염 프리미엄은 그 티어 쿠키 없으면 실패=정상).
사용법:
  python3 saju_resume_mac.py "<사주 폴더 경로>" [--cookies PATH] [--model large-v3] [--limit N]
멤버십: 폴더 또는 그 상위에 youtube_cookies.txt(또는 cookies.txt) 있으면 자동 사용(Node 필요).
"""
import os, sys, re, glob, time, json, subprocess, argparse

MLX_REPO = {
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "medium":   "mlx-community/whisper-medium-mlx",
    "small":    "mlx-community/whisper-small-mlx",
}
DISCLAIMER = ("> ⚠️ **자동 음성전사(Whisper) 결과입니다.** 이 문서는 오디오를 기계 전사한 것으로, "
    "문장부호·사주 전문용어에 오류가 있을 수 있으며 사람이 검수하지 않았습니다. 오락용 사주 의견이므로 "
    "사실·조언으로 받아들이지 마시고, 정확한 내용은 원본 영상을 확인하세요.")


def fmt_dur(s):
    s = int(s or 0); h = s // 3600; m = (s % 3600) // 60; ss = s % 60
    return ("%d:%02d:%02d" % (h, m, ss)) if h else ("%d:%02d" % (m, ss))


def find_node():
    import shutil
    n = shutil.which("node")
    if n: return n
    for p in ("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"):
        if os.path.exists(p): return p
    return None


def find_cookies(folder, explicit):
    up = os.path.dirname(folder.rstrip("/\\"))
    for c in (explicit,
              os.path.join(folder, "youtube_cookies.txt"), os.path.join(folder, "cookies.txt"),
              os.path.join(up, "youtube_cookies.txt"), os.path.join(up, "cookies.txt")):
        if c and os.path.exists(c): return c
    return None


class Engine:
    def __init__(self, model, lang):
        self.lang = None if lang == "auto" else lang
        try:
            import mlx_whisper
            self._mlx = mlx_whisper
            self.repo = MLX_REPO.get(model, MLX_REPO["large-v3"])
            self.kind = "mlx"
            print("engine: mlx-whisper (Mac GPU)  repo=%s" % self.repo, flush=True)
        except Exception as e:
            print("mlx-whisper unavailable (%s) -> faster-whisper" % (repr(e)[:80]), flush=True)
            from faster_whisper import WhisperModel
            try: self._fw = WhisperModel(model, device="cuda", compute_type="int8")
            except Exception: self._fw = WhisperModel(model, device="cpu", compute_type="int8")
            self.kind = "fw"

    def transcribe(self, audio):
        if self.kind == "mlx":
            kw = {"path_or_hf_repo": self.repo}
            if self.lang: kw["language"] = self.lang
            return (self._mlx.transcribe(audio, **kw).get("text") or "").strip()
        segs, _ = self._fw.transcribe(audio, language=self.lang, vad_filter=True, beam_size=5)
        return "\n".join(s.text.strip() for s in segs).strip()


def download_audio(vid, tmp, cookies, node, members):
    for c in glob.glob(os.path.join(tmp, vid + ".*")):
        try: os.remove(c)
        except Exception: pass
    tmpl = os.path.join(tmp, "%(id)s.%(ext)s")
    cmd = [sys.executable, "-m", "yt_dlp", "-f", "bestaudio/best", "--no-warnings",
           "--no-progress", "--write-info-json", "-o", tmpl]
    if members and cookies and node:
        cmd += ["--cookies", cookies, "--js-runtimes", "node:" + node, "--extractor-args", "youtube:ejs=npm"]
    cmd += ["https://www.youtube.com/watch?v=" + vid]
    env = dict(os.environ)
    if node: env["PATH"] = os.path.dirname(node) + os.pathsep + env.get("PATH", "")
    subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=1800, env=env)
    infos = glob.glob(os.path.join(tmp, vid + "*.info.json"))
    info = json.load(open(infos[0], encoding="utf-8")) if infos else {}
    auds = [f for f in glob.glob(os.path.join(tmp, vid + ".*")) if not f.endswith(".info.json")]
    if not auds: raise RuntimeError("no audio")
    return auds[0], info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--cookies", default=None)
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    FOLDER = a.folder
    if not os.path.isdir(FOLDER):
        print("폴더 없음:", FOLDER); sys.exit(2)
    tmp = os.path.join(FOLDER, "_audio_tmp"); os.makedirs(tmp, exist_ok=True)
    LOG = os.path.join(FOLDER, "_whisper_mac.log")
    def log(m):
        line = time.strftime("%H:%M:%S ") + m
        try: print(line, flush=True)
        except Exception: pass
        open(LOG, "a", encoding="utf-8").write(line + "\n")

    cookies = find_cookies(FOLDER, a.cookies)
    node = find_node()

    # 분류: 공개 먼저, 멤버십 나중 (완료=건너뜀)
    pub, mem, skip = [], [], 0
    for fp in glob.glob(os.path.join(FOLDER, "*.md")):
        m = re.search(r'_([A-Za-z0-9_-]{11})\.md$', os.path.basename(fp))
        if not m: continue
        vid = m.group(1)
        head = open(fp, encoding="utf-8", errors="ignore").read(1600)
        if "Whisper" in head: skip += 1; continue
        cap = next((l for l in head.splitlines() if "**자막:**" in l), "")
        (mem if "멤버십" in cap else pub).append((vid, fp))
    work = pub + mem
    if a.limit > 0: work = work[:a.limit]
    log("=== SAJU RESUME (mac) ===")
    log("완료(건너뜀)=%d  남은 공개=%d  남은 멤버십=%d  이번 처리=%d" % (skip, len(pub), len(mem), len(work)))
    log("cookies=%s  node=%s  (멤버십 시도 가능: %s)" % (bool(cookies), bool(node), bool(cookies and node)))

    eng = Engine(a.model, a.lang)
    t0 = time.time(); ok = 0; fail = 0; TOTAL = len(work)
    memset = set(v for v, _ in mem)
    for i, (vid, fp) in enumerate(work, 1):
        if "Whisper" in open(fp, encoding="utf-8", errors="ignore").read(1600):
            ok += 1; continue
        is_mem = vid in memset
        ts = time.time()
        try:
            audio, info = download_audio(vid, tmp, cookies, node, is_mem)
            text = eng.transcribe(audio)
            title = info.get("title") or vid
            ud = info.get("upload_date") or ""
            ud = ("%s-%s-%s" % (ud[0:4], ud[4:6], ud[6:8])) if len(ud) == 8 else "?"
            memtag = "  ·  🔒 멤버십 전용" if is_mem else ""
            head = ("# %s\n\n- **업로드:** %s\n- **길이:** %s\n- **조회수:** %s\n"
                    "- **URL:** https://www.youtube.com/watch?v=%s\n- **채널:** 도화도레 사주 (@dohwadore_saju)\n"
                    "- **자막:** 한국어 (⚙️ 로컬 Whisper ASR · large-v3 · 자동전사 · 미검수)%s\n\n%s\n\n---\n\n"
                    % (title, ud, fmt_dur(info.get("duration")), info.get("view_count") or "?", vid, memtag, DISCLAIMER))
            open(fp, "w", encoding="utf-8").write(head + text + "\n")
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
            ok += 1; dt = time.time() - ts
            avg = (time.time() - t0) / max(ok + fail, 1); left = (TOTAL - i) * avg / 3600.0
            log("[%d/%d %s] OK %-34.34s %5.0fs | ok=%d fail=%d ~%.1fh" % (i, TOTAL, "M" if is_mem else "P", title, dt, ok, fail, left))
        except Exception as e:
            fail += 1
            msg = repr(e)[:120]
            gate = "멤버십 티어" if "members on level" in msg else msg
            log("[%d/%d %s] FAIL %s : %s" % (i, TOTAL, "M" if is_mem else "P", vid, gate))
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
    log("=== DONE ok=%d fail=%d elapsed=%.1fh ===" % (ok, fail, (time.time() - t0) / 3600.0))


if __name__ == "__main__":
    main()
