# -*- coding: utf-8 -*-
"""
사주 정제 프로젝트 — 통합 저장소 + 현황판 생성기
  1) P0_인벤토리의 배치 산출물을 한곳(data/)으로 병합
  2) 원본 커버리지·전사 공장 진행을 실측
  3) 현황판.html 을 생성 (브라우저로 열면 끝)

사용:  python build_dashboard.py     (또는 현황판_갱신.bat 더블클릭)
"""
import json, re, glob, os, html, unicodedata
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
REFINE = HERE.parent                      # 2. 정제작업
ROOT = REFINE.parent                      # 3. 사주
INV = REFINE / "P0_인벤토리"
DATA = HERE / "data"
DATA.mkdir(parents=True, exist_ok=True)

SUBJ_NAME = {
    "S01": "음양·오행", "S02": "천간", "S03": "지지·지장간", "S04": "합충형파해",
    "S05": "십성·육친", "S06": "신살", "S07": "십이운성", "S08": "강약·격국·구조",
    "S09": "용신", "S10": "대운·세운·운해석", "S11": "상담론·화법·윤리", "S12": "역사·이론사·기타",
}
KIND_NAME = {
    "이론": "이론 (개념·원리)", "사례": "사례 (실제 명식 풀이)", "화법": "화법 (상담 말투·질문)",
    "고전": "고전 (원문 인용·번역)", "개운": "개운 (생활 처방)", "운세": "운세 (연운·월운)",
    "공지": "공지 (안내·가격)", "잡동": "잡동 (목차·인사말)",
}
FLAG_NAME = {
    "결정론": ("규칙·공식", "엔진으로 맞는지 검증할 수 있는 주장"),
    "별점": ("증류 우선 후보", "먼저 다뤄야 할 알짜 문단"),
    "게이트": ("금지 규칙", "앱이 하면 안 되는 말"),
    "실명명식": ("실존 인물 사례", "역추론 시험문제 후보"),
    "수치": ("숫자·비율", "정량 데이터"),
    "프로브": ("질문 원형", "사용자에게 물어볼 질문 재료"),
    "오전사후보": ("전사 오류 후보", "받아쓰기가 틀린 단어"),
    "병존": ("병존 이론", "같은 글자 나란히 붙은 해석"),
    "적천수": ("적천수 인용", "고전 원문"),
    "하건충": ("하건충 이론", "대만 학자 관법"),
    "개인정보": ("개인정보", "색인에서 제외"),
    "확인필요": ("재확인 필요", "판단 보류"),
}

# ─────────────────────────── 1. 배치 산출물 병합
def merge():
    posts, paras, batches = [], [], []
    for f in sorted(INV.glob("*_posts.jsonl")):
        b = f.name.replace("_posts.jsonl", "")
        batches.append(b)
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line); r["batch"] = b; posts.append(r)
    for f in sorted(INV.glob("*_paras.jsonl")):
        b = f.name.replace("_paras.jsonl", "")
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line); r["batch"] = b; paras.append(r)
    with (DATA / "posts_all.jsonl").open("w", encoding="utf-8") as fp:
        for r in posts: fp.write(json.dumps(r, ensure_ascii=False) + "\n")
    with (DATA / "paras_all.jsonl").open("w", encoding="utf-8") as fp:
        for r in paras: fp.write(json.dumps(r, ensure_ascii=False) + "\n")
    return posts, paras, sorted(set(batches))

