# -*- coding: utf-8 -*-
"""
★2차 전사 — 흩어진 문단을 «분류별로 다시 모은다».

═══ 운영자 지시 (260727) ═══
  *"웹에 일단 개념 다 있으니까 거기가 전사된 거잖아? 그 내용을 **분류별로 또 다시 모아**
   (2차 전사 느낌) 그리고 그 모은것에서 **핵심 요체를 뽑아내**(3차 전사)"*

  1차 = 원문(웹 스크랩·유튜브 전사) — 이미 있다.
  **2차 = 이 파일.** 한 개념에 대한 말이 20개 파일·9저자에 흩어져 있는 것을 **한자리에 모은다.**
  3차 = `build_essence.py` — 모은 것에서 요체를 뽑는다.

═══ 왜 «모으는 것»이 따로 필요한가 ═══
  지금 지도는 «개념 → 문단 색인»을 갖고 있지만 그건 **번호 목록**이다.
  사람도 기계도 「갑목에 대해 이 코퍼스가 뭐라 하나」를 한눈에 못 본다.
  ⚠그리고 흩어진 채로는 **저자 간 갈림**이 안 보인다 — 나란히 놓아야 보인다.

═══ 무엇을 «분류»로 삼는가 ═══
  ①개념(노드) ②대주제·중주제 ③저자 ④출처종(웹/전사/보드) ⑤kind(이론·사례·화법…)
  → 같은 개념 안에서 **저자별·출처별로 갈라 담는다.** 그래야 3차에서 판본 갈림이 드러난다.

═══ ⛔지키는 것 ═══
  · **본문만 쓴다.** `gist`(우리가 붙인 이름표)를 섞지 않는다 — 이 프로젝트가 이미 두 번 당했다.
  · **격자·보류군 제외**(코퍼스 기본 규칙). 보드는 «출처종=보드»로 갈라 담되 통계에는 안 섞는다.
  · **원문을 자르지 않는다.** 요약은 3차의 일이고 2차는 «모으기»다.

출력: data/2차_분류모음.jsonl  ·  _2차분류/{대주제}/{개념}.md  ·  data/2차_리포트.md
"""
import json, re, sys
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE / "_2차분류"
sys.path.insert(0, str(HERE))
import 코퍼스 as CP                # noqa: E402
from 작업내역 import 단계          # noqa: E402
import importlib.util as _ilu      # noqa: E402
_sp = _ilu.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = _ilu.module_from_spec(_sp); _sp.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()

MAX_MD = 60          # md 파일에 싣는 문단 수(사람이 읽는 용도) — jsonl에는 전량 들어간다


