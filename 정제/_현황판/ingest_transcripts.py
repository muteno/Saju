# -*- coding: utf-8 -*-
"""
전사 적재기 — 유튜브 Whisper 전사본을 웹 코퍼스와 **같은 모양**으로 넣는다.

═══ 왜 이걸 짜는가 (260726 발견) ═══
  운영자: "그 관계맵의 소스는 정제한 웹 / 그리고 전사한 유튜브 내용에서 오는거임"
  그런데 실측하니 posts_all.jsonl 3,845건 중 **전사는 3건**이었다.
  전사 폴더 실물은 **3,522 파일 · 약 57 MB** — 웹 코퍼스(5.4 MB)의 **10배**.
  즉 관계지도는 지시받은 두 소스 중 큰 쪽을 통째로 안 먹고 있었다.
  F6 조건분기 174건이 **100% 웹**에서만 나온 것도 이 때문이다.

═══ 전사가 웹과 다른 세 가지 ═══
  ① 문장부호가 없다 — Whisper가 숨 쉬는 자리에서 줄을 끊는다. 줄 = 문장이 아니다.
     → 줄을 다 이어붙인 뒤 **한국어 종결어미**(요/죠/다/까/네/습니다…)로 다시 끊는다.
  ② 붕괴(degeneration) — 무음·음악 구간에서 같은 구절을 수십 번 반복 출력한다.
     석우당 첫 파일이 「이제는」을 수십 회 뱉는다. 안 막으면 빈도 통계가 통째로 오염된다.
  ③ 오전사 — 청간(천간)·음향(음양)·초코맥류(초코명리)처럼 소리가 비슷한 말로 튄다.
     → 여기서 고치지 않는다. **표시만 하고 원문 보존.** 교정은 마커 층에서 한다.

═══ 원칙 ═══
  · **본문을 담는다 — 여기만 P0 포인터 규약을 못 지킨다.** 이유를 적어 둔다:
    웹은 `file` + `lines`로 되짚으면 같은 문단이 그대로 나온다. 전사는 안 나온다.
    줄을 잇고 → 붕괴를 접고 → 종결어미로 다시 끊는 세 단계를 거쳐야 문단이 되므로,
    포인터로 되짚으려면 **이 파이프라인을 똑같이 재실행해야** 한다. 그러면 포인터가
    가리키는 대상이 코드 버전에 따라 달라진다 — 그건 포인터가 아니다.
    대가는 `전사_문단.jsonl` 약 60 MB. 대신 `post_id`로 원본 `.md`를 항상 되짚을 수 있게
    `전사_글.jsonl`에 `file`을 남긴다. **원본이 정본이고 이 파일은 파생물이다.**
  · 보류군 표시 — 작명 채널은 `보류군: true`. 지우지 않고 **표시**한다(키셋이 다를 뿐).
  · 저자·채널명은 적재 단계에선 남긴다. 노출 금지는 산출물 층의 규칙이고,
    여기서 지우면 중복 판정과 채널별 편향 측정을 못 한다.

출력: data/전사_글.jsonl · data/전사_문단.jsonl · data/전사_적재리포트.md
"""
import json, re, sys, unicodedata, hashlib
from pathlib import Path
from collections import Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
ROOT = HERE.parent.parent / "0. 전사프로그램" / "전사 내용"

HOLD_CH = re.compile(r"작명")          # 보류군: 키셋이 다른 술수
HDR_END = re.compile(r"^-{3,}\s*$")
FIELD = re.compile(r"^-\s*\*\*(.+?):\*\*\s*(.*)$")
# 한국어 구어 종결 — 부호가 없어도 여기서 문장이 끝난다
EOS = re.compile(
    r"(?<=[가-힣])(?:습니다|ㅂ니다|입니다|됩니다|합니다|겠습니다|"
    r"거든요|는데요|네요|군요|잖아요|더라고요|에요|예요|어요|아요|해요|이요|"
    r"죠|지요|구요|고요|까요|을까|나요|는가|는다|한다|된다|이다|다만|"
    r"세요|십시오|보죠|보세요)(?=\s|$)")
DEGEN_MIN = 4                          # 같은 구절 4회 연속이면 붕괴로 본다


def strip_degen(lines):
    """연속 반복 구절을 접는다. 몇 줄을 접었는지 함께 돌려준다."""
    out, folded, prev, run = [], 0, None, 0
    for ln in lines:
        k = re.sub(r"\s+", "", ln)
        if k and k == prev:
            run += 1
            if run >= DEGEN_MIN - 1:
                folded += 1
                continue
        else:
            prev, run = k, 0
        out.append(ln)
    # 한 줄 안에서 같은 어절이 반복되는 경우도 접는다
    fixed = []
    for ln in out:
        w = ln.split()
        if len(w) >= 8:
            comp, run2 = [], 0
            for i, t in enumerate(w):
                if i and t == w[i - 1]:
                    run2 += 1
                    if run2 >= 2:
                        folded += 1
                        continue
                else:
                    run2 = 0
                comp.append(t)
            ln = " ".join(comp)
        fixed.append(ln)
    return fixed, folded


