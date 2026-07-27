# -*- coding: utf-8 -*-
"""
whisper_saju_mac.py — 도화도레 사주 폴더 전용 전사 엔진 (맥 M5 / mlx-whisper large-v3)

whisper_channel_mac.py(§B 원문)를 이 폴더의 기존 규칙에 맞춘 변형본.
원문을 고치지 않고 별도 파일로 두는 이유 = §B 원문은 diff=0 으로 보존해야 하므로.

§B 원문과 다른 점 (전부 "기존 데이터셋을 깨지 않기 위해" 필요한 것):
  1) 파일명   : 'NNN - 제목 [ID].md'  ->  'YYYYMMDD_제목_ID.md' (이 폴더 규칙)
  2) 재개 판정: 파일 존재 여부 X  ->  헤더가 'Whisper' 인지 O
     (이 폴더는 259개 .md 가 이미 전부 존재하되 내용이 YouTube 자동자막이라,
      존재 여부로 판정하면 전부 건너뛰어 아무것도 안 한다)
  3) 덮어쓰기 : 새 파일 생성 X  ->  해당 영상ID의 기존 파일 경로를 그대로 덮어씀
     (index.md / dashboard.html / categories.tsv 의 링크를 보존)
  4) 헤더     : 영문 헤더 -> 이 폴더의 한국어 헤더 + 미검수 경고문 (기존 완료본과 동일)
  5) 본문     : mlx 의 통짜 text X  ->  segments 를 줄바꿈으로 이어붙임 (기존 완료본과 동일)
  6) 원자적 쓰기: .tmp 에 쓴 뒤 rename — 도중에 죽어도 반쪽 파일이 '완료'로 보이지 않게

사용:
  run_saju.sh --limit 3 --preview <검수용폴더>   # 미리보기(실폴더 안 건드림)
  run_saju.sh                                    # 실제 실행(전체)
"""
import os, re, sys, glob, json, time, shutil, argparse, subprocess, unicodedata

FOLDER = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/dohwadore_saju_자막"
PROGRESS = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/saju_진행현황_이어하기.txt"
MLX_REPO = "mlx-community/whisper-large-v3-mlx"
CHANNEL = "도화도레 사주 (@dohwadore_saju)"
WARN = ("> ⚠️ **자동 음성전사(Whisper) 결과입니다.** 이 문서는 오디오를 기계 전사한 것으로, "
        "문장부호·사주 전문용어에 오류가 있을 수 있으며 사람이 검수하지 않았습니다. "
        "오락용 사주 의견이므로 사실·조언으로 받아들이지 마시고, 정확한 내용은 원본 영상을 확인하세요.")
ID_RE = re.compile(r'_([A-Za-z0-9_\-]{11})\.md$')


def sanitize(t, fallback):
    """§B 원문과 동일한 규칙 — 윈도우에서 만들어진 기존 파일명과 일치시키기 위함."""
    t = t or fallback
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', t)
    t = re.sub(r'\s+', ' ', t).strip().rstrip('. ')
    return (t[:110].strip() or fallback)


def fmt_dur(s):
    s = int(s or 0); h = s // 3600; m = (s % 3600) // 60; ss = s % 60
    return ("%d:%02d:%02d" % (h, m, ss)) if h else ("%d:%02d" % (m, ss))


def scan_folder():
    """영상ID -> (기존파일경로, 이미Whisper인가)."""
    state = {}
    for f in os.listdir(FOLDER):
        if not f.endswith(".md") or f.startswith("index"):
            continue
        m = ID_RE.search(f)
        if not m:
            continue
        p = os.path.join(FOLDER, f)
        try:
            with open(p, encoding="utf-8", errors="replace") as fh:
                head = fh.read(900)
        except Exception:
            head = ""
        state[m.group(1)] = (p, "Whisper" in head)
    return state


