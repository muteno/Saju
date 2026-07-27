# -*- coding: utf-8 -*-
"""
별칭 검증기 (alias linter) — 오탐을 '기억'이 아니라 '측정'으로 막는다.

왜 만들었나(260725 실측):
  개념 사전의 별칭을 사람이 손으로 적고 그게 맞다고 믿어 왔다. 그런데 한국어는
  띄어쓰기로 단어가 갈리지 않아서 '여기서'에 여기(餘氣)가, '기본기'에 본기(本氣)가,
  '해석'에 해수(亥)가 그냥 박힌다. 실측 결과 '여기'는 59%가 가짜였고 그 상태로
  top-15 허브였다. 문제는 별칭 몇 개가 틀린 게 아니라 **재는 장치가 없었다는 것**이다.
  새 채널이 들어올 때마다 새 어휘가 들어오므로, 이 검증기가 상시 게이트다.

무엇을 재나 — 별칭 하나당 3가지 신호:
  ① 동반어율   그 별칭이 걸린 자리 **±40자 안에** 같은 과목의 다른 개념이 있는 비율.
                (260726 수리 — 전에는 «문단 전체»였는데 문단이 632자가 되며 무력해졌다)
                진짜 사주 용어면 혼자 나오지 않는다.
  ② 경계 안정성 별칭 바로 앞/뒤 한 글자의 쏠림. 특정 글자가 압도적이면
                (여기+'서', 기+본기) 접사·합성어에 박힌 것이다.
  ③ 과목 일치율 문단의 subj 태그가 그 별칭의 과목과 맞는 비율.

판정: 안전 / 게이트필요 / 위험
출력: data/별칭_판정.json  (샘플 문맥 3개 동봉 — 사람이 5초에 확인 가능)

사용:  python lint_aliases.py            전체 검증 후 판정 파일 갱신
       python lint_aliases.py --diff     지난 판정과 달라진 것만 (새 코퍼스 반입 후)

★빌더 규약: build_neuron_map.py 는 이 판정 파일을 읽어
   '위험' = 자동 제외 · '게이트필요' = 동반어 있을 때만 인정 · '미검증' = 쓰되 화면에 경고.
"""
import json, re, sys, unicodedata
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
KST = timezone(timedelta(hours=9))
VERDICT = DATA / "별칭_판정.json"

# 판정 기준선 (실측으로 조정한 값 — 근거는 각 줄 주석)
MIN_HITS_TO_JUDGE = 12      # 이보다 적게 나오면 표본 부족 → 보류
BOUNDARY_ALARM    = 0.30    # 앞/뒤 한 글자 쏠림 30%↑ = 접사·합성어 의심 ('여기'+'서' 실측 0.35)
COMPANION_WIN     = 40      # ★동반어를 찾는 국소 창(글자). 문단 전체를 보면 무의미해진다 — 260726
COMPANION_FLOOR   = 0.35    # 동반어율 35% 미만 = 사주 문맥이 아닌 데서 나온다는 뜻
SAFE_LEN          = 4       # 4글자 이상 별칭은 우연 충돌이 사실상 없다 → 자동 안전

# 한국어 조사/어미 — 별칭 뒤에 이게 붙는 건 정상이므로 쏠림 계산에서 뺀다
JOSA = set("은는이가을를의에서와과도로만부터까지라며며고요죠임음함될된다"
           "①②③④⑤ ,.·()[]{}/→←+~×:;'\"!?0123456789\n\t")

# ★쏠림이 '무해한' 경우 — 더 긴 사주 용어를 만드는 글자들.
#   개운→개운'법', 백호→백호'살', 체용→체용'론', 태극→태극'귀'인 은 오탐이 아니라
#   같은 개념의 정식 합성어다. 반면 여기→여기'서', 설하←개'설하' 는 문법·일상어다.
#   이 두 가지를 가르지 못하면 멀쩡한 별칭을 끊게 된다(260725 실측).
# 🔴260726 수리 — «위험» 29건을 눈으로 보니 두 종류가 섞여 있었다.
#   ⓐ 진짜 글자 침입 : 직**장생**활(장생) · **이사**주(이사) · 시**절입**니다(절입)
#   ⓑ 정상 한국어 활용 : 과다**하**다 · 금전**적** · 구설**수** · 억부**적** · 고립**되**다
#   경계쏠림 지표는 둘을 못 가른다 — 「쏠렸다」만 보고 「무엇에 쏠렸나」를 안 봤다.
#   ⓑ는 그 별칭이 **한국어 용언·접사로 자연스럽게 늘어난 것**이라 오탐이 아니다.
#   →  파생 접사·조사를 무해 목록에 넣는다. 그래야 남는 쏠림이 진짜 ⓐ만 된다.
BENIGN_TAIL = set("법살론격국운신귀문성지묘고년월일시반편장"   # 뒤에 붙어 용어를 만드는 글자
                  "적하되수성화력감스럽")                      # 파생 접사 — 과다하다·금전적·구설수·고립되다
