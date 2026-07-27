# -*- coding: utf-8 -*-
"""
whisper_channel_generic.py — 유튜브 채널/재생목록/단일영상 → Whisper large-v3 전사 (맥 M5 범용판)

도화도레 사주 작업(2026-07-19~20)에서 실측 검증된 스택을 채널 무관하게 쓰도록 승격한 엔진.
검증된 장치 전부 내장:
  · 2스트림 샤딩(--shard, LPT 길이 균등분배)      — 실측 7.85배속(전사만)·실효 5~6배속
  · 재개 판정 = "파일 존재+머리말에 Whisper"       — 중단돼도 재실행이면 이어감, 이중작업 없음
  · 원자적 쓰기(.tmp→rename)                       — 반쪽 파일이 완료로 보이는 사고 차단
  · UTF-8+BOM+CRLF + NFC 파일명                    — 윈도우·안드로이드·iOS 전부 한글 안 깨짐
  · condition_on_previous_text=False               — 무음/BGM 디코드 루프 차단(39연속→2 실측)
  · 저용량 오디오 우선(abr<=70)                    — Whisper는 16kHz라 품질 무손실, 다운로드 2~3배 절감
  · 오디오 임시파일은 로컬(~/.cache)               — 클라우드 동기화 폭주 방지
  · 멤버십 폴백(쿠키 ~/.whisper_cookies.txt + Node) — 공개는 쿠키 없이(빠르고 안전), 실패 시에만

사용:
  python whisper_channel_generic.py <URL> [--out DIR] [--lang ko] [--limit N]
                                    [--shard N/M] [--only ID,ID] [--dry] [--prompt "용어집"]
  (실행은 반드시 PATH 에 venv/bin 이 앞서게 — 번들 ffmpeg 때문. 런처가 처리함)
"""
import os, re, sys, glob, json, time, shutil, argparse, subprocess, unicodedata

MLX_REPO = "mlx-community/whisper-large-v3-mlx"
BASE_OUT = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅"
WARN = ("> ⚠️ **자동 음성전사(Whisper) 결과입니다.** 오디오를 기계 전사한 것으로, 문장부호·고유명사에 "
        "오류가 있을 수 있으며 사람이 검수하지 않았습니다. 정확한 내용은 원본 영상을 확인하세요.")
ID_RE = re.compile(r'_([A-Za-z0-9_\-]{11})\.md$')


def sanitize(t, fallback):
    t = t or fallback
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', t)
    t = re.sub(r'\s+', ' ', t).strip().rstrip('. ')
    return unicodedata.normalize("NFC", (t[:110].strip() or fallback))


def fmt_dur(s):
    s = int(s or 0); h = s // 3600; m = (s % 3600) // 60; ss = s % 60
    return ("%d:%02d:%02d" % (h, m, ss)) if h else ("%d:%02d" % (m, ss))


def channel_videos_url(url):
    if re.search(r"youtube\.com/(@[\w.\-]+|channel/[\w\-]+|c/[\w.\-]+|user/[\w.\-]+)/?$", url):
        return url.rstrip("/") + "/videos"
    return url


def enumerate_videos(url):
    """(채널제목, [(id, 제목, 길이초)]) — extract_flat 이라 빠름. 길이는 있으면 채움(LPT용)."""
    import yt_dlp
    # youtube:lang=ko — 유튜브가 자동번역 제목(영문 등)을 주는 것 방지, 원제(한국어) 고정
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": True,
                           "skip_download": True,
                           "extractor_args": {"youtube": {"lang": ["ko"]}}}) as ydl:
        info = ydl.extract_info(channel_videos_url(url), download=False)
    title = info.get("channel") or info.get("uploader") or info.get("title") or "whisper"
    acc = []
    def collect(node):
        ents = node.get("entries")
        if ents is None:
            if node.get("id"):
                acc.append((node["id"], node.get("title") or "", node.get("duration") or 0))
            return
        for e in ents:
            if e:
                collect(e)
    if info.get("entries") is None:
        acc.append((info["id"], info.get("title") or "", info.get("duration") or 0))
    else:
        collect(info)
    seen = set(); out = []
    for vid, t, d in acc:
        if vid not in seen:
            seen.add(vid); out.append((vid, t, d))
    return title, out


COOKIE_DIR = os.path.expanduser("~/.whisper_cookies")   # 계정별 쿠키 보관함(로컬 전용)
NO_COOKIES = False                                       # --no-cookies 로 켜지는 공개 전용 모드


