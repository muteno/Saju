#!/usr/bin/env python3
# build-haeseolchaek.py — figjam_notes.json → 주제별 명리 해설책 HTML
# 원칙: 내용·말투는 운영자 노트 그대로. 스크립트는 구성·정렬·조각(#) 나누기·중복 제거만.
#   실행: python3 manse/tools/build-haeseolchaek.py
import json, re, html

SRC = "manse/db/figjam_notes.json"
OUT = "docs/reports/260712_명리_해설책.html"

# 주제 순서(입문 흐름) + 라벨 + 중립 소개(사실 문장만, 해석 창작 아님)
ORDER = [
 ("천간론", "천간 十干", "일간을 포함한 하늘의 열 글자 — 갑을병정무기경신임계의 물상과 심리."),
 ("지지론", "지지 十二支", "땅의 열두 글자 — 생지·왕지·고지, 지장간, 통근·투출의 이해."),
 ("십신", "십신 十神", "일간 기준 열 가지 관계(비겁·식상·재성·관성·인성)의 성정과 쓰임."),
 ("합충론", "합충 合沖", "삼합·방합·육합과 충·형·파·해·원진 — 글자 사이 끌림과 부딪힘."),
 ("궁위론", "궁위 宮位", "근묘화실 — 년·월·일·시 자리가 관장하는 삶의 영역."),
 ("십이운성", "십이운성 十二運星", "장생부터 양까지, 기운의 생로병사 열두 단계."),
 ("신살", "신살 神煞", "역마·도화·화개·공망 등 특수 상징."),
 ("격국패턴", "격국·조합 格局", "관인상생·재다신약·군겁쟁재·간여지동 등 판이 짜이는 형태."),
 ("용신론", "용신 用神", "억부·조후·통관 — 사주의 균형을 잡는 열쇠."),
]

def split_points(note):
    # FigJam의 '#1 ... #2 ...' 또는 ' #' 구분을 소항목으로
    parts = re.split(r"\s*#\d*\s*|\s+#\s+", note)
    parts = [p.strip(" ·-") for p in parts if p and p.strip(" ·-")]
    return parts if len(parts) > 1 else [note]

def main():
    data = json.load(open(SRC))["data"]
    total = sum(len(v) for v in data.values())
    secs = []
    toc = []
    for key, title, intro in ORDER:
        items = data.get(key, [])
        if not items:
            continue
        anchor = key
        toc.append(f'<li><a href="#{anchor}">{title}</a> <span class="c">{len(items)}</span></li>')
        cards = []
        for it in items:
            pts = split_points(it["note"])
            body = (f'<p>{html.escape(pts[0])}</p>' if len(pts) == 1
                    else '<ul>' + ''.join(f'<li>{html.escape(p)}</li>' for p in pts) + '</ul>')
            src = f'<span class="src">출처 {html.escape(it["source"])}</span>' if it.get("source") else ''
            cards.append(f'<div class="note">{body}{src}</div>')
        secs.append(f'<section id="{anchor}"><h2>{title}</h2><p class="intro">{intro}</p>{"".join(cards)}</section>')

    page = f"""<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>명리 해설책 — 본인 정리</title>
<style>
:root{{--ink:#f0eee9;--sub:#9a958c;--bg:#0f0f11;--card:#191a1d;--line:#2a2b2f;--accent:#d97757;--el:#d97757}}
@media (prefers-color-scheme:light){{:root{{--ink:#20201e;--sub:#6b6862;--bg:#f7f5f1;--card:#fff;--line:#e6e2da;--accent:#b85c3e}}}}
:root[data-theme="dark"]{{--ink:#f0eee9;--sub:#9a958c;--bg:#0f0f11;--card:#191a1d;--line:#2a2b2f;--accent:#d97757}}
:root[data-theme="light"]{{--ink:#20201e;--sub:#6b6862;--bg:#f7f5f1;--card:#fff;--line:#e6e2da;--accent:#b85c3e}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard',-apple-system,'Noto Sans KR',sans-serif;line-height:1.7}}
.wrap{{max-width:760px;margin:0 auto;padding:28px 18px 80px}}
header h1{{font-size:26px;margin:0 0 4px;letter-spacing:-0.01em}}
header h1 .god{{color:var(--accent);font-weight:800}}
header .sub{{color:var(--sub);font-size:13px}}
.opening{{background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 12%,var(--card)),var(--card));border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:16px;padding:18px 20px;margin:20px 0}}
.opening .lead{{font-size:15px;font-weight:600;margin:0 0 10px;line-height:1.65}}
.opening p{{margin:0 0 8px;font-size:13.5px}}
.opening .caveat{{color:var(--sub);font-size:12.5px;margin-top:10px}}
.opening b{{color:var(--accent)}}
.toc{{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:20px 0}}
.toc h3{{margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:var(--sub)}}
.toc ol{{margin:0;padding-left:18px;columns:2;column-gap:24px}}
.toc li{{margin:3px 0}} .toc a{{color:var(--ink);text-decoration:none}} .toc a:hover{{color:var(--accent)}}
.toc .c{{color:var(--sub);font-size:11px;font-variant-numeric:tabular-nums}}
section{{margin:34px 0}}
h2{{font-size:19px;border-bottom:2px solid var(--accent);display:inline-block;padding-bottom:3px;margin:0 0 4px}}
.intro{{color:var(--sub);font-size:13.5px;margin:0 0 14px}}
.note{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin:9px 0}}
.note p{{margin:0}} .note ul{{margin:0;padding-left:18px}} .note li{{margin:3px 0}}
.src{{display:block;margin-top:6px;font-size:11px;color:var(--sub)}}
footer{{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--sub);font-size:12px}}
</style>
<div class="wrap">
<header>
  <h1>클로드 <span class="god">神</span> 선생님의 요약</h1>
  <div class="sub">명리 해설책 · 강의 노트 {total}조각을 주제별로 엮음 · 전부 참고용</div>
</header>
<section class="opening">
  <p class="lead">흩어져 있던 강의 노트 {total}조각을, 클로드가 아홉 갈래로 다시 세웠다 — 글자 하나부터 판 전체까지 순서대로 읽히게.</p>
  <p>읽는 길은 이렇다. 먼저 <b>천간·지지</b>로 글자 자체의 성정을 익히고, <b>십신·합충</b>으로 글자 사이의 끌림과 부딪힘을 본다. 그다음 <b>궁위·운성·신살</b>로 자리와 기운의 흐름을 얹고, 마지막 <b>격국·용신</b>에서 판이 어떻게 짜이고 어디서 균형을 잡는지 종합한다.</p>
  <p class="caveat">모든 내용은 참고용. 맥락과 강약을 무시한 단정은 명리가 가장 경계하는 것 — 이 요약도 그 원칙 위에 선다.</p>
</section>
<nav class="toc"><h3>목차</h3><ol>{''.join(toc)}</ol></nav>
{''.join(secs)}
<footer>
  <b>내용·표현은 운영자 본인의 강의 정리</b>이고, 주제별 <b>구성·엮음은 클로드</b>입니다(‘神 선생님’은 애칭 😄).
  명시 인용만 출처 표기, 개인정보(팀원 실명 사주 명부) 제외, 모든 항목은 <b>참고용</b> — 맥락·강약을 무시한 단정은 금물.
  자동 생성: manse/tools/build-haeseolchaek.py.
</footer>
</div>"""
    open(OUT, "w").write(page)
    print(f"해설책 생성: {OUT} · {total}노트 · {len(secs)}장 · {len(page)//1024}KB")

if __name__ == "__main__":
    main()