BENIGN_HEAD = set("갑을병정무기경신임계자축인묘진사오미유술해"       # 간지 글자가 앞 = 갑신월·정축년 류
                  "정편식상비겁관인재"                             # 십성 조합 = 정관·편재·식신…
                  # ★260726 추가 — 「**사주** 원국」이 «일상어에 박힘»으로 오판됐다(원진 위험 판정).
                  #   사주·명리·대·세·월·연 은 앞에 붙어 **정식 어구**를 만드는 글자다.
                  "주명리대세월연시일")


def load_taxonomy():
    src = (HERE / "build_concept_map.py").read_text(encoding="utf-8")
    i = src.index("TAXONOMY = ")
    j = src.index("\n}\n", i) + 3
    ns = {}
    exec(src[i:j], ns)
    return ns["TAXONOMY"]


def main():
    T = load_taxonomy()
    alias_info = {}                      # alias → {concepts, codes}
    code_aliases = defaultdict(set)      # 과목코드 → 그 과목의 별칭 전부
    for big, mids in T.items():
        code = big.split()[0]
        for mid, concepts in mids.items():
            for c, aliases in concepts.items():
                for a in list(aliases) + [c]:
                    a = a.strip()
                    if not a:
                        continue
                    d = alias_info.setdefault(a, {"concepts": set(), "codes": set()})
                    d["concepts"].add(c)
                    d["codes"].add(code)
                    code_aliases[code].add(a)

    # 🔴260726 수리 — 이 검증기가 **세 겹으로 낡아 있었다.**
    #   ① 관측창이 `gist + quote`(문단당 74자)였다. 260725에 «원문 전문»으로 확장하기로
    #      결정하고 빌더는 바꿨는데 **검증기는 안 바꿨다**(관측률 11.67%).
    #   ② 그 74자에 **gist가 들어 있었다** — 우리가 붙인 이름표를 코퍼스인 양 쟀다.
    #   ③ **웹만** 봤다. 전사 26,333문단이 통째로 빠졌다.
    #   결과: `여기`가 449회로 찍혔다. 실제는 **15,076회**(통합 코퍼스 실측). 34배 과소.
    #   검증기가 낡으면 «측정이 있다»는 사실이 오히려 안심시킨다 — 가장 나쁜 종류다.
    import 코퍼스 as _CP
    paras = [{"para_id": r["para_id"], "post_id": r["post_id"], "subj": r["q"].get("subj", []),
              "_t": unicodedata.normalize("NFC", r["text"])}
             for r in _CP.문단들()]
    print(f"  코퍼스 {len(paras):,} 문단 (공용 리더 · 원문 전문 · gist 제외 · 웹+전사)")

    # ★빌더와 똑같이 '긴 별칭 우선'으로 실제 배정을 먼저 한다.
    #   이걸 안 하면 개운(→개운법)·백호(→백호살)·체용(→체용론)처럼
    #   '더 긴 진짜 용어에 흡수되는' 정상 케이스가 오탐으로 잡힌다(260725 실측).
    #   즉 검증기는 raw 부분문자열이 아니라 '빌더가 실제로 세는 것'을 재야 한다.
    _re = re.compile("|".join(re.escape(a) for a in sorted(alias_info, key=len, reverse=True)))
    for d in paras:
        spans, taken = [], []
        for m in _re.finditer(d["_t"]):
            s, e = m.span()
            if any(s < te and ts < e for ts, te in taken):
                continue
            taken.append((s, e))
            spans.append((m.group(), s, e))
        d["_spans"] = spans

    verdicts = {}
    for a, info in sorted(alias_info.items()):
        codes = info["codes"]
        # 같은 과목의 '다른' 별칭들 = 동반어 후보 (2글자 이상만, 자기 자신 제외)
        companions = {x for code in codes for x in code_aliases[code]
                      if x != a and len(x) >= 2 and x not in a and a not in x}
        hits = 0
        with_comp = 0
        subj_ok = subj_n = 0
        prev_c, next_c = Counter(), Counter()
        samples = []
        for d in paras:
            t = d["_t"]
            mine = [(s, e) for g, s, e in d["_spans"] if g == a]
            if not mine:
                continue
            pos = mine[0][0]
            hits += 1
            # 🔴260726 수리 — 여기서 **문단 전체(`t`)**를 보고 있었다.
            #   이 검사는 74자짜리 `gist+quote` 시절에 만들어졌고, 그땐 «문단 전체»가
            #   곧 «국소»였다. 그런데 260725에 관측창을 **원문 전문(평균 632자)**으로
            #   넓히면서 — 그 결정 자체는 옳다(관측률 11.67%→100%) —
            #   **이 검사만 조용히 무력해졌다.** 632자 안에는 사주 용어가 거의 항상 있어서
            #   「여기서 조심해야 될 게」도 동반어 검사를 통과한다.
            #   실측: 통합 코퍼스로 재니 `여기`가 15,157회인데 판정이 **«안전»**으로 뒤집혔다.
            #   (같은 것을 ±34자 국소로 재면 9.3%다 — lint_markers [B])
            #   → **매치 지점 ±COMPANION_WIN 안에서만** 동반어를 찾는다. 원래 의도로 되돌린다.
            # 🔴260726 2차 수리 — **«첫 매치»만 보고 있었다.**
            #   증상: 래칫이 펄럭인다. 전사가 계속 늘어 문단 순서가 조금 바뀔 때마다
            #   «첫 매치»가 다른 문단·다른 위치로 옮겨가고, 그러면 판정이 뒤집힌다.
            #   실측으로 그렇게 튄 것: 260726 두 번 연속 실행에서
            #     1회차 ▲구신·극신강·극신약·득시·실세·실지·천상삼기·태강·태약 / ▼신강·양옆
            #     2회차 ▲지지충                                   ← 게이트가 필요할 리 없는 말이다
            #   원인: 「일간」·「지지충」처럼 **문단 첫머리에 화제어로 나오는 고빈도 핵심어**는
            #   그 자리 ±40자에 동반어가 없다(제목·도입부라서). 측정 방식의 인공물이다.
            #   → **문단 안 모든 매치를 보고, 하나라도 동반어를 끼고 있으면 인정한다.**
            #     묻는 것이 「이 문단이 그 개념을 논하는가」이므로 «어느 매치든» 이면 충분하다.
            #     이건 기준을 낮추는 게 아니라 **같은 질문을 제대로 묻는 것**이다 —
            #     일상어 오탐(「여기서 조심해야」)은 어느 매치를 봐도 동반어가 없어 그대로 걸린다.
            for _s, _e in mine:
                # 🔴260727 — span을 도려낸다. 포함하면 **별칭이 자기 이름으로 자기를 증명**한다
                #   (「소화기」 동반율 100.0% → 12.5% 실측). `lint_markers.py`도 같은 결함이었다.
                w = (t[max(0, _s - COMPANION_WIN): _s]
                     + t[_e: _e + COMPANION_WIN])
                if any(x in w for x in companions):
                    with_comp += 1
                    break
            # 🔴260726 수리 — 전사 문단에는 `subj` 태그가 **아예 없다**(P0 웹 전용 필드).
            #   그대로 두면 «태그가 없다»가 «과목이 다르다»로 세어져, 코퍼스의 55%가
            #   전사인 지금 전 별칭의 과목일치율이 구조적으로 반토막 난다.
            #   실측: 지지·일간·일주·오행·원국이 전부 과목일치율 0.0으로 찍혔다.
            #   → **태그가 있는 문단만 분모에 넣는다.** 없는 것은 «불일치»가 아니라 «미측정».
            if d.get("subj"):
                subj_n += 1
                if set(d["subj"]) & codes:
                    subj_ok += 1
            p = t[pos - 1] if pos > 0 else ""
            n = t[pos + len(a): pos + len(a) + 1]
            if p and p not in JOSA and p not in BENIGN_HEAD:
                prev_c[p] += 1
            if n and n not in JOSA and n not in BENIGN_TAIL:
                next_c[n] += 1
            if len(samples) < 3:
                samples.append(t[max(0, pos - 16): pos + len(a) + 16].replace("\n", " "))

        rec = {"alias": a, "concepts": sorted(info["concepts"]), "codes": sorted(codes),
               "hits": hits, "samples": samples}

        # ★260725 개정 — 평의회 1차 지적 이행.
        #   기존: 4글자 이상이면 **측정도 하지 않고** 자동으로 '안전'을 찍었다.
        #   실측: '안전' 369개 중 208개가 그 자동 통과였고, 그중 155개는 근거 12건 미만,
        #        55개는 코퍼스 출현 0회였다. → "라벨이 안전이라고 거짓말하고 있다."
        #   개정: 길이는 면제 사유가 아니다. **표본이 있으면 길든 짧든 실제로 측정**하고,
        #        표본이 없으면 '안전'이 아니라 '미측정'이라고 정직하게 적는다.
        if hits < MIN_HITS_TO_JUDGE:
            if len(a) >= SAFE_LEN:
                rec["verdict"] = "미측정"
                rec["why"] = (f"{SAFE_LEN}글자 이상이라 우연 충돌 위험은 낮지만 "
                              f"표본 {hits}회로 측정 불가 — 안전이 아니라 미측정이다")
            else:
                rec["verdict"] = "보류"
                rec["why"] = f"표본 부족({hits}회)"
        else:
            comp = with_comp / hits
            sj = (subj_ok / subj_n) if subj_n else None
            lead_p = (prev_c.most_common(1)[0] if prev_c else ("", 0))
            lead_n = (next_c.most_common(1)[0] if next_c else ("", 0))
            skew = max(lead_p[1], lead_n[1]) / hits
            rec.update({"동반어율": round(comp, 3),
                        "과목일치율": (round(sj, 3) if sj is not None else None),
                        "과목표본": subj_n,
                        "경계쏠림": round(skew, 3),
                        "쏠린글자": (f"앞'{lead_p[0]}'" if lead_p[1] >= lead_n[1] else f"뒤'{lead_n[0]}'")})
            if len(a) <= 1:
                rec["verdict"] = "위험"
                rec["why"] = "1글자 별칭 — 원리상 오탐"
            elif comp < COMPANION_FLOOR and skew >= BOUNDARY_ALARM:
                rec["verdict"] = "위험"
                rec["why"] = f"사주 문맥 밖({comp:.0%})인데 {rec['쏠린글자']}에 쏠림({skew:.0%}) = 일상어에 박힘"
            elif comp < COMPANION_FLOOR or skew >= BOUNDARY_ALARM:
                rec["verdict"] = "게이트필요"
                rec["why"] = (f"동반어율 {comp:.0%}" if comp < COMPANION_FLOOR
                              else f"{rec['쏠린글자']} 쏠림 {skew:.0%}")
            else:
                rec["verdict"] = "안전"
                rec["why"] = f"동반어율 {comp:.0%} · 쏠림 {skew:.0%}"
        verdicts[a] = rec

    old = {}
    if VERDICT.exists():
        old = {r["alias"]: r for r in json.loads(VERDICT.read_text(encoding="utf-8"))["aliases"]}

    payload = {"generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
               "paras": len(paras),
               "기준": {"MIN_HITS_TO_JUDGE": MIN_HITS_TO_JUDGE, "BOUNDARY_ALARM": BOUNDARY_ALARM,
                        "COMPANION_FLOOR": COMPANION_FLOOR, "SAFE_LEN": SAFE_LEN},
               "aliases": list(verdicts.values())}
    VERDICT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    cnt = Counter(r["verdict"] for r in verdicts.values())
    print(f"[별칭 검증] 총 {len(verdicts)}개 · 문단 {len(paras):,}")
    print("  판정:", dict(cnt))
    for v in ("위험", "게이트필요"):
        rows = [r for r in verdicts.values() if r["verdict"] == v]
        rows.sort(key=lambda r: -r["hits"])
        print(f"\n── {v} {len(rows)}개")
        for r in rows[:20]:
            print(f"   {r['alias']:<8}{r['hits']:>6}회  {r['why']}")
            if r["samples"]:
                print(f"            예: …{r['samples'][0]}…")
    if old:
        changed = [a for a, r in verdicts.items()
                   if a in old and old[a].get("verdict") != r["verdict"]]
        new = [a for a in verdicts if a not in old]
        print(f"\n── 지난 판정 대비: 바뀜 {len(changed)}개 {changed[:10]} · 신규 {len(new)}개 {new[:10]}")
    print(f"\n  → {VERDICT}")


if __name__ == "__main__":
    main()