# ─────────────────────────── 2. 원본 커버리지
def coverage(posts):
    """원본 커버리지.

    ⚠★260725 수리 — 이 함수가 **새 세션이 가장 먼저 여는 화면에 거짓말을 렌더**하고 있었다.
      현황판이 "웹 0/76 · 전사 0/246 · 잔여 246편"을 띄웠는데
      진실은 웹 57/76 · 도화도레 246/246 · 초코 249 · 산책처럼 1,231 이다.
      원인 2가지:
        ① **전사 스냅샷을 `transcript_v1` 하나만 봤다.** 그 뒤에 생긴
           `transcript_choco_v1`(249) · `transcript_sanchaek_v1`(1,231)이 통째로 누락 →
           전사 총계가 246으로 굳었다(실제 P0 전사 입력은 1,726편).
        ② **NFC 미정규화.** 맥(NFD)에서 돌리면 파일명이 안 맞아 교집합이 0이 된다.
           형제 도구(`build_neuron_map`·`p0_global`)는 이미 고쳤는데
           **부팅 경로에 있는 이 파일만 안 고쳐져 있었다**(평의회 4차 O9 실측).
      → 두 형제와 같은 방식(스냅샷 자동 발견 + NFC)으로 통일한다.
    """
    nfc = lambda s: unicodedata.normalize("NFC", s or "")
    web_all = {nfc(p.name) for p in (INV / "webtxt_v1").glob("*.txt")}

    # 전사 스냅샷은 `transcript*_v1` 규칙으로 **자동 발견**한다(새 채널이 늘어도 따라간다).
    tr_by_snap, tr_all = {}, set()
    for d in sorted(INV.glob("transcript*_v1")):
        if not d.is_dir():
            continue
        names = {nfc(p.name) for p in d.glob("*.md")}
        if names:
            tr_by_snap[d.name] = names
            tr_all |= names

    used = {nfc(p.get("file")) for p in posts}
    hold = set()
    cat = INV / "_카탈로그_보류.jsonl"
    if cat.exists():
        for line in cat.read_text(encoding="utf-8").splitlines():
            if line.strip():
                hold.add(nfc(json.loads(line).get("file")))
    web_done = web_all & used
    tr_done = tr_all & used

    # ★자가 모순 검사 — 문단이 있는데 커버가 0이면 그건 결함이지 상태가 아니다.
    #   조용히 0을 렌더하는 대신 여기서 알린다(이 프로젝트 사고는 100% 조용한 오작동이었다).
    warn = []
    if posts and not web_done:
        warn.append(f"웹 커버 0인데 글 {len(posts)}편 존재 — 스냅샷 경로·정규화 확인")
    if posts and not tr_done and tr_all:
        warn.append(f"전사 커버 0인데 스냅샷 {len(tr_all)}편 존재 — 같은 원인 의심")

    return {
        "web_total": len(web_all), "web_done": len(web_done),
        "web_hold": len(web_all & hold), "web_todo": len(web_all - web_done - hold),
        "tr_total": len(tr_all), "tr_done": len(tr_done), "tr_todo": len(tr_all - tr_done),
        "tr_snapshots": {k: {"total": len(v), "done": len(v & used)}
                         for k, v in tr_by_snap.items()},
        "warn": warn,
    }

