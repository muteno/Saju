# -*- coding: utf-8 -*-
r"""빠른 수집기 — 채널/재생목록/링크 → ko 자막 병렬 수집 + master 갱신.

기존 fetch_missing.py(순차 1건씩) 대비:
  · 채널/재생목록 URL 하나로 전체 영상 ID 자동 확장(--flat-playlist, 스크롤 불필요)
  · 병렬 N워커(기본 5)로 동시 수집 → 수배 빠름
  · info.json 자동 축소(스토리보드 등 제거, 16MB→수KB) 저장 절약
  · master.json all_ids 자동 갱신 → 이후 make_units/build_book 이 새 영상까지 포함

사용:
  python fetch_fast.py "https://www.youtube.com/@핸들/videos"     # 채널 전체
  python fetch_fast.py "https://www.youtube.com/playlist?list=PL..."  # 재생목록
  python fetch_fast.py links.txt                                   # 링크/ID 목록 파일
  python fetch_fast.py VIDEOID1 https://youtu.be/VIDEOID2 ...       # 개별
옵션: 환경변수 WORKERS (기본 5, 차단되면 3으로 낮추기)
"""
import subprocess, sys, json, re, os, concurrent.futures as cf
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
WORKERS = int(os.environ.get("WORKERS", "5"))
KEEP = ("id", "title", "channel", "uploader", "upload_date", "duration_string",
        "duration", "view_count", "webpage_url", "categories")
IDRX = re.compile(r'^[A-Za-z0-9_-]{11}$')
VIDRX = re.compile(r'(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})')


def expand(arg):
    """채널/재생목록/링크/ID/파일 → video id 리스트."""
    p = Path(arg)
    if p.exists() and p.is_file():
        out = []
        for line in p.read_text(encoding="utf-8").split():
            out += expand(line)
        return out
    a = arg.strip()
    is_list = ("/@" in a or "/channel/" in a or "list=" in a or "/playlist" in a
               or a.endswith(("/videos", "/streams", "/shorts", "/featured")))
    if is_list:
        r = subprocess.run(["yt-dlp", "--flat-playlist", "--print", "id", a],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        return [x.strip() for x in r.stdout.splitlines() if len(x.strip()) == 11]
    m = VIDRX.search(a)
    if m:
        return [m.group(1)]
    return [a] if IDRX.match(a) else []


def has_ko(vid):
    return any((RAW / f"{vid}.{s}.json3").exists() for s in ("ko", "ko-orig", "ko-KR"))


def shrink_info(vid):
    p = RAW / f"{vid}.info.json"
    if p.exists() and p.stat().st_size > 40000:
        try:
            d = json.load(open(p, encoding="utf-8"))
            json.dump({k: d.get(k) for k in KEEP}, open(p, "w", encoding="utf-8"),
                      ensure_ascii=False)
        except Exception:
            pass


def fetch(vid):
    if has_ko(vid):
        return (vid, "skip")
    cmd = ["yt-dlp", "--skip-download", "--write-info-json", "--write-subs",
           "--write-auto-subs", "--sub-langs", "ko,ko-orig,ko-KR", "--sub-format", "json3",
           "--retries", "3", "--socket-timeout", "20", "--no-warnings", "--ignore-errors",
           "-o", "raw/%(id)s.%(ext)s", f"https://www.youtube.com/watch?v={vid}"]
    try:
        subprocess.run(cmd, cwd=str(HERE), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=120)
    except subprocess.TimeoutExpired:
        return (vid, "timeout")
    shrink_info(vid)
    return (vid, "ok" if has_ko(vid) else "no-ko")


def main():
    args = sys.argv[1:]
    if not args:
        print("사용: python fetch_fast.py <채널/재생목록/링크/ID 또는 links.txt>")
        return
    ids = []
    for a in args:
        ids += expand(a)
    seen = set()
    ids = [i for i in ids if not (i in seen or seen.add(i))]
    todo = [i for i in ids if not has_ko(i)]
    print(f"대상 {len(ids)}개 · 신규 {len(todo)}개 · 기존 {len(ids) - len(todo)}개 스킵 · 병렬 {WORKERS}")

    ok = 0
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for n, (vid, st) in enumerate(ex.map(fetch, todo), 1):
            ok += (st == "ok")
            print(f"[{n}/{len(todo)}] {st:6} {vid}", flush=True)

    mp = HERE / "master.json"
    if mp.exists() and ids:
        m = json.load(open(mp, encoding="utf-8"))
        cur = set(m.get("all_ids", []))
        new = [i for i in ids if i not in cur]
        if new:
            m["all_ids"] = m.get("all_ids", []) + new
            json.dump(m, open(mp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"master.all_ids += {len(new)}개 (총 {len(m['all_ids'])})")
    print(f"완료: ko 자막 신규 {ok}/{len(todo)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