def find_cookies(account=None):
    """계정별 쿠키 탐색. ~/.whisper_cookies/<계정>.txt 우선, 없으면 폴더의 최신 .txt, 마지막으로 구형 단일 파일.
    공개 전용 모드(--no-cookies)면 아예 안 쓴다 — 멤버십 채널에서 쿠키를 헛되이 태워
    유튜브가 세션을 무효화하는 사고를 막는다(7/20 실측)."""
    if NO_COOKIES:
        return None
    if account:
        p = os.path.join(COOKIE_DIR, account + ".txt")
        return p if os.path.exists(p) else None
    if os.path.isdir(COOKIE_DIR):
        cands = sorted(glob.glob(os.path.join(COOKIE_DIR, "*.txt")),
                       key=os.path.getmtime, reverse=True)
        if cands:
            return cands[0]
    c = os.path.expanduser("~/.whisper_cookies.txt")
    return c if os.path.exists(c) else None


def find_node():
    n = shutil.which("node")
    if n:
        return n
    for p in (os.path.expanduser("~/.local/bin/node"), "/opt/homebrew/bin/node", "/usr/local/bin/node"):
        if os.path.exists(p):
            return p
    return None


def probe_access(vid, account=None):
    """이 영상을 지금 받을 수 있나? → ("공개"|"멤버십"|"불가", 길이초)  ※다운로드 안 함(빠름)."""
    base = [sys.executable, "-m", "yt_dlp", "--no-warnings", "--skip-download",
            "--extractor-args", "youtube:lang=ko", "--print", "%(duration)s",
            "https://www.youtube.com/watch?v=" + vid]
    try:
        r = subprocess.run(base, capture_output=True, text=True, timeout=90)
        if r.returncode == 0 and r.stdout.strip():
            return "공개", int(float(r.stdout.strip().splitlines()[-1] or 0))
        err = r.stderr or ""
    except Exception:
        err = ""
    if "members on level" in err or "회원에게 제공" in err:
        return "멤버십", 0
    return "불가", 0


def scan_access(vids, workers=8):
    """공개/멤버십/불가 사전 집계 — 전사 시작 전에 '멤버십 몇 개'를 알려주기 위함."""
    from concurrent.futures import ThreadPoolExecutor
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(probe_access, v): v for v, _, _ in vids}
        for f in futs:
            try:
                out[futs[f]] = f.result()
            except Exception:
                out[futs[f]] = ("불가", 0)
    return out


def download_audio(vid, tmp_dir, retries=3, account=None):
    for c in glob.glob(os.path.join(tmp_dir, vid + ".*")):
        try: os.remove(c)
        except Exception: pass
    # 저용량 우선: whisper 는 어차피 16kHz 로 듣는다 → 고음질 다운로드는 순수 낭비 (평의회 확정)
    base = [sys.executable, "-m", "yt_dlp", "-f", "bestaudio[abr<=70]/bestaudio/best",
            "--no-warnings", "--no-progress", "--write-info-json", "--sleep-requests", "1.5",
            "--extractor-args", "youtube:lang=ko",     # 파일명·헤더 제목을 원제(한국어)로 고정
            "-o", os.path.join(tmp_dir, "%(id)s.%(ext)s")]
    url = "https://www.youtube.com/watch?v=" + vid
    cookies, node = find_cookies(account), find_node()
    members = (["--cookies", cookies, "--js-runtimes", "node:" + node,
                "--extractor-args", "youtube:ejs=npm"] if (cookies and node) else None)

    def why(e):
        """yt-dlp stderr 를 사람이 읽는 사유로 (기존엔 CalledProcessError 만 남아 진단 불가였음)."""
        s = (getattr(e, "stderr", "") or "")[-400:]
        if "members on level" in s or "회원에게 제공" in s:
            m = re.search(r"level: ([^:]+)", s)
            return "MEMBERSHIP_BLOCKED(%s)" % (m.group(1).strip() if m else "티어부족/쿠키만료")
        if "Sign in to confirm" in s or "not a bot" in s:
            return "BOT_CHECK"
        if "Private video" in s: return "PRIVATE"
        if "unavailable" in s or "removed" in s: return "UNAVAILABLE"
        return (s.strip().splitlines() or [repr(e)[:90]])[-1][:110]

    last = None
    for attempt in range(retries):
        try:
            subprocess.run(base + [url], check=True, capture_output=True, text=True, timeout=1800)
            last = None
        except Exception as e:
            last = e
            if members:
                try:
                    subprocess.run(base + members + [url], check=True, capture_output=True,
                                   text=True, timeout=1800)
                    last = None
                except Exception as e2:
                    last = e2
            # 멤버십/권한 차단은 재시도해도 절대 안 풀린다 → 즉시 포기(시간·API 낭비 방지)
            if last is not None:
                w = why(last)
                if w.startswith(("MEMBERSHIP_BLOCKED", "PRIVATE", "UNAVAILABLE")):
                    raise RuntimeError(w)
        if last is None:
            auds = [f for f in glob.glob(os.path.join(tmp_dir, vid + ".*"))
                    if not f.endswith(".info.json")]
            if auds:
                return auds[0]
            last = RuntimeError("no audio produced")
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(why(last)) if not isinstance(last, RuntimeError) else last


