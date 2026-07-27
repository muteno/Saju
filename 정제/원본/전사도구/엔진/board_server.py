# -*- coding: utf-8 -*-
"""전사 프로세스 알리미 — 범용 진행 보드 + 새 작업 발사대 (v3)

- 모든 채널/경로/라벨은 board_config.json 에서 읽는다 (요청마다 다시 읽음 = 수정 즉시 반영)
- 브라우저: http://localhost:<port>   ·  10초 자동 갱신  ·  PC 전용(127.0.0.1 바인드)
- 실패 이력의 [재시도]: 전사가 쉬는 중이면 즉시 1스트림 재전사, 작업 중이면 대기열에 예약
  (대기열은 run_job.sh 가 전체 작업 종료 후 자동 처리)
- v3: 새 전사 작업 발사대 — 유튜브채널전사.command 의 로직(--dry --scan 조회 → 보드설정 갱신
  → 발사)을 그대로 웹으로 옮김. 기계 프로필(맥/윈도우)로 스트림 수를 강제:
  · 맥 공개 = 2스트림 · 맥 쿠키(멤버십) = 1스트림(동시 사용 시 유튜브가 세션 무효화 — 7/20 실측)
  · 윈도우 = 실행 불가(원격 에이전트 없음) → 1스트림 규칙이 박힌 지시서 파일 발행
  어떤 전사 엔진이든 도는 중엔 스캔/발사 전부 잠금(서버측 강제).
"""
import os, re, sys, json, time, html, subprocess, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SKILL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SKILL)
VID_RE = re.compile(r'^[A-Za-z0-9_\-]{11}$')

# ── v3: 발사대 상수 ─────────────────────────────────────────────
PY = os.path.join(SKILL, ".venv/bin/python")
GENERIC = os.path.join(SKILL, "whisper_channel_generic.py")
ANY_ENGINE = r"whisper_channel_generic\.py|whisper_saju_mac\.py|whisper_channel_mac\.py"
STATE_P = os.path.join(SKILL, "launch_state.json")
COOKIES = os.path.expanduser("~/.whisper_cookies.txt")
DOCS_DIR = os.path.expanduser(
    "~/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/_전사프로그램/문서")
MACHINES = {  # 전부 실측값 (인계서 §3) — 문서값 아님
    "mac": dict(label="🍎 맥 M5 — 이 컴퓨터", eng="mlx-whisper large-v3 (fp16)",
                sp_pub=5.0, sp_cook=3.0, st_pub=2, st_cook=1, exec_ok=True,
                # sp_cook: 1스트림 실효는 미실측 — 보수 추정치 (평의회: 4.5는 2스트림 5.0과 모순)
                rule="공개 2스트림 · 쿠키(멤버십) 1스트림 · 3스트림 금지(스왑 폭발)"),
    "windows": dict(label="🪟 윈도우 — GTX 1080", eng="faster-whisper large-v3 (int8)",
                    sp_pub=3.36, sp_cook=3.36, st_pub=1, st_cook=1, exec_ok=False,
                    rule="VRAM 8GB → 모델 2벌 물리적 불가 · 무조건 1스트림 (실측 3.36배속)"),
}
_ST_LOCK = threading.Lock()


def _env():
    return dict(os.environ, PATH=os.path.join(SKILL, ".venv/bin") + ":" +
                os.path.expanduser("~/.local/bin") + ":" + os.environ.get("PATH", ""))


def load_state():
    try:
        return json.load(open(STATE_P, encoding="utf-8"))
    except Exception:
        return {}


def save_state(**kw):
    with _ST_LOCK:
        st = load_state(); st.update(kw)
        tmp = STATE_P + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(st, f, ensure_ascii=False, indent=1)
        os.replace(tmp, STATE_P)  # 원자적 쓰기 (프로젝트 규칙)


def engines_busy():
    """실전사 엔진이 하나라도 돌면 True — 발사·재시도의 유일한 관문.
    --dry(조회 전용) 프로세스는 전사가 아니므로 제외 (평의회: 스캔 중 거짓 잠금 방지)."""
    out = os.popen("ps ax -o command | grep -E '%s' | grep -v -e ' --dry' -e grep" % ANY_ENGINE).read().strip()
    if out:
        return True
    st = load_state()  # 방금 발사해서 ps 에 아직 안 잡히는 틈(레이스) 방지
    return bool(st.get("launch_ts") and time.time() - st["launch_ts"] < 40)