def public_targets():
    """진행현황 파일의 '남은 공개 영상' 목록 = 맥이 처리할 대상(멤버십 제외).
    92개 완주 후(2026-07-20) 진행현황이 재발행되며 그 섹션이 사라졌다 —
    이제 전체 실행의 신규 대상은 없으므로 빈 목록 폴백(--only 재시도 모드는 영향 없음)."""
    try:
        txt = open(PROGRESS, encoding="utf-8-sig").read()
        sec = txt.split("남은 공개 영상")[1].split("홍염 프리미엄")[0]
        return re.findall(r'\[([A-Za-z0-9_\-]{11})\]', sec)
    except (IndexError, OSError):
        return []


def load_info(vid, tmp_dir):
    """_raw 의 메타데이터를 우선 사용(네트워크 왕복 절약). 없으면 다운로드분을 씀."""
    p = os.path.join(FOLDER, "_raw", vid + ".info.json")
    if os.path.exists(p):
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:
            pass
    for c in glob.glob(os.path.join(tmp_dir, vid + "*.info.json")):
        try:
            return json.load(open(c, encoding="utf-8"))
        except Exception:
            pass
    return {}


def find_cookies():
    """멤버십용 쿠키 탐색 — 로컬 전용 경로 우선 (회사 OneDrive 는 최후 폴백·경고 대상)."""
    for c in (os.path.expanduser("~/.whisper_cookies.txt"),
              os.path.join(FOLDER, "cookies.txt"),
              "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/youtube_cookies.txt"):
        if os.path.exists(c):
            return c
    return None


def find_node():
    n = shutil.which("node")
    if n:
        return n
    for p in (os.path.expanduser("~/.local/bin/node"), "/opt/homebrew/bin/node", "/usr/local/bin/node"):
        if os.path.exists(p):
            return p
    return None


def download_audio(vid, tmp_dir, retries=3):
    # 이미 받아둔 완성 오디오가 있으면 재사용 — "다운로드 선행(1스트림·쿠키) → 전사(2스트림·쿠키無)"
    # 분리 구조의 핵심. (.part/.ytdl = 받다 만 것이라 제외)
    ready = [f for f in glob.glob(os.path.join(tmp_dir, vid + ".*"))
             if not f.endswith((".info.json", ".part", ".ytdl"))]
    if ready and os.path.getsize(ready[0]) > 0:
        return ready[0]
    for c in glob.glob(os.path.join(tmp_dir, vid + ".*")):
        try: os.remove(c)
        except Exception: pass
    base = [sys.executable, "-m", "yt_dlp", "-f", "bestaudio/best", "--no-warnings",
            "--no-progress", "--write-info-json",
            "-o", os.path.join(tmp_dir, "%(id)s.%(ext)s")]
    url = "https://www.youtube.com/watch?v=" + vid
    # 멤버십 폴백: 쿠키+Node(JS 챌린지) — §B 원본과 동일한 2단 시도 (공개는 쿠키 없이가 빠르고 안전)
    cookies, node = find_cookies(), find_node()
    members = (["--cookies", cookies, "--js-runtimes", "node:" + node,
                "--extractor-args", "youtube:ejs=npm"] if (cookies and node) else None)
    last = None
    for attempt in range(retries):
        try:
            subprocess.run(base + [url], check=True, capture_output=True, text=True, timeout=1800)
        except Exception as e:
            last = e
            if members:
                try:
                    subprocess.run(base + members + [url], check=True, capture_output=True, text=True, timeout=1800)
                    last = None
                except Exception as e2:
                    last = e2
        if last is None:
            auds = [f for f in glob.glob(os.path.join(tmp_dir, vid + ".*"))
                    if not f.endswith(".info.json")]
            if auds:
                return auds[0]
            last = RuntimeError("no audio produced")
        time.sleep(5 * (attempt + 1))   # 5s -> 10s -> 15s (유튜브 rate limit 완화)
    raise last


def build_doc(info, vid, text):
    ud = info.get("upload_date") or ""
    ud_h = ("%s-%s-%s" % (ud[0:4], ud[4:6], ud[6:8])) if len(ud) == 8 else "?"
    return ("# %s\n\n"
            "- **업로드:** %s\n"
            "- **길이:** %s\n"
            "- **조회수:** %s\n"
            "- **URL:** https://www.youtube.com/watch?v=%s\n"
            "- **채널:** %s\n"
            "- **자막:** 한국어 (⚙️ 로컬 Whisper ASR · large-v3 · 자동전사 · 미검수)\n\n"
            "%s\n\n---\n\n%s\n"
            % (info.get("title") or vid, ud_h, fmt_dur(info.get("duration")),
               info.get("view_count") or "?", vid, CHANNEL, WARN, text))