# ─────────────────────────── 3. 전사 공장
def factory():
    base = ROOT / "0. 전사프로그램" / "전사 내용"
    out = []
    if not base.exists():
        return out, []
    for d in sorted(base.iterdir()):
        if not d.is_dir():
            continue
        sub = next((s for s in d.iterdir() if s.is_dir() and s.name.endswith("_자막")), None)
        if sub is None:
            continue
        done = len(list(sub.glob("*.md")))
        total, eta, last, running = None, None, None, False
        logs = sorted(sub.glob("_whisper*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        if logs:
            txt = logs[0].read_text(encoding="utf-8", errors="ignore").splitlines()
            last = logs[0].stat().st_mtime
            for line in txt:
                m = re.search(r"대상 (\d+)개", line)
                if m: total = int(m.group(1))
            for line in reversed(txt[-80:]):
                m = re.search(r"남은 ([\d.]+)h", line)
                if m: eta = float(m.group(1)); break
            running = (datetime.now().timestamp() - last) < 1800
        out.append({"name": d.name, "done": done, "total": total, "eta": eta,
                    "running": running,
                    "last": datetime.fromtimestamp(last).strftime("%m-%d %H:%M") if last else "—"})
    queue = []
    qlog = base / "_전사큐_실행로그.log"
    if qlog.exists():
        for line in qlog.read_text(encoding="utf-8", errors="ignore").splitlines()[-40:]:
            if "════" in line or "⏳" in line or "▶" in line:
                queue.append(line.strip())
    return out, queue[-4:]

# ─────────────────────────── 4. HTML
def bar(pct, cls="ok"):
    return f'<div class="bar"><span class="{cls}" style="width:{max(0,min(100,pct)):.1f}%"></span></div>'

def render(posts, paras, batches, cov, chans, queue):
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    n_q = sum(1 for q in paras if q.get("quote"))
    au = Counter(p.get("author") for p in posts)
    # 저자 표기 통합
    merged = Counter()
    for k, v in au.items():
        merged["현묘" if k and "현묘" in k else (k or "미상")] += v
    kc = Counter(q.get("kind") for q in paras)
    sc = Counter(s for q in paras for s in q.get("subj", []) or [])
    fc = Counter(f for q in paras for f in q.get("flags", []) or [])
    fc_group = Counter()
    for k, v in fc.items():
        fc_group["유파 대립 (관점 병기)" if str(k).startswith("stance") else k] += v

    p0_done = cov["web_done"] + cov["tr_done"]
    p0_target = cov["web_done"] + cov["web_todo"] + cov["tr_total"]
    p0_pct = p0_done / p0_target * 100 if p0_target else 0

    stages = [
        ("W0", "용어·질문 사전", 100, "완료"),
        ("P0", "원본을 문단으로 썰기", p0_pct, f"{p0_done}/{p0_target} 파일"),
        ("P1", "색인·커버리지 지도", 0, "대기"),
        ("P2", "증류 (유닛 만들기)", 0, "대기"),
        ("P3", "검증 게이트", 0, "대기"),
        ("P4", "벤치마크·역추론 시험", 0, "대기"),
    ]

    def rows(counter, total, namemap=None, limit=None, desc=None):
        items = counter.most_common(limit)
        out = []
        for k, v in items:
            label = html.escape(str(namemap.get(k, k) if namemap else k))
            sub = ""
            if desc and k in desc:
                sub = f'<span class="sub">{html.escape(desc[k])}</span>'
            pct = v / total * 100 if total else 0
            out.append(f'<tr><td>{label}{sub}</td><td class="num">{v:,}</td>'
                       f'<td class="barcell">{bar(pct)}</td></tr>')
        return "\n".join(out)

    flag_desc = {k: v[1] for k, v in FLAG_NAME.items()}
    flag_name = {k: v[0] for k, v in FLAG_NAME.items()}

    stage_html = ""
    for code, name, pct, note in stages:
        state = "done" if pct >= 100 else ("run" if pct > 0 else "wait")
        stage_html += f"""<div class="stage {state}">
          <div class="scode">{code}</div><div class="sname">{name}</div>
          {bar(pct, 'ok' if pct>=100 else 'run')}
          <div class="snote">{html.escape(note)}</div></div>"""

    chan_html = ""
    for c in chans:
        tot = c["total"] or c["done"]
        pct = c["done"] / tot * 100 if tot else 0
        badge = '<span class="pill live">● 돌아가는 중</span>' if c["running"] else '<span class="pill idle">멈춤/완료</span>'
        eta = f'<span class="sub">남은 약 {c["eta"]:.1f}시간</span>' if c["eta"] and c["running"] else ""
        chan_html += f"""<div class="chan"><div class="chead"><b>{html.escape(c['name'])}</b>{badge}</div>
          <div class="cnum">{c['done']:,} <span class="sub">/ {tot:,}편</span></div>
          {bar(pct, 'run' if c['running'] else 'ok')}
          <div class="sub">최근 기록 {c['last']} {eta}</div></div>"""

    queue_html = "<br>".join(html.escape(q) for q in queue) or "대기 큐 없음"

    todo = [
        ("도화도레 전사 191편 문단화", "정제 다음 순서 — 246편 중 55편만 들어옴", "정제"),
        ("6번 폴더 ix_ 파일 4개 처리 방침", "파일명 깨진 채 반입됨 — 쓸지 말지 결정 필요", "결정"),
        ("보류군 19파일 (토정비결·구성학 등)", f"{cov['web_hold']}개 파일 좌표만 보존 — 넣을지 결정 필요", "결정"),
        ("초코서당 전문가 등급 승급", "잔여 30편이 등급 때문에 막힘", "결정"),
        ("P1 색인·히트맵 착수", "P0 끝나면 바로", "정제"),
    ]
    todo_html = "".join(
        f'<tr><td><b>{html.escape(t)}</b><span class="sub">{html.escape(d)}</span></td>'
        f'<td><span class="pill {"live" if k=="결정" else "idle"}">{k}</span></td></tr>'
        for t, d, k in todo)

    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>사주 정제 현황판</title><style>
*{{box-sizing:border-box}}
body{{margin:0;padding:28px 20px 60px;font-family:'Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif;
 background:#f6f7f9;color:#1a1c20;line-height:1.5}}
.wrap{{max-width:1180px;margin:0 auto}}
h1{{font-size:26px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 12px;padding-bottom:8px;border-bottom:2px solid #e3e6ea}}
.top{{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px}}
.sub{{display:block;font-size:12px;color:#6b7280;font-weight:400;margin-top:2px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}}
.card{{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:14px 16px}}
.card .n{{font-size:30px;font-weight:700;letter-spacing:-.5px}}
.card .l{{font-size:12px;color:#6b7280;margin-top:2px}}
.stages{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}}
.stage{{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:12px 14px}}
.stage.done{{border-color:#86efac;background:#f0fdf4}} .stage.run{{border-color:#93c5fd;background:#eff6ff}}
.scode{{font-size:12px;font-weight:700;color:#6b7280}} .sname{{font-weight:600;margin:2px 0 8px;font-size:14px}}
.snote{{font-size:12px;color:#6b7280;margin-top:6px}}
.bar{{height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden}}
.bar span{{display:block;height:100%;border-radius:99px}}
.bar .ok{{background:#22c55e}} .bar .run{{background:#3b82f6}}
table{{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e6ea;border-radius:12px;overflow:hidden}}
td{{padding:9px 14px;border-top:1px solid #eef0f3;vertical-align:middle;font-size:14px}}
tr:first-child td{{border-top:none}}
.num{{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;width:90px}}
.barcell{{width:38%}}
.grid2{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px}}
.chan{{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:14px 16px}}
.chead{{display:flex;justify-content:space-between;align-items:center;gap:8px}}
.cnum{{font-size:22px;font-weight:700;margin:6px 0 8px}}
.pill{{font-size:11px;padding:3px 9px;border-radius:99px;font-weight:600}}
.pill.live{{background:#dbeafe;color:#1d4ed8}} .pill.idle{{background:#f1f5f9;color:#64748b}}
.note{{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:14px 16px;font-size:13px;color:#4b5563}}
code{{background:#f1f5f9;padding:1px 6px;border-radius:5px;font-size:12px}}
.gonext{{display:inline-block;text-decoration:none;font-size:13px;font-weight:600;color:#1d4ed8;
 background:#dbeafe;padding:7px 14px;border-radius:9px;margin-bottom:6px}}
@media(prefers-color-scheme:dark){{
 body{{background:#0f1114;color:#e5e7eb}} h2{{border-color:#262b33}}
 .card,.stage,table,.chan,.note{{background:#171a1f;border-color:#262b33}}
 .stage.done{{background:#0f2418;border-color:#166534}} .stage.run{{background:#0f1d33;border-color:#1e40af}}
 td{{border-color:#22262e}} .bar{{background:#262b33}} .sub,.card .l,.snote{{color:#9ca3af}}
 .pill.idle{{background:#22262e;color:#9ca3af}} .pill.live{{background:#1e3a8a;color:#bfdbfe}}
 code{{background:#22262e}}}}
</style></head><body><div class="wrap">

<div class="top"><div><h1>🗂 사주 정제 현황판</h1>
<span class="sub">원본 라이브러리 → 문단 창고 → 지식 유닛. 지금 어디까지 왔는지 한눈에.</span></div>
<div style="text-align:right"><a class="gonext" href="개념지도.html">🧭 개념 지도 열기 →</a>
<span class="sub">갱신 {now}</span></div></div>

<h2>1. 전체 공정 — 어디까지 왔나</h2>
<div class="stages">{stage_html}</div>

<h2>2. 정제 창고 — 지금까지 쌓인 것</h2>
<div class="cards">
 <div class="card"><div class="n">{len(posts):,}</div><div class="l">글 (원본 게시물)</div></div>
 <div class="card"><div class="n">{len(paras):,}</div><div class="l">문단 (썰어놓은 조각)</div></div>
 <div class="card"><div class="n">{n_q:,}</div><div class="l">인용문 (원문 검증 통과)</div></div>
 <div class="card"><div class="n">{len(batches)}</div><div class="l">배치 (작업 단위)<br><span class="sub" style="display:inline">리포트 완결 {sum(1 for b in batches if (INV / (b + '_report.md')).exists())} · 전사 부분 {sum(1 for b in batches if not (INV / (b + '_report.md')).exists())}</span></div></div>
 <div class="card"><div class="n">{len(set(p.get('file') for p in posts))}</div><div class="l">커버한 원본 파일</div></div>
</div>
<div class="grid2">
 <div><b>저자별</b><span class="sub">누구 말이 얼마나 쌓였나</span>
  <table>{rows(merged, len(posts))}</table></div>
 <div><b>글 성격별</b><span class="sub">문단이 어떤 종류인가</span>
  <table>{rows(kc, len(paras), KIND_NAME)}</table></div>
</div>
<div class="grid2" style="margin-top:16px">
 <div><b>과목별</b><span class="sub">사주 어느 분야를 다루나</span>
  <table>{rows(sc, sum(sc.values()), SUBJ_NAME)}</table></div>
 <div><b>쓸모별 표시</b><span class="sub">나중에 어디 쓸지 미리 찍어둔 것</span>
  <table>{rows(fc_group, len(paras), flag_name, 12, flag_desc)}</table></div>
</div>

<h2>3. 원본 커버리지 — 얼마나 남았나</h2>
<div class="grid2">
 <div class="chan"><div class="chead"><b>웹 스크랩 (76개 문서)</b><span class="pill idle">사실상 완료</span></div>
  <div class="cnum">{cov['web_done']} <span class="sub">/ {cov['web_total']}개 처리</span></div>
  {bar(cov['web_done']/cov['web_total']*100 if cov['web_total'] else 0)}
  <div class="sub">보류 {cov['web_hold']}개(타 술수·매뉴얼) · 미처리 {cov['web_todo']}개</div></div>
 <div class="chan"><div class="chead"><b>도화도레 전사 (246편)</b><span class="pill live">다음 작업</span></div>
  <div class="cnum">{cov['tr_done']} <span class="sub">/ {cov['tr_total']}편 처리</span></div>
  {bar(cov['tr_done']/cov['tr_total']*100 if cov['tr_total'] else 0, 'run')}
  <div class="sub">잔여 {cov['tr_todo']}편 — 지난번 사용 한도로 중단</div></div>
</div>

<h2>4. 전사 공장 — 유튜브 받아쓰기 (백그라운드)</h2>
<div class="grid2">{chan_html}</div>
<div class="note" style="margin-top:12px"><b>대기 큐</b><br>{queue_html}</div>

<h2>5. 지금 할 일 / 결정 대기</h2>
<table>{todo_html}</table>

<h2>6. 이 현황판은</h2>
<div class="note">
 자동 생성물이다. <code>현황판_갱신.bat</code> 더블클릭하면 최신 수치로 다시 그린다.<br>
 데이터 원천 = <code>P0_인벤토리\\</code>의 배치 산출물 + 전사 폴더 실측.
 병합본은 <code>_현황판\\data\\posts_all.jsonl · paras_all.jsonl</code>에 모아둔다.
</div>
</div></body></html>"""

# ─────────────────────────── main
if __name__ == "__main__":
    posts, paras, batches = merge()
    cov = coverage(posts)
    chans, queue = factory()
    (HERE / "현황판.html").write_text(render(posts, paras, batches, cov, chans, queue), encoding="utf-8")
    stats = {
        "생성시각": datetime.now().isoformat(timespec="seconds"),
        "배치": len(batches), "글": len(posts), "문단": len(paras),
        "인용": sum(1 for q in paras if q.get("quote")), "커버리지": cov,
        "전사공장": chans,
    }
    (DATA / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[완료] 글 {len(posts):,} · 문단 {len(paras):,} · 배치 {len(batches)}")
    print(f"  → {HERE / '현황판.html'}")