def scan_worker(url, token):
    """유튜브채널전사.command 25행과 동일한 조회를 백그라운드로.
    token(시작 시각)이 현재 상태와 다르면 결과를 버린다 — /launch-reset 뒤 좀비 부활 방지(평의회)."""
    def _commit(**scan):
        if (load_state().get("scan") or {}).get("t") != token:
            return
        save_state(scan=dict(scan, url=url, t=token))
    try:
        p = subprocess.run([PY, GENERIC, url, "--dry", "--scan"],
                           capture_output=True, text=True, timeout=420, env=_env())
        if p.returncode != 0:
            raise RuntimeError((p.stderr.strip() or "조회 실패 — 링크 확인")[-300:])
        r = {}
        for l in p.stdout.splitlines():
            seg = l.split("\t")
            if len(seg) >= 2:
                r[seg[0]] = seg[1]
        if not all(k in r for k in ("CHANNEL", "TOTAL", "OUT")):
            raise RuntimeError("스캔 출력 형식 인식 실패")
        _commit(status="done", r=r)
    except Exception as e:
        _commit(status="error", err=str(e)[:300])


def write_board_config(url, r, streams, cookie):
    """유튜브채널전사.command run_full() 의 설정 갱신을 그대로."""
    cfgd = {
        "port": 8765,
        "title": "전사 프로세스 알리미",
        "channel_name": r.get("CHANNEL", "?"),
        "channel_handle": "",
        "channel_total_videos": int(float(r.get("TOTAL") or 0)),
        "folder": r["OUT"],
        "url": url,
        "log_file": "_whisper_mac.log",
        "storage_style": "클라우드 · OneDrive (GS칼텍스 예울마루)",
        "engine_match": "python.*whisper_channel_generic",
        "expected_streams": streams,
        "runner": "run_generic_retry.sh",
        "note_excluded": ("쿠키 모드 · 1스트림 고정(세션 보호)" if cookie else
                          "멤버십 영상은 ~/.whisper_cookies.txt 가 있고 접근 가능할 때만 받아짐"),
    }
    tmp = os.path.join(SKILL, "board_config.json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfgd, f, ensure_ascii=False, indent=2)
    os.replace(tmp, os.path.join(SKILL, "board_config.json"))


def spawn(args):
    subprocess.Popen(["caffeinate", "-is"] + args, env=_env(),
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)


def launch_mac(mode):
    """`.command` run_full() 미러 + 쿠키=1스트림 규칙(7/20 실측 반영)."""
    st = load_state(); sc = st.get("scan") or {}
    r = sc.get("r") or {}
    url, out = sc.get("url"), r.get("OUT")
    if not (url and out):
        return "먼저 [① 채널 확인]을 해줘."
    cookie = (mode == "member")
    if cookie and not os.path.exists(COOKIES):
        return "쿠키 파일(~/.whisper_cookies.txt)이 없어 멤버십 모드 불가."
    streams = 1 if (cookie or mode == "test3") else 2
    save_state(launch_ts=time.time())  # spawn 전에 먼저 예약(락) — ps 반영 지연 창 봉쇄(평의회 critical)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "_whisper_mac.log"), "w").close()  # ETA 오염 방지(평의회 지적)
    write_board_config(url, r, streams, cookie)
    base = [PY, GENERIC, url, "--out", out] + ([] if cookie else ["--no-cookies"])
    if mode == "test3":
        spawn(base + ["--limit", "3"])
        msg = "🚀 3개 시험 시작 (1스트림) — 이 화면에서 진행이 보여."
    elif cookie:
        spawn(base + ["--shard", "1/1"])
        msg = "🚀 멤버십 포함 전체 시작 — 쿠키 보호를 위해 1스트림."
    else:
        spawn(base + ["--shard", "1/2"]); spawn(base + ["--shard", "2/2"])
        msg = "🚀 공개분 전체 시작 (2스트림)."
    save_state(scan=None, notice=msg)  # 스캔 소진 — 작업 종료 후 무심코 재발사(로그 초기화 사고) 방지
    return None


def issue_windows_card():
    st = load_state(); sc = st.get("scan") or {}
    r = sc.get("r") or {}
    if not r:
        return "먼저 [① 채널 확인]을 해줘."
    hrs = float(r.get("HOURS") or 0)
    ch = re.sub(r'[^\w가-힣]+', '', r.get("CHANNEL", "채널"))[:20] or "채널"
    name = "윈도우전사지시서_%s_%s.txt" % (ch, time.strftime("%y%m%d_%H%M"))
    outdir = DOCS_DIR if os.path.isdir(DOCS_DIR) else SKILL
    path = os.path.join(outdir, name)
    L = [
        "윈도우 PC 전사 지시서 (맥 웹보드 자동 발행 %s)" % time.strftime("%Y-%m-%d %H:%M"),
        "=" * 46,
        "채널   : %s" % r.get("CHANNEL", "?"),
        "링크   : %s" % sc.get("url", "?"),
        "대상   : 총 %s개 (완료 %s · 할 것 %s) · 공개 %s · 멤버십 %s · 불가 %s" % (
            r.get("TOTAL", "?"), r.get("DONE", "?"), r.get("TODO", "?"),
            r.get("PUBLIC", "?"), r.get("MEMBER", "?"), r.get("NA", "0")),
        "분량   : 공개분 약 %.1f시간 → 예상 소요 약 %.1f시간 (실측 3.36배속)" % (hrs, hrs / 3.36 if hrs else 0),
        "",
        "[불변 규칙 — 전부 실측 근거, 어기면 죽거나 품질 파괴]",
        "1. 스트림은 무조건 1개. 2스트림 절대 금지 — GTX 1080 은 VRAM 8GB 라",
        "   large-v3 두 벌(9~10GB)이 물리적으로 안 들어가 OOM 으로 즉사한다.",
        "2. 모델은 faster-whisper large-v3 int8 고정. turbo 금지(고유명사 파괴).",
        "3. 파일 규격 UTF-8+BOM+CRLF · 파일명 YYYYMMDD_제목_영상ID.md",
        "   · 완료 판정 = 파일 머리말의 \"Whisper\" 표기 (파일 존재 여부 아님).",
        "4. 중단 후 재개 = 같은 명령 재실행 (끝난 건 자동으로 건너뜀).",
        "5. 상세 절차는 복제팩 문서와 전체인계서",
        "   (황세웅/_전사프로그램/문서/20260719_194400_유튜브전사_전체인계서_v1.md) 참조.",
        "   충돌 시 이 지시서의 규칙이 우선.",
        "",
        "※ 이 파일은 맥 웹보드의 [윈도우 지시서 발행] 버튼이 만들었다.",
        "   맥에서는 실행되지 않았다 — 윈도우 PC 에서 이 규칙대로 실행할 것.",
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write("\r\n".join(L) + "\r\n")
    save_state(notice="📄 윈도우 지시서 발행됨: " + path)
    return None


def cfg():
    return json.load(open(os.path.join(SKILL, "board_config.json"), encoding="utf-8"))


def ts_abs(t):
    return time.strftime("%m-%d %H:%M", time.localtime(t))


def human_dur(sec):
    sec = int(sec)
    if sec < 60: return "%d초" % sec
    if sec < 3600: return "%d분 %02d초" % (sec // 60, sec % 60)
    return "%d시간 %d분" % (sec // 3600, (sec % 3600) // 60)


def parse_line_time(l):
    try: return time.mktime(time.strptime("2026-" + l[:14], "%Y-%m-%d %H:%M:%S"))
    except Exception: return None


def _common(c):
    logp = os.path.join(c["folder"], c["log_file"])
    lines = open(logp, encoding="utf-8", errors="replace").read().splitlines() if os.path.exists(logp) else []
    oks = [l for l in lines if " OK " in l]
    fails = [l for l in lines if " FAIL " in l]
    streams = int(os.popen("pgrep -f '%s' | wc -l" % c["engine_match"]).read().strip() or 0)
    streams = min(streams // 2, c.get("expected_streams", 2)) if streams else 0
    t0 = next((parse_line_time(l) for l in lines if parse_line_time(l)), None)
    qp = os.path.join(c["folder"], "_retry_queue.txt")
    queue = [q.strip() for q in open(qp, encoding="utf-8")] if os.path.exists(qp) else []
    vm = os.popen("vm_stat").read()
    free = 0
    m = re.search(r"Pages free:\s+(\d+)", vm); m2 = re.search(r"Pages inactive:\s+(\d+)", vm)
    if m and m2: free = (int(m.group(1)) + int(m2.group(1))) * 16384 / 1e9
    sw = os.popen("sysctl -n vm.swapusage").read()
    ms = re.search(r"used = ([\d.]+)M", sw)
    return lines, dict(oks=oks, fails=fails, streams=streams, t0=t0,
                       queue=[q for q in queue if q],
                       od=bool(os.popen("pgrep -x OneDrive | head -1").read().strip()),
                       half=len([f for f in os.listdir(c["folder"]) if f.endswith(".tmp")]),
                       free=free, swap=(float(ms.group(1)) / 1024 if ms else 0))


def snapshot_generic(c):
    """엔진 모듈 없이 로그+폴더만으로 집계 — 범용 채널 작업용 (whisper_channel_generic)."""
    lines, s = _common(c)
    total = done0 = 0; tot_h = 0.0
    for l in lines:
        m = re.search(r"대상 (\d+)개 \| 이미 완료 (\d+)개", l)
        if m: total, done0 = int(m.group(1)), int(m.group(2))
        m2 = re.search(r"총 오디오 ([\d.]+)시간", l)
        if m2: tot_h += float(m2.group(1))
    h_done = 0.0
    for l in s["oks"]:
        m = re.search(r"(\d+)s \(\s*([\d.]+)x\)", l)
        if m: h_done += int(m.group(1)) * float(m.group(2)) / 3600
    el = (time.time() - s["t0"]) if s["t0"] else 0
    rate = h_done / (el / 3600) if el > 180 else 0
    h_left = max(tot_h - h_done, 0)
    s.update(n=done0 + len(s["oks"]), tot=total or (done0 + len(s["oks"])),
             h_done=h_done, h_left=h_left, rate=rate,
             eta_ts=(time.time() + h_left / rate * 3600) if (rate > 0 and h_left > 0) else None)
    return s


def snapshot(c):
    if not c.get("engine_module"):
        return snapshot_generic(c)
    _argv = sys.argv; sys.argv = ["x"]
    W = __import__(c["engine_module"]); sys.argv = _argv
    pub = W.public_targets(); state = W.scan_folder()
    done = [v for v in pub if state.get(v, (None, False))[1]]
    todo = [v for v in pub if v not in done]
    tmp = os.path.expanduser("~/.cache/whisper_saju_tmp")
    dur = lambda v: (W.load_info(v, tmp).get("duration") or 0)
    h_done = sum(dur(v) for v in done) / 3600
    h_left = sum(dur(v) for v in todo) / 3600

    logp = os.path.join(c["folder"], c["log_file"])
    lines = open(logp, encoding="utf-8", errors="replace").read().splitlines() if os.path.exists(logp) else []
    oks, fails = [], []
    for l in lines:
        if " OK " in l: oks.append(l)
        elif " FAIL " in l: fails.append(l)
    streams = int(os.popen("pgrep -f '%s' | wc -l" % c["engine_match"]).read().strip() or 0)
    streams = min(streams // 2, c.get("expected_streams", 2)) if streams else 0  # caffeinate 짝 제거
    t0 = next((parse_line_time(l) for l in lines if parse_line_time(l)), None)
    el = (time.time() - t0) if t0 else 0
    rate = h_done / (el / 3600) if el > 180 else 0
    eta_ts = time.time() + (h_left / rate) * 3600 if rate > 0 else None

    qp = os.path.join(c["folder"], "_retry_queue.txt")
    queue = [q.strip() for q in open(qp, encoding="utf-8")] if os.path.exists(qp) else []
    queue = [q for q in queue if q]

    vm = os.popen("vm_stat").read()
    free = 0
    m = re.search(r"Pages free:\s+(\d+)", vm); m2 = re.search(r"Pages inactive:\s+(\d+)", vm)
    if m and m2: free = (int(m.group(1)) + int(m2.group(1))) * 16384 / 1e9
    sw = os.popen("sysctl -n vm.swapusage").read()
    ms = re.search(r"used = ([\d.]+)M", sw)
    swap = float(ms.group(1)) / 1024 if ms else 0

    return dict(n=len(done), tot=len(pub), h_done=h_done, h_left=h_left, rate=rate,
                t0=t0, eta_ts=eta_ts, streams=streams, oks=oks, fails=fails, queue=queue,
                od=bool(os.popen("pgrep -x OneDrive | head -1").read().strip()),
                half=len([f for f in os.listdir(c["folder"]) if f.endswith(".tmp")]),
                free=free, swap=swap)


def fail_rows(s):
    """실패 로그 → (시각, 영상ID, 사유) 최신순, 영상별 최신 1건. 이미 성공한 건 제외."""
    ok_ids = set()
    for l in s["oks"]:
        m = re.search(r'([A-Za-z0-9_\-]{11})', l)  # OK 줄엔 ID가 없을 수 있음 — 제목만
    seen = {}
    for l in s["fails"]:
        m = re.search(r'FAIL ([A-Za-z0-9_\-]{11}) : (.*)$', l)
        if not m: continue
        t = parse_line_time(l)
        seen[m.group(1)] = (t, m.group(1), m.group(2)[:80])
    return sorted(seen.values(), key=lambda x: -(x[0] or 0))


def launcher_html(busy):
    """새 전사 작업 패널 — 서버측 잠금과 짝을 이루는 표시부 (JS 없음, 기존 방식 유지)."""
    st = load_state()
    mach = st.get("machine", "mac")
    if mach not in MACHINES:  # 상태파일 수기 오염 대비 (평의회)
        mach = "mac"
    sc = st.get("scan") or {}
    notice = st.get("notice") or ""
    h = ["<h2>새 전사 작업</h2><div class=lnch>"]
    if notice:
        h.append("<div class=qbar>%s <a class=retry href='/notice-clear'>알림 지우기</a></div>"
                 % html.escape(notice))
    # 기계 선택 (항상 표시 — 선택 자체는 무해)
    h.append("<div class=mrow>")
    for key in ("mac", "windows"):
        m = MACHINES[key]
        h.append(
            "<a class='mcard%s' href='/set-machine?m=%s'><div class=mt>%s%s</div>"
            "<div class=md>%s<br>%s</div></a>" % (
                " sel" if mach == key else "", key, m["label"],
                "" if m["exec_ok"] else " · <span style=color:#e0b64f>실행은 그 PC에서</span>",
                m["eng"], m["rule"]))
    h.append("</div>")
    if busy:
        h.append("<div class=qbar>🔒 지금 전사 작업이 돌고 있어 새 작업(조회·발사)은 잠가뒀어 — "
                 "끝나면 이 자리에서 바로 시작 가능.</div></div>")
        return "".join(h)
    # 1단계: 링크 조회
    h.append("<form class=brow action=/scan-start method=get>"
             "<input class=lin style='flex:1;min-width:220px' name=url "
             "placeholder='유튜브 링크(채널/재생목록/영상) 붙여넣기'>"
             "<button class=btn>① 채널 확인 (1~2분)</button></form>")
    status = sc.get("status")
    if status == "scanning":
        stale = time.time() - (sc.get("t") or 0) > 480
        h.append("<div class=%s>%s <a class=retry href='/launch-reset'>취소</a></div>" % (
            "err" if stale else "qbar",
            "⏱ 조회가 8분을 넘겼어 — 막힌 것 같으면 취소하고 다시" if stale
            else "🔎 조회 중... (10초마다 자동 갱신 — 이 화면에 결과가 떠)"))
    elif status == "error":
        h.append("<div class=err><span class=t>조회 실패</span> %s "
                 "<a class=retry href='/launch-reset'>다시</a></div>" % html.escape(sc.get("err", "?")))
    elif status == "done":
        r = sc.get("r") or {}
        hrs = float(r.get("HOURS") or 0)
        m = MACHINES[mach]
        eta_pub = "약 %.1f시간 (%d스트림)" % (hrs / m["sp_pub"], m["st_pub"]) if hrs else "?"
        eta_cook = "약 %.1f시간 (1스트림·공개분 기준 보수 추정)" % (hrs / m["sp_cook"]) if hrs else "?"
        h.append(
            "<div class=scard>"
            "<span class=k>채널</span><span><b>%s</b> · 링크 <code>%s</code></span>"
            "<span class=k>영상</span><span>총 %s개 (이미 완료 %s · 할 것 %s)</span>"
            "<span class=k>구성</span><span>🔓 공개 %s · 🔒 멤버십 %s · ⚠️ 불가 %s</span>"
            "<span class=k>분량</span><span>공개분 약 %.1f시간 → <b>%s</b>%s</span>"
            "<span class=k>저장 위치</span><span><code>%s</code></span>"
            "</div>" % (
                html.escape(r.get("CHANNEL", "?")), html.escape(sc.get("url", "")),
                r.get("TOTAL", "?"), r.get("DONE", "?"), r.get("TODO", "?"),
                r.get("PUBLIC", "?"), r.get("MEMBER", "?"), r.get("NA", "0"),
                hrs, eta_pub,
                (" · 쿠키 모드면 " + eta_cook) if r.get("MEMBER", "0") not in ("0", "", "?") else "",
                html.escape(r.get("OUT", "?"))))
        if mach == "mac":
            cook_ok = os.path.exists(COOKIES)
            h.append("<div class=brow>"
                     "<a class=btn href='/launch?mode=test3'>② 먼저 3개 시험 (추천)</a>"
                     "<a class=btn href='/launch?mode=full'>② 공개분 전체 시작 · 2스트림</a>"
                     "<a class='btn amber%s' href='/launch?mode=member'>멤버십 포함 · 쿠키 · 1스트림</a>"
                     "%s<a class=retry href='/launch-reset'>처음부터</a></div>" % (
                         "" if cook_ok else " dis",
                         "" if cook_ok else "<span style='color:#6b7480;font-size:12px'>(쿠키 없음 → 비활성)</span>"))
        else:
            h.append("<div class=brow>"
                     "<a class='btn amber' href='/launch?mode=windows'>② 윈도우 지시서 발행 (실행 아님)</a>"
                     "<span style='color:#8b93a1;font-size:12px'>이 컴퓨터에선 실행 안 함 — "
                     "1스트림 규칙이 박힌 지시서를 문서 폴더에 저장</span>"
                     "<a class=retry href='/launch-reset'>처음부터</a></div>")
    h.append("</div>")
    return "".join(h)


def render(c):
    E = lambda x: html.escape(str(x))  # 설정·스캔 유래 문자열 전부 이스케이프 (평의회: 저장형 XSS 봉쇄)
    s = snapshot(c)
    pct = s["n"] / s["tot"] * 100 if s["tot"] else 0
    running = s["streams"] > 0
    busy = engines_busy()
    scanning = ((load_state().get("scan") or {}).get("status") == "scanning")
    # 대기 상태에선 60초 갱신 — 링크 입력칸이 10초 리로드에 지워지는 문제 방지 (평의회)
    refresh = 10 if (running or busy or scanning) else 60
    try:
        lch = launcher_html(busy)
    except Exception as e:  # 발사대 표시 오류가 진행보드 전체를 죽이지 않게 격리
        lch = "<h2>새 전사 작업</h2><div class=err>발사대 표시 오류: %s</div>" % html.escape(repr(e))
    frows = ""
    for t, vid, why in fail_rows(s)[:8]:
        badge = " <span class=q>대기열</span>" if vid in s["queue"] else \
                " <a class=retry href='/retry?vid=%s'>재시도</a>" % vid
        frows += "<div class=err><span class=t>%s</span> <code>%s</code> %s%s</div>" % (
            ts_abs(t) if t else "?", vid, html.escape(why), badge)
    if not frows:
        frows = "<div class=okmsg>실패 없음</div>"
    qbar = ""
    if s["queue"] and not running:
        qbar = "<div class=qbar>대기열 %d건 — <a class=retry href='/retry-queue'>지금 재시도</a></div>" % len(s["queue"])
    elif s["queue"]:
        qbar = "<div class=qbar>대기열 %d건 — 본 작업 종료 후 자동 재시도</div>" % len(s["queue"])

    rows = ""
    for l in reversed(s["oks"][-16:]):
        m = re.search(r'\] (.*?)\s+(\d+)s \(\s*([\d.]+)x\)', l)
        t = parse_line_time(l)
        if m:
            rows += "<tr><td class=t>%s</td><td>%s</td><td class=n>%s</td><td class=n>%.1f배</td></tr>" % (
                ts_abs(t) if t else "", html.escape(m.group(1)), human_dur(int(m.group(2))), float(m.group(3)))

    st_dot = "#4ade80" if running else "#6b7480"
    st_txt = ("전사 중 · 스트림 %d/%d" % (s["streams"], c.get("expected_streams", 2))) if running else "정지됨"
    if running and s["streams"] < c.get("expected_streams", 2):
        st_txt = "⚠️ 스트림 일부 중단 · %d/%d" % (s["streams"], c.get("expected_streams", 2))
    eta = ts_abs(s["eta_ts"]) if s["eta_ts"] else "계산중"
    start = ts_abs(s["t0"]) if s["t0"] else "-"

    return """<!doctype html><html lang=ko><head><meta charset=utf-8>
<meta http-equiv=refresh content=%d><title>%s %d/%d</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f1115;color:#e6e8eb;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;padding:28px;max-width:860px;margin:0 auto}
h1{font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
.dot{width:9px;height:9px;border-radius:50%%;background:%s;box-shadow:0 0 10px %s;animation:%s}
@keyframes p{0%%,100%%{opacity:1}50%%{opacity:.35}}
.sub{color:#8b93a1;font-size:13px;margin:4px 0 18px}
.info{background:#171b22;border:1px solid #232935;border-radius:10px;padding:16px 18px;margin-bottom:18px;display:grid;grid-template-columns:110px 1fr;gap:7px 14px;font-size:14px}
.info .k{color:#8b93a1}
.info code{background:#0f1115;padding:1px 7px;border-radius:5px;font-size:12px;word-break:break-all}
.bar{height:26px;background:#1a1e26;border-radius:6px;overflow:hidden;margin:4px 0 8px;position:relative}
.fill{height:100%%;background:linear-gradient(90deg,#2d7dd2,#4da3ff);width:%.2f%%;transition:width .6s}
.pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;text-shadow:0 1px 3px #000}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.card{background:#171b22;border:1px solid #232935;border-radius:8px;padding:13px}
.card .k{color:#8b93a1;font-size:11px;margin-bottom:5px}
.card .v{font-size:19px;font-weight:600}
.card .v small{font-size:12px;color:#8b93a1;font-weight:400}
h2{font-size:12px;color:#8b93a1;letter-spacing:.06em;margin:24px 0 10px;font-weight:600}
.sys{display:flex;gap:20px;font-size:13px;background:#171b22;border:1px solid #232935;border-radius:8px;padding:12px 16px;flex-wrap:wrap}
.sys b{font-weight:600}
table{width:100%%;border-collapse:collapse;font-size:13px}
td{padding:7px 8px;border-bottom:1px solid #1d2229}
.t{color:#6b7480;width:88px}.n{text-align:right;color:#8b93a1;white-space:nowrap}
.err{background:#2a1618;border-left:3px solid #d9534f;padding:8px 11px;border-radius:4px;font-size:12.5px;margin-bottom:6px;color:#ffb3b0}
.err .t{color:#a97}.err code{color:#ffd7d5}
.retry{color:#4da3ff;text-decoration:none;border:1px solid #2d4a6b;border-radius:5px;padding:1px 9px;font-size:12px;margin-left:6px}
.retry:hover{background:#1c2a3d}
.retry:active{transform:scale(.96)}
.q{color:#e0b64f;font-size:12px;border:1px solid #5a4a1e;border-radius:5px;padding:1px 8px;margin-left:6px}
.qbar{background:#1d2333;border:1px solid #2d3a5b;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:8px}
.okmsg{color:#5fb37a;font-size:13px}
.foot{color:#6b7480;font-size:12px;margin-top:22px;border-top:1px solid #1d2229;padding-top:13px}
.lnch{background:#171b22;border:1px solid #232935;border-radius:10px;padding:16px 18px;margin:2px 0 6px}
.mrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin:2px 0 12px}
.mcard{display:block;background:#0f1115;border:1px solid #232935;border-radius:8px;padding:13px;color:#e6e8eb;text-decoration:none}
.mcard:hover{border-color:#2d4a6b}
.mcard:active{transform:scale(.98)}
.mcard.sel{border-color:#4da3ff;box-shadow:0 0 0 1px #4da3ff inset}
.mcard .mt{font-weight:600;font-size:14px;margin-bottom:4px}
.mcard .md{color:#8b93a1;font-size:12px;line-height:1.5}
.lin{background:#0f1115;border:1px solid #232935;border-radius:7px;color:#e6e8eb;padding:8px 11px;font-size:13px}
.lin:focus{outline:none;border-color:#2d4a6b}
.btn{display:inline-block;background:none;cursor:pointer;color:#4da3ff;border:1px solid #2d4a6b;border-radius:7px;padding:7px 14px;font-size:13px;text-decoration:none;font-family:inherit}
.btn:hover{background:#1c2a3d}
.btn:active{transform:scale(.97);background:#16202f}
.btn.amber{color:#e0b64f;border-color:#5a4a1e}
.btn.amber:hover{background:#2a2416}
.btn.dis{color:#6b7480;border-color:#232935;pointer-events:none}
.brow{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center}
.scard{background:#0f1115;border:1px solid #232935;border-radius:8px;padding:12px 14px;font-size:13px;margin-top:10px;display:grid;grid-template-columns:92px 1fr;gap:5px 12px}
.scard .k{color:#8b93a1}
</style></head><body>
<h1><span class=dot></span>%s</h1>
<div class=sub>%s · 10초 자동 갱신 · 지금 %s</div>
<div class=info>
<span class=k>채널</span><span><b>%s</b> (%s) · 전체 %d개 영상</span>
<span class=k>대상</span><span>%d개 (완료 %d · 남음 %d)</span>
<span class=k>전사본 위치</span><span><code>%s</code></span>
<span class=k>위치 스타일</span><span>%s %s</span>
</div>
<div class=bar><div class=fill></div><div class=pct>%d / %d</div></div>
<div class=grid>
<div class=card><div class=k>진행</div><div class=v>%.1f%%</div></div>
<div class=card><div class=k>처리한 분량</div><div class=v>%s<small> / 남음 %s</small></div></div>
<div class=card><div class=k>실효 속도 (다운로드 포함)</div><div class=v>%.1f<small>배속 · 표의 개별값은 전사속도</small></div></div>
<div class=card><div class=k>시작 → 완료예정</div><div class=v style=font-size:14px>%s → <b>%s</b></div></div>
</div>
<h2>시스템</h2>
<div class=sys><span>여유램 <b>%.1fGB</b></span><span>스왑 <b>%.1fGB</b></span><span>쓰다 만 파일 <b>%d</b></span><span>성공 <b>%d</b> · 실패 <b>%d</b></span></div>
%s
<h2>실패 이력</h2>%s%s
<h2>누적 결과 (최신순)</h2>
<table>%s</table>
<div class=foot>%s · 발사대 v3</div>
</body></html>""" % (
        refresh, E(c["title"]), s["n"], s["tot"],
        st_dot, st_dot, "p 2s infinite" if running else "none",
        pct,
        E(c["title"]), st_txt, time.strftime("%m-%d %H:%M:%S"),
        E(c["channel_name"]), E(c["channel_handle"]), c.get("channel_total_videos", 0),
        s["tot"], s["n"], s["tot"] - s["n"],
        E(c["folder"]),
        E(c["storage_style"]), "· <b style=color:#4ade80>동기화 중</b>" if s["od"] else "· <b style=color:#d9534f>동기화 꺼짐</b>",
        s["n"], s["tot"], pct,
        human_dur(s["h_done"] * 3600), human_dur(s["h_left"] * 3600),
        s["rate"], start, eta,
        s["free"], s["swap"], s["half"], len(s["oks"]), len(s["fails"]),
        lch,
        qbar, frows, rows, E(c.get("note_excluded", "")))


class H(BaseHTTPRequestHandler):
    # 부작용 라우트 목록 — Host/Origin 동일출처 검증 대상 (평의회: CSRF·DNS 리바인딩 하드닝)
    SIDE_FX = ("/retry", "/retry-queue", "/set-machine", "/notice-clear",
               "/launch-reset", "/scan-start", "/launch")

    def _origin_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost"):
            return False
        for hd in ("Origin", "Referer"):
            v = self.headers.get(hd)
            if v and not re.match(r"https?://(127\.0\.0\.1|localhost)([:/]|$)", v):
                return False
        return True

    def _back(self):
        self.send_response(303); self.send_header("Location", "/"); self.end_headers()

    def do_GET(self):
        c = cfg()
        u = urlparse(self.path)
        if u.path in self.SIDE_FX and not self._origin_ok():
            self.send_response(403); self.end_headers(); self.wfile.write(b"forbidden"); return
        if u.path == "/retry":
            vid = (parse_qs(u.query).get("vid") or [""])[0]
            if VID_RE.match(vid):
                # 관문을 engines_busy 로 통일 — 발사 40초 창·타 엔진까지 봐서 3스트림 봉쇄 (평의회 critical)
                if engines_busy():
                    qp = os.path.join(c["folder"], "_retry_queue.txt")
                    cur = set()
                    if os.path.exists(qp):
                        cur = {x.strip() for x in open(qp, encoding="utf-8") if x.strip()}
                    if vid not in cur:
                        with open(qp, "a", encoding="utf-8") as f: f.write(vid + "\n")
                else:
                    save_state(launch_ts=time.time())  # 재시도도 spawn 전 예약(락)
                    subprocess.Popen([os.path.join(SKILL, c.get("runner", "run_job.sh")), "--only", vid],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                     start_new_session=True)
            self._back(); return
        if u.path == "/retry-queue":
            qp = os.path.join(c["folder"], "_retry_queue.txt")
            ids = []
            if os.path.exists(qp):
                ids = sorted({x.strip() for x in open(qp, encoding="utf-8") if VID_RE.match(x.strip())})
            if ids and not engines_busy():
                open(qp, "w").close()
                save_state(launch_ts=time.time())  # spawn 전 예약(락)
                subprocess.Popen([os.path.join(SKILL, c.get("runner", "run_job.sh")), "--only", ",".join(ids)],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                 start_new_session=True)
            self._back(); return
        # ── v3: 발사대 라우트 (전부 서버측 잠금) ──
        if u.path == "/set-machine":
            m = (parse_qs(u.query).get("m") or ["mac"])[0]
            if m in MACHINES: save_state(machine=m)
            self._back(); return
        if u.path == "/notice-clear":
            save_state(notice=""); self._back(); return
        if u.path == "/launch-reset":
            save_state(scan=None, notice=""); self._back(); return
        if u.path == "/scan-start":
            url = (parse_qs(u.query).get("url") or [""])[0].strip()
            st = load_state()
            if engines_busy():
                save_state(notice="🔒 전사 작업 중엔 새 조회를 막아뒀어 — 끝나고 눌러줘.")
            elif (st.get("scan") or {}).get("status") == "scanning":
                save_state(notice="이미 조회 중이야 — 잠깐만.")
            elif not (url.startswith("http") and ("youtube.com" in url or "youtu.be" in url) and len(url) < 300):
                save_state(notice="유튜브 링크가 아닌 것 같아 — 다시 확인해줘.")
            else:
                t0 = time.time()
                save_state(scan=dict(status="scanning", url=url, t=t0), notice="")
                threading.Thread(target=scan_worker, args=(url, t0), daemon=True).start()
            self._back(); return
        if u.path == "/launch":
            mode = (parse_qs(u.query).get("mode") or [""])[0]
            st = load_state()
            if engines_busy():
                save_state(notice="🔒 이미 전사가 돌고 있어 발사를 막았어 (동시 실행 = 메모리 폭발).")
            elif (st.get("scan") or {}).get("status") != "done":
                save_state(notice="먼저 [① 채널 확인]이 끝나야 해.")
            elif mode == "windows" or st.get("machine") == "windows":
                err = issue_windows_card()
                if err: save_state(notice="⚠️ " + err)
            elif mode in ("test3", "full", "member"):
                err = launch_mac(mode)
                if err: save_state(notice="⚠️ " + err)
            else:
                save_state(notice="알 수 없는 모드.")
            self._back(); return
        try:
            body = render(c).encode("utf-8")
        except Exception as e:
            body = ("<meta http-equiv=refresh content=10><pre>보드 오류: %s</pre>" % html.escape(repr(e))).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a): pass


if __name__ == "__main__":
    port = cfg().get("port", 8765)
    if "--port" in sys.argv:  # 시험용 인스턴스 (실보드 8765 무중단 검증)
        port = int(sys.argv[sys.argv.index("--port") + 1])
    HTTPServer(("127.0.0.1", port), H).serve_forever()
