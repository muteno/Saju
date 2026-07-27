# -*- coding: utf-8 -*-
"""
진행판 — 세션이 바뀌어도 «지금 어디까지 왔는지»가 남는 자리.

운영자 260728: *"진행중인 프로그레스를 시각화 해서 좀 알려줘야할듯..;
  세션단위 작업이아니라서 공용 html 만들고 그걸 항상 공유하게 해."*

왜 있나: 이 프로젝트는 세션이 바뀌면 상태가 통째로 휘발된다. 인계문이 그걸 막지만
  글이라 «지금 몇 %»가 안 보인다. 그래서 **리포에 있는 것만 세서** 그림으로 낸다.

무엇을 세나 (전부 리포 실물 — 사람이 손으로 적는 칸은 없다):
  ① 전사   `정제/원본/전사/<채널>/*.md` 개수 · 채널 총량은 아래 표
  ② 녹임   반입 산출물(P0·전사·문서류) 파일 수
  ③ 정제   `data/` 산출물의 노드·관계·문단 수
  ④ 앱     `app/public/brain.json`의 노드·관계·조견표
  ⑤ 단계   파이프라인 35단계의 낡음 상태(허브.html과 같은 판정)

⚠D2-1 — 이 파일이 만드는 `진행판.html`은 **생성물이다. 손으로 고치지 마라.**
  값이 틀리면 여기를 고쳐서 다음 실행이 다시 그리게 한다.
"""
import json, subprocess, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import 경로

KST = timezone(timedelta(hours=9))          # D4 — 전부 KST
OUT = 경로.현황판 / "진행판.html"

# 채널 총량 — 유튜브에 올라온 편수(전사 대상 모수). 출처 = 수집 명세·board_config.
#   ⚠늘어나면 여기를 고친다(채널이 새 영상을 올리면 모수가 는다).
채널총량 = {
    "1. 초코명리": 279, "2. 산책처럼사주": 1231, "3. 석우당": 977,
    "4. 사람공부": 146, "5. 효명작명": 537, "6. 남석운명과명리학": 2473,
    "7. 정이철학원(부산 대청동 이길우)": 218, "8. 하나사주": 188,
    "도화도레_사주": 259, "0. 단편모음": 2,
}


def 전사현황():
    본거 = 경로.원본 / "전사"
    행 = []
    for d in sorted(p for p in 본거.iterdir() if p.is_dir()) if 본거.exists() else []:
        회수 = sum(1 for _ in d.rglob("*.md"))
        총 = 채널총량.get(d.name)
        행.append({"채널": d.name, "회수": 회수, "총량": 총,
                   "비율": (회수 / 총 * 100) if 총 else None})
    return 행


def 파일수(p: Path, 패턴="*"):
    return sum(1 for q in p.rglob(패턴) if q.is_file()) if p.exists() else 0


def 녹임현황():
    원본, 정제 = 경로.원본, 경로.정제
    return [
        ("전사 원문", 파일수(원본 / "전사", "*.md")),
        ("P0 인벤토리", 파일수(원본 / "P0_인벤토리")),
        ("전사 도구", 파일수(원본 / "전사도구")),
        ("원본 라이브러리", 파일수(원본 / "라이브러리")),
        ("설계정본", 파일수(정제 / "문서" / "설계정본")),
        ("평의회결과", 파일수(정제 / "문서" / "평의회결과")),
        ("인수인계", 파일수(정제 / "문서" / "인수인계")),
        ("통독노트", 파일수(정제 / "문서" / "통독노트")),
        ("역추론 작업큐", 파일수(정제 / "문서" / "역추론_작업큐")),
        ("P2 유닛", 파일수(정제 / "P2_유닛")),
    ]