def load_info(vid, tmp_dir):
    for c in glob.glob(os.path.join(tmp_dir, vid + "*.info.json")):
        try:
            return json.load(open(c, encoding="utf-8"))
        except Exception:
            pass
    return {}


LANG_KO = {"ko": "한국어", "en": "영어", "ja": "일본어", "zh": "중국어"}


def build_doc(info, vid, channel_label, text, lang="ko"):
    ud = info.get("upload_date") or ""
    ud_h = ("%s-%s-%s" % (ud[0:4], ud[4:6], ud[6:8])) if len(ud) == 8 else "?"
    return ("# %s\n\n"
            "- **업로드:** %s\n"
            "- **길이:** %s\n"
            "- **조회수:** %s\n"
            "- **URL:** https://www.youtube.com/watch?v=%s\n"
            "- **채널:** %s\n"
            "- **자막:** %s (⚙️ 로컬 Whisper ASR · large-v3 · 자동전사 · 미검수)\n\n"
            "%s\n\n---\n\n%s\n"
            % (info.get("title") or vid, ud_h, fmt_dur(info.get("duration")),
               info.get("view_count") or "?", vid, channel_label,
               LANG_KO.get(lang, lang), WARN, text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--out", default=None)
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--shard", default="1/1")
    ap.add_argument("--only", default=None)
    ap.add_argument("--prompt", default=None, help="채널 용어집 (고유명사 정확도 향상)")
    ap.add_argument("--dry", action="store_true", help="열거만 하고 종료 (개수/제목 확인용)")
    ap.add_argument("--scan", action="store_true", help="--dry 와 함께: 공개/멤버십 개수를 미리 집계")
    ap.add_argument("--no-cookies", action="store_true",
                    help="공개 영상만. 멤버십은 건너뜀 — 쿠키를 아예 안 써서 세션이 안 죽는다")
    ap.add_argument("--account", default=None, help="~/.whisper_cookies/<계정>.txt 지정")
    a = ap.parse_args()
    global NO_COOKIES
    NO_COOKIES = a.no_cookies

    title, vids = enumerate_videos(a.url)
    out = a.out or os.path.join(BASE_OUT, sanitize(title, "whisper") + "_자막")
    os.makedirs(out, exist_ok=True)

    # 재개: 폴더에 _ID.md 가 있고 머리말에 Whisper 면 완료로 간주
    done = set()
    for f in os.listdir(out):
        m = ID_RE.search(f)
        if not m:
            continue
        try:
            head = open(os.path.join(out, f), encoding="utf-8-sig", errors="replace").read(900)
        except Exception:
            head = ""
        if "Whisper" in head:
            done.add(m.group(1))

    todo = [(v, t, d) for v, t, d in vids if v not in done]
    if a.limit > 0:
        todo = todo[:a.limit]

    if a.dry:
        pub_n = mem_n = na_n = 0; pub_h = 0.0
        if a.scan and todo:
            acc = scan_access(todo)
            for v, _, d in todo:
                st, dur = acc.get(v, ("불가", 0))
                if st == "공개":   pub_n += 1; pub_h += (dur or d or 0) / 3600.0
                elif st == "멤버십": mem_n += 1
                else:              na_n += 1
        print("CHANNEL\t%s" % title)
        print("TOTAL\t%d" % len(vids))
        print("DONE\t%d" % len(done))
        print("TODO\t%d" % len(todo))
        print("HOURS\t%.1f" % (pub_h if a.scan else sum(d for _, _, d in todo) / 3600.0))
        print("OUT\t%s" % out)
        if a.scan:
            print("PUBLIC\t%d" % pub_n)
            print("MEMBER\t%d" % mem_n)
            print("NA\t%d" % na_n)
        for v, t, d in todo[:5]:
            print("  %s %5.1f분 %s" % (v, (d or 0) / 60, t[:52]))
        return

    sn, sm = (int(x) for x in a.shard.split("/"))
    if a.only:
        want = [x.strip() for x in a.only.split(",") if x.strip()]
        by = {v: (v, t, d) for v, t, d in vids}
        todo = [by.get(w, (w, "", 0)) for w in want]      # 완료여부 무시 = 강제 재전사
        sm = 1
    elif sm > 1:
        bins = [[] for _ in range(sm)]; load = [0.0] * sm
        order = {v: i for i, (v, _, _) in enumerate(todo)}
        for item in sorted(todo, key=lambda x: -(x[2] or 0)):
            k = load.index(min(load)); bins[k].append(item); load[k] += (item[2] or 600)
        todo = sorted(bins[sn - 1], key=lambda x: order[x[0]])

    tmp = os.path.expanduser("~/.cache/whisper_generic_tmp"); os.makedirs(tmp, exist_ok=True)
    logpath = os.path.join(out, "_whisper_mac.log")
    tag = "" if sm == 1 else "[%d/%d] " % (sn, sm)

    def log(m):
        line = time.strftime("%m-%d %H:%M:%S ") + tag + m
        print(line, flush=True)
        with open(logpath, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    log("=== WHISPER(generic/mlx large-v3): %s ===" % title)
    log("대상 %d개 | 이미 완료 %d개 | 이 스트림 처리 %d개" % (len(vids), len(done), len(todo)))
    log("총 오디오 %.1f시간 (이 스트림)" % (sum((d or 0) for _, _, d in todo) / 3600.0))

    import mlx_whisper
    log("engine: mlx-whisper (Mac GPU)  repo=%s  lang=%s" % (MLX_REPO, a.lang))
    channel_label = title

    t0 = time.time(); ok = 0; fail = 0; audio_done = 0.0
    total_audio = sum((d or 0) for _, _, d in todo)
    for i, (vid, vtitle, vdur) in enumerate(todo, 1):
        ts = time.time()
        try:
            audio = download_audio(vid, tmp, account=a.account)
            info = load_info(vid, tmp)
            kw = {"path_or_hf_repo": MLX_REPO, "language": a.lang,
                  "condition_on_previous_text": False}
            if a.prompt:
                kw["initial_prompt"] = a.prompt
            res = mlx_whisper.transcribe(audio, **kw)
            segs = res.get("segments") or []
            text = "\n".join(s["text"].strip() for s in segs if s.get("text", "").strip())
            if not text.strip():
                raise RuntimeError("empty transcript")

            ud = info.get("upload_date") or "00000000"
            existing = [f for f in os.listdir(out) if f.endswith("_%s.md" % vid)]
            path = os.path.join(out, existing[0] if existing else
                                "%s_%s_%s.md" % (ud, sanitize(info.get("title") or vtitle, vid), vid))
            tmpf = path + ".tmp"
            with open(tmpf, "w", encoding="utf-8-sig", newline="\r\n") as f:
                f.write(build_doc(info, vid, channel_label, text, a.lang))
            os.replace(tmpf, path)

            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass

            dur = vdur or info.get("duration") or 0
            audio_done += dur; ok += 1
            dt = time.time() - ts
            rate = audio_done / max(time.time() - t0, 1)
            left = max(total_audio - audio_done, 0) / max(rate, 0.01) / 3600
            log("[%d/%d] OK %-30.30s %5.0fs (%4.1fx) | ok=%d fail=%d | 남은 %.1fh"
                % (i, len(todo), (info.get("title") or vtitle or vid), dt,
                   (dur / dt if dt else 0), ok, fail, left))
        except Exception as e:
            fail += 1
            log("[%d/%d] FAIL %s : %s" % (i, len(todo), vid, repr(e)[:160]))
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
    log("=== DONE ok=%d fail=%d elapsed=%.2fh ===" % (ok, fail, (time.time() - t0) / 3600.0))


if __name__ == "__main__":
    main()