def target_path(vid, info, existing):
    """기존 파일이 있으면 그 경로를 그대로 재사용(링크 보존). 없으면 폴더 규칙으로 새로 만든다."""
    if existing:
        return existing
    ud = info.get("upload_date") or "00000000"
    # NFC 정규화: 맥에서 새 파일을 만들면 파일명이 자소분리(NFD)로 저장돼
    # 윈도우/OneDrive 에서 "ㅅㅏㅈㅜ" 처럼 깨져 보인다 — 합쳐서(NFC) 만든다
    name = unicodedata.normalize("NFC", sanitize(info.get("title"), vid))
    return os.path.join(FOLDER, "%s_%s_%s.md" % (ud, name, vid))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--preview", default=None, help="실폴더 대신 이 폴더에 써서 형식 검수")
    ap.add_argument("--shard", default="1/1",
                    help="N/M — 목록을 M등분해 N번째만 처리. 2스트림 동시 실행용(실측 7.85배속)")
    ap.add_argument("--only", default=None,
                    help="영상ID(쉼표 구분)만 처리 — 실패 재시도용. 샤딩 무시, 1스트림으로 쓸 것")
    ap.add_argument("--download-only", action="store_true",
                    help="오디오만 내려받고 전사는 안 함 (쿠키 필요 구간을 1스트림으로 먼저 끝내는 용도)")
    a = ap.parse_args()

    state = scan_folder()
    targets = public_targets()
    todo = [v for v in targets if not state.get(v, (None, False))[1]]
    skipped = len(targets) - len(todo)
    if a.limit > 0:
        todo = todo[:a.limit]
    # 샤딩: 개수가 아니라 '오디오 총 길이'로 균등 분배해야 한다.
    # 단순 인터리브(i%M)로 나누면 이 채널은 29.4h vs 21.2h 로 8시간 치우쳐 한쪽이 놀게 된다.
    # → LPT(긴 것부터 현재 가장 가벼운 샤드에 배정) 로 균형을 맞춘다.
    sn, sm = (int(x) for x in a.shard.split("/"))
    if a.only:
        # 재시도 모드 = 완료 여부·대상 목록 필터를 모두 무시하고 지정 ID 를 강제 재전사.
        # (루프 손상본은 헤더가 이미 Whisper 라 todo 필터에 걸러진다 — 그래서 todo 가 아니라 원본 목록을 쓴다)
        want = [x.strip() for x in a.only.split(",") if x.strip()]
        todo = want
        sm = 1                       # 재시도 모드는 샤딩 무시
    elif sm > 1:
        tmp_probe = os.path.join(FOLDER, "_audio_tmp")
        dur_all = {v: (load_info(v, tmp_probe).get("duration") or 0) for v in todo}
        bins = [[] for _ in range(sm)]
        load = [0.0] * sm
        for v in sorted(todo, key=lambda x: -dur_all[x]):
            k = load.index(min(load))
            bins[k].append(v); load[k] += dur_all[v]
        order = {v: i for i, v in enumerate(todo)}          # 원래 순서(업로드순) 복원
        todo = sorted(bins[sn - 1], key=lambda v: order[v])

    out_dir = a.preview or FOLDER
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
    # 오디오 임시파일은 원드라이브 밖(로컬)에 둔다 — 안 그러면 수십 GB 가 회사 클라우드로 동기화됨
    tmp = os.path.expanduser("~/.cache/whisper_saju_tmp"); os.makedirs(tmp, exist_ok=True)
    logpath = os.path.join(FOLDER, "_whisper_mac.log")
    tag = "" if sm == 1 else "[%d/%d] " % (sn, sm)

    def log(m):
        line = time.strftime("%m-%d %H:%M:%S ") + tag + m
        print(line, flush=True)
        with open(logpath, "a", encoding="utf-8") as f:   # append 라 두 스트림이 같이 써도 안전
            f.write(line + "\n")

    log("=== WHISPER(mac/mlx large-v3): 도화도레 사주 ===")
    log("공개 대상 %d개 | 이미 완료 %d개 | 이 스트림 처리 %d개%s"
        % (len(targets), skipped, len(todo), "  [미리보기]" if a.preview else ""))

    if a.download_only:
        log("모드: 다운로드 전용 (전사 없음 · GPU 미사용 · 쿠키 1스트림)")
        okd = faild = 0
        for i, vid in enumerate(todo, 1):
            try:
                audio = download_audio(vid, tmp)
                okd += 1
                log("[%d/%d] DL %s (%.1fMB)" % (i, len(todo), vid,
                                                os.path.getsize(audio) / 1048576))
            except Exception as e:
                faild += 1
                log("[%d/%d] DL-FAIL %s : %s" % (i, len(todo), vid, repr(e)[:120]))
        log("=== DL-DONE ok=%d fail=%d ===" % (okd, faild))
        return

    import mlx_whisper
    log("engine: mlx-whisper (Mac GPU)  repo=%s  lang=ko" % MLX_REPO)

    # 길이는 한 번만 읽어 캐시한다(원드라이브 반복 읽기 방지 — 매 회차 재조회는 O(n^2))
    durs = {v: (load_info(v, tmp).get("duration") or 0) for v in todo}
    log("총 오디오 %.1f시간" % (sum(durs.values()) / 3600.0))

    t0 = time.time(); ok = 0; fail = 0; audio_done = 0.0
    for i, vid in enumerate(todo, 1):
        ts = time.time()
        try:
            audio = download_audio(vid, tmp)
            info = load_info(vid, tmp)
            # condition_on_previous_text=False: 무음·BGM 구간에서 같은 문장이 수십 번 반복되는
            # 디코드 루프의 근본 원인(이전 문맥 전파)을 차단 — 평의회 실측: 기존 완료본의 7%(9개)에서
            # 루프 발생('juris' 26연속, '일주' 34연속 등). 완료 후 재전사 패스부터 적용됨.
            res = mlx_whisper.transcribe(audio, path_or_hf_repo=MLX_REPO, language="ko",
                                         condition_on_previous_text=False)
            segs = res.get("segments") or []
            text = "\n".join(s["text"].strip() for s in segs if s.get("text", "").strip())
            if not text.strip():
                raise RuntimeError("empty transcript")

            existing = state.get(vid, (None, False))[0]
            path = target_path(vid, info, existing)
            if a.preview:
                path = os.path.join(a.preview, os.path.basename(path))
            # 원자적 쓰기: 도중에 죽어도 반쪽 파일이 '완료'로 보이지 않게
            # 인코딩 규격 = UTF-8 + BOM + CRLF : 구형 윈도우 메모장(CP949 오판)까지 포함해
            # 윈도우·안드로이드·iOS 전부에서 한글이 깨질 수 없는 조합 (폴더 정규 규격)
            tmpf = path + ".tmp"
            with open(tmpf, "w", encoding="utf-8-sig", newline="\r\n") as f:
                f.write(build_doc(info, vid, text))
            os.replace(tmpf, path)

            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass

            dur = durs.get(vid) or info.get("duration") or 0
            audio_done += dur
            ok += 1
            dt = time.time() - ts
            rate = audio_done / max(time.time() - t0, 1)
            left = sum(durs.get(v, 0) for v in todo[i:]) / max(rate, 0.01) / 3600
            log("[%d/%d] OK %-30.30s %5.0fs (%4.1fx) | ok=%d fail=%d | 남은 %.1fh"
                % (i, len(todo), (info.get("title") or vid), dt, (dur / dt if dt else 0), ok, fail, left))
        except Exception as e:
            fail += 1
            log("[%d/%d] FAIL %s : %s" % (i, len(todo), vid, repr(e)[:160]))
            for c in glob.glob(os.path.join(tmp, vid + ".*")):
                try: os.remove(c)
                except Exception: pass
    log("=== DONE ok=%d fail=%d elapsed=%.2fh ===" % (ok, fail, (time.time() - t0) / 3600.0))


if __name__ == "__main__":
    main()