def main():
    lay = {json.loads(l)["concept"]: json.loads(l)
           for l in (DATA / "node_layers.jsonl").read_text(encoding="utf-8").split(chr(10))
           if l.strip()}
    posts = {}
    for l in (DATA / "posts_all.jsonl").read_text(encoding="utf-8").split(chr(10)):
        if l.strip():
            r = json.loads(l)
            posts[r["post_id"]] = r

    def author_of(pid, 출처종):
        p = pid.rsplit("-", 1)[0]
        r = posts.get(p) or posts.get(pid.rsplit("-", 2)[0])
        return (r or {}).get("author") or ("전사" if 출처종 == "전사" else
                                           "방법론 보드" if 출처종 == "보드" else "?")

    모음 = defaultdict(list)          # 개념 → [row]
    stat = Counter()
    # 보드까지 포함해 모은다(3차에서 조견표를 뽑을 때 보드가 최대 공급자다)
    for r in CP.문단들(보드=True):
        t = r.get("text") or ""
        if not t:
            continue
        cs = bnm.concepts_in(t)
        if not cs:
            stat["개념0"] += 1
            continue
        pid = str(r.get("para_id", ""))
        출처종 = r.get("출처종", "?")
        a = author_of(pid, 출처종)
        for c in cs:
            if c not in lay:
                continue
            모음[c].append({
                "para_id": pid, "저자": a, "출처종": 출처종,
                "kind": r.get("kind"), "제목": CP.가리기(str(r.get("title") or "")[:80]),
                # ⛔개인정보는 여기서 가린다 — jsonl과 md가 같은 t를 먹으므로 이 한 자리면 된다.
                #   산출물에서 사후 삭제하면 파이프라인 한 번에 되살아난다(260727 실증: 이메일 311건).
                "글자": len(t), "text": CP.가리기(t),
            })
            stat["행"] += 1

    # ── jsonl (전량) ────────────────────────────────────────────
    with (DATA / "2차_분류모음.jsonl").open("w", encoding="utf-8") as f:
        for c in sorted(모음):
            m = lay[c]
            f.write(json.dumps({
                "개념": c, "대주제": m.get("big"), "중주제": m.get("mid"),
                "문단수": len(모음[c]),
                "저자분포": dict(Counter(x["저자"] for x in 모음[c]).most_common()),
                "출처분포": dict(Counter(x["출처종"] for x in 모음[c])),
                "문단": 모음[c],
            }, ensure_ascii=False) + "\n")

    # ── md (사람이 읽는 것) — 대주제 폴더로 갈라 담는다 ──────────
    if OUT.exists():
        for p in OUT.rglob("*.md"):
            p.unlink()
    for c, rows in 모음.items():
        m = lay[c]
        big = re.sub(r"[\\/:*?\"<>|]", "_", str(m.get("big") or "기타"))
        d = OUT / big
        d.mkdir(parents=True, exist_ok=True)
        # 저자별로 묶고, 저자 안에서는 긴 문단(=설명이 두꺼운 것)부터
        by = defaultdict(list)
        for r in rows:
            by[r["저자"]].append(r)
        L = [f"# {c}", "",
             f"> {m.get('big')} › {m.get('mid')} · **문단 {len(rows):,}** · 저자 {len(by)}곳", "",
             "> ⚠**2차 전사물이다** — 흩어진 원문을 모으기만 했다. 요약·판단은 3차의 일이다.",
             "> ⛔여기 실린 것은 **원문**이다. 우리가 붙인 gist는 섞지 않았다.", ""]
        L.append("| 저자 | 문단 |")
        L.append("|---|---:|")
        for a, v in sorted(by.items(), key=lambda x: -len(x[1])):
            L.append(f"| {a} | {len(v):,} |")
        L.append("")
        shown = 0
        for a, v in sorted(by.items(), key=lambda x: -len(x[1])):
            L += [f"## {a} ({len(v):,}문단)", ""]
            for r in sorted(v, key=lambda x: -x["글자"]):
                if shown >= MAX_MD:
                    break
                L += [f"**[{r['para_id']}]** <sub>{r['출처종']} · {r['kind']} · {r['제목']}</sub>", "",
                      re.sub(r"\n{2,}", "\n", r["text"])[:1400], ""]
                shown += 1
            if shown >= MAX_MD:
                L += [f"> …이하 생략. **전량은 `data/2차_분류모음.jsonl`에 있다**"
                      f"(이 개념 {len(rows):,}문단 전부).", ""]
                break
        (d / f"{re.sub(r'[\\/:*?\"<>|]', '_', c)}.md").write_text("\n".join(L) + "\n",
                                                                  encoding="utf-8")

    # ── 리포트 ──────────────────────────────────────────────────
    tot = sum(len(v) for v in 모음.values())
    다저자 = sum(1 for v in 모음.values() if len({x['저자'] for x in v}) >= 5)
    L = ["# 2차 전사 — 분류별로 다시 모으기", "",
         "> 운영자: *\"그 내용을 **분류별로 또 다시 모아**(2차 전사 느낌)\"*", "",
         f"- 개념 **{len(모음)}** · (개념,문단) 쌍 **{tot:,}**",
         f"- 개념 0으로 떨어진 문단 {stat['개념0']:,}",
         f"- **저자 5곳 이상이 말하는 개념 {다저자}** — 여기가 판본 갈림이 보이는 자리다", "",
         "## 문단이 많은 개념 30", "", "| 개념 | 문단 | 저자 | 대주제 |", "|---|---:|---:|---|"]
    for c, v in sorted(모음.items(), key=lambda x: -len(x[1]))[:30]:
        L.append(f"| {c} | {len(v):,} | {len({x['저자'] for x in v})} | {lay[c].get('big')} |")
    L += ["", "## 🔴문단이 적은 개념 30 (3차에서 요체가 안 나올 자리)", "",
          "| 개념 | 문단 | 저자 | 대주제 |", "|---|---:|---:|---|"]
    for c, v in sorted(모음.items(), key=lambda x: len(x[1]))[:30]:
        L.append(f"| {c} | {len(v):,} | {len({x['저자'] for x in v})} | {lay[c].get('big')} |")
    없음 = [c for c in lay if c not in 모음]
    L += ["", f"## ⛔모음이 아예 없는 개념 {len(없음)}", ""]
    for c in 없음:
        L.append(f"- {c} <sub>{lay[c].get('big')}</sub>")
    (DATA / "2차_리포트.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"2차 전사 — 개념 {len(모음)} · (개념,문단) 쌍 {tot:,} · 저자5곳↑ {다저자}")
    print(f"  모음 없는 개념 {len(없음)}" + (f" — {', '.join(없음[:6])}" if 없음 else ""))
    print(f"→ {DATA/'2차_분류모음.jsonl'} · {OUT}")
    return len(모음), tot, 없음


if __name__ == "__main__":
    with 단계("2차 전사(분류별 모으기)",
            "한 개념에 대한 말이 20파일·9저자에 흩어져 있다 — 한자리에 모아야 갈림이 보인다",
            ["data/2차_분류모음.jsonl", "data/2차_리포트.md"]) as st:
        n, tot, 없음 = main()
        st.기록(f"개념 {n} · (개념,문단) 쌍 {tot:,} · 모음 없는 개념 {len(없음)}")