def 지도현황():
    d = 경로.현황판 / "data"
    값 = {}
    try:
        노드 = [l for l in (d / "neuron_nodes.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        값["노드"] = len(노드)
    except Exception:
        값["노드"] = None
    try:
        값["관계"] = sum(1 for l in (d / "neuron_edges.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())
    except Exception:
        값["관계"] = None
    try:
        값["문단"] = json.loads((d / "stats.json").read_text(encoding="utf-8")).get("문단")
    except Exception:
        값["문단"] = None
    return 값


def 앱현황():
    p = 경로.뿌리 / "app" / "public" / "brain.json"
    if not p.exists():
        return None
    try:
        b = json.loads(p.read_text(encoding="utf-8"))
        return {"노드": len(b.get("노드", {})), "관계": len(b.get("관계", [])),
                "조견표": len(b.get("조견표", [])), "크기": p.stat().st_size}
    except Exception:
        return None


def 최근커밋(n=8):
    try:
        out = subprocess.run(["git", "log", f"-{n}", "--format=%h|%ad|%s", "--date=format:%m-%d %H:%M"],
                             cwd=경로.뿌리, capture_output=True, text=True, timeout=20).stdout
        return [l.split("|", 2) for l in out.splitlines() if "|" in l]
    except Exception:
        return []


def 막대(비율, 폭=180):
    v = 0 if 비율 is None else max(0, min(100, 비율))
    색 = "#2e7d32" if v >= 95 else "#f9a825" if v >= 50 else "#c62828"
    return (f'<div class="bar"><i style="width:{v/100*폭:.0f}px;background:{색}"></i></div>'
            f'<span class="pct">{"—" if 비율 is None else f"{v:.0f}%"}</span>')


def 그리기():
    전사, 녹임, 지도, 앱 = 전사현황(), 녹임현황(), 지도현황(), 앱현황()
    회수합 = sum(r["회수"] for r in 전사)
    총합 = sum(r["총량"] for r in 전사 if r["총량"])
    이제 = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")

    행들 = "".join(
        f'<tr><td>{r["채널"]}</td><td class="n">{r["회수"]:,}</td>'
        f'<td class="n">{r["총량"]:,}</td>' if r["총량"] else
        f'<tr><td>{r["채널"]}</td><td class="n">{r["회수"]:,}</td><td class="n">—</td>'
        for r in 전사)
    # 위 한 줄 표현이 갈리므로 안전하게 다시 만든다
    행들 = ""
    for r in 전사:
        총 = f'{r["총량"]:,}' if r["총량"] else "—"
        행들 += (f'<tr><td>{r["채널"]}</td><td class="n">{r["회수"]:,}</td>'
                 f'<td class="n">{총}</td><td>{막대(r["비율"])}</td></tr>')

    녹임행 = "".join(f'<tr><td>{k}</td><td class="n">{v:,}</td></tr>' for k, v in 녹임)
    커밋행 = "".join(f'<tr><td class="mono">{h}</td><td class="mono">{d}</td><td>{s[:78]}</td></tr>'
                   for h, d, s in 최근커밋())
    앱줄 = ("—" if not 앱 else
            f'노드 {앱["노드"]:,} · 관계 {앱["관계"]:,} · 조견표 {앱["조견표"]:,} · {앱["크기"]/1024/1024:.2f}MB')

    html = f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<title>사주 정제 — 진행판</title>
<style>
 body{{font:14px/1.6 -apple-system,'Segoe UI',sans-serif;margin:0;padding:28px;background:#fbfaf8;color:#23201c}}
 h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:15px;margin:26px 0 8px;color:#6b5f52}}
 .sub{{color:#8a7f73;font-size:12px;margin-bottom:18px}}
 table{{border-collapse:collapse;width:100%;max-width:860px;background:#fff;
        box-shadow:0 1px 2px rgba(0,0,0,.06);border-radius:6px;overflow:hidden}}
 th,td{{padding:7px 11px;border-bottom:1px solid #f0ece6;text-align:left}}
 th{{background:#f6f3ee;font-weight:600;font-size:12px;color:#6b5f52}}
 td.n{{text-align:right;font-variant-numeric:tabular-nums}}
 .mono{{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#8a7f73}}
 .bar{{display:inline-block;width:180px;height:8px;background:#eee6dc;border-radius:4px;vertical-align:middle}}
 .bar i{{display:block;height:8px;border-radius:4px}}
 .pct{{margin-left:8px;font-size:12px;color:#6b5f52;font-variant-numeric:tabular-nums}}
 .cards{{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 0}}
 .card{{background:#fff;border-radius:6px;padding:12px 16px;min-width:150px;
        box-shadow:0 1px 2px rgba(0,0,0,.06)}}
 .card b{{display:block;font-size:22px;font-variant-numeric:tabular-nums}}
 .card span{{font-size:12px;color:#8a7f73}}
 .note{{color:#8a7f73;font-size:12px;margin-top:8px;max-width:860px}}
</style>
<h1>사주 정제 — 진행판</h1>
<div class="sub">{이제} · 이 파일은 <b>생성물</b>이다(손으로 고치지 마라). 다시 그리기 =
 <span class="mono">python3 정제/_현황판/build_진행판.py</span></div>

<div class="cards">
  <div class="card"><b>{회수합:,}</b><span>전사 회수(편)</span></div>
  <div class="card"><b>{회수합/총합*100:.0f}%</b><span>전사 진척(모수 {총합:,})</span></div>
  <div class="card"><b>{지도["노드"] or "—"}</b><span>개념 노드</span></div>
  <div class="card"><b>{f'{지도["관계"]:,}' if 지도["관계"] else "—"}</b><span>관계(간선)</span></div>
  <div class="card"><b>{f'{지도["문단"]:,}' if 지도["문단"] else "—"}</b><span>코퍼스 문단</span></div>
</div>

<h2>① 전사 — 채널별 회수</h2>
<table><tr><th>채널</th><th>회수</th><th>모수</th><th>진척</th></tr>{행들}</table>
<div class="note">⚠모수는 유튜브 게시 편수라 채널이 새로 올리면 는다. 값은
 <span class="mono">build_진행판.py</span>의 <span class="mono">채널총량</span>에 있다.
 전사는 맥에서만 돈다(mlx-whisper = 애플 실리콘 전용) — 올리기 =
 <span class="mono">./scripts/전사본_올리기.sh</span></div>

<h2>② 녹임 — 리포에 들어온 재료</h2>
<table><tr><th>무엇</th><th>파일</th></tr>{녹임행}</table>

<h2>③ 앱에 붙은 두뇌</h2>
<table><tr><td>app/public/brain.json</td><td>{앱줄}</td></tr></table>

<h2>④ 최근 작업</h2>
<table><tr><th>커밋</th><th>때</th><th>무엇</th></tr>{커밋행}</table>

<div class="note">파이프라인 단계별 낡음 상태는
 <span class="mono">허브.html</span>에 있다. 여기는 «얼마나 모였나», 거기는 «무엇이 낡았나».</div>
</html>"""
    OUT.write_text(html, encoding="utf-8")
    print(f"→ {OUT}")
    print(f"   전사 {회수합:,}/{총합:,}편({회수합/총합*100:.1f}%) · 노드 {지도['노드']} · "
          f"관계 {지도['관계']} · 문단 {지도['문단']}")


if __name__ == "__main__":
    그리기()