def sentences(text):
    """부호 없는 구어를 종결어미로 끊는다."""
    text = re.sub(r"\s+", " ", text).strip()
    cuts, pos = [], 0
    for m in EOS.finditer(text):
        cuts.append(text[pos:m.end()].strip())
        pos = m.end()
    if pos < len(text):
        cuts.append(text[pos:].strip())
    return [c for c in cuts if c]


posts, paras, stat = [], [], Counter()
chan_stat = Counter()

for md in sorted(ROOT.rglob("*.md")):
    raw = md.read_text(encoding="utf-8-sig", errors="ignore")
    raw = unicodedata.normalize("NFC", raw)
    lines = raw.splitlines()
    meta, body_at = {}, 0
    for i, ln in enumerate(lines[:30]):
        f = FIELD.match(ln.strip())
        if f:
            meta[f.group(1).strip()] = f.group(2).strip()
        if HDR_END.match(ln) and i > 2:
            body_at = i + 1
            break
    if not body_at:
        stat["헤더없음"] += 1
        continue
    title = lines[0].lstrip("#").strip() if lines and lines[0].startswith("#") else md.stem
    chan = meta.get("채널", md.parts[-2].replace("_자막", ""))
    body_lines = [l.strip() for l in lines[body_at:] if l.strip() and not l.startswith(">")]
    body_lines, folded = strip_degen(body_lines)
    body = " ".join(body_lines)
    if len(body) < 300:
        stat["본문짧음"] += 1
        continue

    vid = (re.search(r"v=([\w-]{6,})", meta.get("URL", "")) or [None, md.stem[-11:]])[1]
    pid = "T-" + hashlib.md5(str(vid).encode()).hexdigest()[:10]
    hold = bool(HOLD_CH.search(chan) or HOLD_CH.search(str(md.parent)))
    rel = str(md.relative_to(ROOT)).replace("\\", "/")

    sents = sentences(body)
    # 문단 = 종결어미 6개 묶음 (웹의 문단 크기와 맞춘다)
    CH = 6
    n_par = 0
    for j in range(0, len(sents), CH):
        chunk = sents[j:j + CH]
        t = " ".join(chunk)
        if len(t) < 60:
            continue
        paras.append({"para_id": f"{pid}-{n_par:04d}", "post_id": pid,
                      "kind": "전사", "gist": "", "text": t,
                      "sent_from": j, "sent_to": j + len(chunk)})
        n_par += 1

    posts.append({"post_id": pid, "file": rel, "title": title,
                  "author": chan, "채널": chan, "출처": "전사",
                  "url": meta.get("URL", ""), "date": meta.get("업로드", ""),
                  "길이": meta.get("길이", ""), "조회수": meta.get("조회수", ""),
                  "보류군": hold, "본문길이": len(body),
                  "붕괴접음": folded, "문단수": n_par})
    stat["적재"] += 1
    stat["보류군"] += int(hold)
    stat["붕괴있음"] += int(folded > 0)
    chan_stat[chan] += 1

DATA.mkdir(exist_ok=True)
(DATA / "전사_글.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in posts) + "\n", encoding="utf-8")
(DATA / "전사_문단.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in paras) + "\n", encoding="utf-8")

tot = sum(p["본문길이"] for p in posts)
rep = ["# 전사 적재 리포트", "",
       f"- 영상 **{len(posts)}** · 문단 **{len(paras)}** · 본문 **{tot:,}자**",
       f"- 보류군(작명) {stat['보류군']} · 붕괴 접은 글 {stat['붕괴있음']} · 건너뜀 "
       f"(헤더없음 {stat['헤더없음']} / 본문짧음 {stat['본문짧음']})",
       "", "## 채널별", "", "| 채널 | 영상 | 문단 | 본문자수 |", "|---|---:|---:|---:|"]
for ch, n in chan_stat.most_common():
    ps = [p for p in posts if p["채널"] == ch]
    rep.append(f"| {ch} | {n} | {sum(p['문단수'] for p in ps):,} | {sum(p['본문길이'] for p in ps):,} |")
(DATA / "전사_적재리포트.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

print(f"영상 {len(posts)} · 문단 {len(paras):,} · 본문 {tot:,}자")
print(f"보류군 {stat['보류군']} · 붕괴 접은 글 {stat['붕괴있음']} · "
      f"건너뜀 헤더없음 {stat['헤더없음']} 짧음 {stat['본문짧음']}")
for ch, n in chan_stat.most_common():
    print(f"   {ch:22s} {n:5d}")
