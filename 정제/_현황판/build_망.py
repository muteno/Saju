# -*- coding: utf-8 -*-
"""
관계망 원장 — 문장마다 «어떤 개념·어떤 의미가 함께 말해졌나»를 그대로 적어 둔다.

확률·강도·거리는 여기 저장하지 않는다. **부를 때마다 계산한다**(망.py).
같은 원장에서 맥락(함께 켜진 개념)·관법(저자 갈래)·제외 목록(평가용 홀드아웃)으로
행을 골라 세면, 값이 이론 베이스와 상대 개념에 따라 달라진다(운영자 원문98 이후 지시:
"그 강도와 거리 확률은 계속 이론 베이스(상대적 개념)에 따라 변화").

산출(data/망/, 생성물 — 손으로 고치지 않는다, git 제외):
  S.npz   문장 × (개념 271 + 의미 N) 희소 행렬  — 그 문장에서 말해졌나
  C.npz   문장 × 개념 271 희소 행렬            — 그 문장이 속한 «문단»에 있었나(맥락)
  Q.npz   문단 × 개념 271 희소 행렬            — 문단 단위 공기(개념끼리의 거리용)
  meta.json  열 이름·관법 이름·문단/글 id
  rows.npz   문장별 문단 번호·글 번호·관법 번호
  T.npz   글 × 개념 271+60 희소 행렬            — 그 글 «제목»이 다루는 개념(제목 개념이 1~2개일 때만)

필요: numpy, scipy.  사용: python build_망.py
"""
import json, re, sys, time
from pathlib import Path

import numpy as np
from scipy import sparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 코퍼스, 의미

OUT = HERE / "data" / "망"
bnm = 코퍼스._bnm

# 관법(이론 베이스) — 출처를 저자 갈래로 묶는다. 같은 사람의 웹·전사는 한 갈래다.
관법_묶음 = [
    ("도화", r"도화도레|도화로운|dohwadore"),
    ("산책처럼", r"산책처럼"),
    ("초코", r"초코서당|초명"),
    ("현묘", r"현묘"),
    ("플러스명리", r"플러스명리"),
    ("명리학탐구", r"명리학탐구"),
    ("사공", r"사공"),
    ("석우당", r"석우당"),
    ("남석", r"남석"),
    ("하나사주", r"하나사주"),
    ("사람공부", r"사람공부"),
    ("정이철학원", r"정이철학원"),
]


def 관법(출처):
    for name, rx in 관법_묶음:
        if re.search(rx, 출처):
            return name
    return "기타"


_G, _B = "갑을병정무기경신임계", "자축인묘진사오미신유술해"
_HG, _HB = "甲乙丙丁戊己庚辛壬癸", "子丑寅卯辰巳午未申酉戌亥"
GANJI60 = [_G[i % 10] + _B[i % 12] for i in range(60)]
_GANJI_RX = re.compile(f"([{_G}])([{_B}])\\s?(?:일주|일생|日柱)|([{_HG}])([{_HB}])\\s?(?:일주|日柱|日)")


# 보충 인식 — 7월 개념 인식(별칭)이 못 잡는 글자 표기. 원장에서만 더한다(7월 파이프라인·별칭 판정은 그대로).
#   실측(261001): 「신월에 태어났다」류 X월 4,618 · 「병일간」류 · 「미시에 태어」류 479 · 한자 간지 「甲辰」「未土」.
#   ⚠사월·오월·유월은 달 이름(4·5·6월)과 겹쳐 «생/에 태어»가 붙을 때만 지지로 본다.
#   ⚠한자 한 글자는 다른 한자말(孔子·未來)과 겹쳐 간지 짝이나 오행·월·일·시 글자가 붙을 때만 본다.
_STEM_NODE = ["갑목(甲)", "을목(乙)", "병화(丙)", "정화(丁)", "무토(戊)", "기토(己)", "경금(庚)", "신금(辛)", "임수(壬)", "계수(癸)"]
_BRANCH_NODE = ["자수(子)", "축토(丑)", "인목(寅)", "묘목(卯)", "진토(辰)", "사화(巳)", "오화(午)", "미토(未)", "신금(申)", "유금(酉)", "술토(戌)", "해수(亥)"]
_보충 = [
    (re.compile(r"(?<![가-힣])([인묘진신술해자축미])월(?=생|에|의|은|이|\s)"), "B월"),
    (re.compile(r"(?<![가-힣])([사오유])월(?=생|에 태어)"), "B월"),
    (re.compile(r"(?<![가-힣])([자축인묘진사오미신유술해])시(?=생|에 태어)"), "B시"),
    (re.compile(r"(?<![가-힣])([갑을병정무기경신임계])\s?일간"), "S일간"),
    (re.compile(f"([{_HG}])([{_HB}])"), "HSB"),
    (re.compile(f"([{_HB}])(?=[土水木火金月時日])"), "HB"),
    (re.compile(f"([{_HG}])(?=[木火土金水日])"), "HS"),
]


def 보충개념(text):
    out = set()
    for rx, kind in _보충:
        for m in rx.finditer(text):
            g = m.group(1)
            if kind == "B월":
                out |= {_BRANCH_NODE[_B.index(g)], "월지"}
            elif kind == "B시":
                out |= {_BRANCH_NODE[_B.index(g)], "시지"}
            elif kind == "S일간":
                out |= {_STEM_NODE[_G.index(g)], "일간"}
            elif kind == "HSB":
                out |= {_STEM_NODE[_HG.index(g)], _BRANCH_NODE[_HB.index(m.group(2))]}
            elif kind == "HB":
                out.add(_BRANCH_NODE[_HB.index(g)])
            elif kind == "HS":
                out.add(_STEM_NODE[_HG.index(g)])
    return out


def 간지들(text):
    out = set()
    for m in _GANJI_RX.finditer(text):
        if m.group(1):
            si, bi = _G.index(m.group(1)), _B.index(m.group(2))
        else:
            si, bi = _HG.index(m.group(3)), _HB.index(m.group(4))
        if si % 2 == bi % 2:
            out.add("간지:" + _G[si] + _B[bi])
    return out


# 전사 받아쓰기 교정 — 유튜브 자동 자막이 명리 용어를 비슷한 소리의 다른 말로 적는다(블로그로 옮긴 전사에도 남아 있다).
#   실측(코퍼스 전체, 261001): 평관 6,303(편관 4,575보다 많다) · 편제 5,300 · 겁제 3,196 · 청간 7,234 · 대원 1,556 ·
#   병호 1,727 · 세훈 703 · 감옥 700 · 일관 14,598(일간 22,626). 교정 없이 세면 이 문장들은 개념이 없는 문장이 된다.
#   ⚠원장에서만 교정한다(7월 파이프라인·원천 전사는 그대로). 실제 낱말과 겹치는 것은 문맥을 건다.
_교정 = [
    (re.compile(r"평관"), "편관"),
    (re.compile(r"겁제"), "겁재"),
    (re.compile(r"편제"), "편재"),
    (re.compile(r"정제(?=[가는를의와이에도로]|\s|$)"), "정재"),
    (re.compile(r"청간"), "천간"),
    (re.compile(r"상광"), "상관"),
    (re.compile(r"대원(?=[이은을의에도과]|\s|$)"), "대운"),
    (re.compile(r"세훈"), "세운"),
    (re.compile(r"병호(?=\s?일주|\s?일간|\s?일관|년|월|일)"), "병오"),
    (re.compile(r"감옥(?!에 갇|에 가|살이|에서|에 들어|을 가| 가|에 갈)"), "갑목"),
    (re.compile(r"(?<=[목화토금수])\s?일관"), " 일간"),
    (re.compile(r"일관(?=[은이을의과에도]\s|\s?입장|\s?기준)"), "일간"),
]


def 전사_교정(text):
    for rx, to in _교정:
        text = rx.sub(to, text)
    return text


# 개념 인식 전 가리기 — 7월 별칭이 일상어 속에서 잡히는 것(실측 261001 표본): 교육해→육해(해) · 돌파·자유파→파 ·
#   서태지→태지(절·태·양) · 고지식·차고지→고지 · 고관대작·관대한→관대 · 목욕탕→목욕 · 통근 버스/통근하→통근.
#   의미 인식에는 원문을 그대로 쓰고 개념 인식에만 가린다(원장에서만).
_가림 = re.compile(r"교육해|돌파|자유파|서태지|고지식|차고지|고관대[작장]|관대(?=한|하게|함|히|해)|목욕(?=탕|재계|을 하|하)|통근(?= ?버스| ?시간|하)")


def 개념_가리기(text):
    return _가림.sub(lambda m: "□" * len(m.group(0)), text)


# 문장 나누기 — 웹은 문장부호, 전사는 종결어미 뒤 공백이 경계다.
SENT = re.compile(r"(?<=[.!?。…])\s+|\n+|(?<=[다요죠])\s+")


def 문장들(text):
    """원장이 세는 문장 목록(6자 미만은 버린다). 원장 행 순서와 같아야 근거 문장을 되찾을 수 있다."""
    return [s for s in (x.strip() for x in SENT.split(text)) if len(s) >= 6]


# 제목 주제에서 뺄 노드 — 자리·총칭·책 이름처럼 «이 글이 무엇에 대한 글인가»를 말해 주지 못하는 것.
제목_제외 = re.compile(r"총칭|원국·명식|^일주$|^월주$|^연주$|^시주$|^일간$|^일지$|^월지$|^월간$|^연간$|^연지$|^시지$|^시간|"
                      r"신년운세|대운|세운|월운|일진|만세력|절기|음양|십이운성 자체|지장간|좋다·나쁘다|관계·결혼|재물·돈|직업·직무|"
                      r"건강·질병|학업·시험|이동·이사|구설·송사|갈등|출산|사업·창업|적성·재능|배우자|부모|자녀|형제|현묘|초명|강헌|"
                      r"연해자평|적천수|자평진전|궁통보감|삼명통회|명리정종|명리약언|색·방위|음식·건강|행동·환경")


def 제목_행렬(nodes=None, post_ids=None):
    """글 제목이 다루는 개념 → T.npz(글 × 개념). 제목 개념이 1~2개(주제가 분명)일 때만 적는다."""
    meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
    nodes = nodes or meta["nodes"]; post_ids = post_ids or meta["post_ids"]
    cidx = {c: i for i, c in enumerate(nodes)}
    pidx = {p: i for i, p in enumerate(post_ids)}
    seen = set(); r_, c_ = [], []
    for r in 코퍼스.문단들():
        pid = r.get("post_id") or r["para_id"]
        if pid in seen or pid not in pidx:
            continue
        seen.add(pid)
        t = r.get("title") or ""
        cs = {c for c in (bnm.concepts_in(t) | 간지들(t)) if c in cidx and not 제목_제외.search(c)}
        if 1 <= len(cs) <= 2:
            for c in cs:
                r_.append(pidx[pid]); c_.append(cidx[c])
    T = sparse.csr_matrix((np.ones(len(r_), dtype=np.uint8), (r_, c_)), shape=(len(post_ids), len(nodes)))
    T.data[:] = 1
    sparse.save_npz(OUT / "T.npz", T)
    return T


def main():
    t0 = time.time()
    nodes = [json.loads(l)["concept"] for l in (HERE / "data" / "node_layers.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    nodes = [c for c in nodes if c]
    # 60갑자 일주 노드 — 「갑자일주」처럼 일주로 말해진 것만(「갑자기」 같은 일상어를 막으려고 꼬리를 요구한다)
    nodes += ["간지:" + g for g in GANJI60]
    meanings = list(의미.MEANINGS)
    cols = nodes + ["의:" + m for m in meanings]
    cidx = {c: i for i, c in enumerate(nodes)}
    midx = {m: len(nodes) + i for i, m in enumerate(meanings)}
    kw = [n for n, _ in 관법_묶음] + ["기타"]
    kidx = {k: i for i, k in enumerate(kw)}

    s_r, s_c = [], []          # S
    c_r, c_c = [], []          # C (문장 × 문단 맥락)
    q_r, q_c = [], []          # Q (문단)
    row_para, row_post, row_kw, row_len = [], [], [], []
    para_post_l, para_kw_l = [], []
    para_ids, post_ids, post_index = [], [], {}
    n_s = 0
    for pi, r in enumerate(코퍼스.문단들()):
        text = 전사_교정(r["text"])
        tm = 개념_가리기(text)
        pc = [cidx[c] for c in (bnm.concepts_in(tm) | 간지들(tm) | 보충개념(tm)) if c in cidx]
        para_ids.append(r["para_id"])
        pid = r.get("post_id") or r["para_id"]
        if pid not in post_index:
            post_index[pid] = len(post_ids)
            post_ids.append(pid)
        po = post_index[pid]
        k = kidx[관법(r["출처"])]
        para_post_l.append(po); para_kw_l.append(k)
        for c in pc:
            q_r.append(pi); q_c.append(c)
        for s in 문장들(text):
            sm_ = 개념_가리기(s)
            sc = [cidx[c] for c in (bnm.concepts_in(sm_) | 간지들(sm_) | 보충개념(sm_)) if c in cidx]
            sm = [midx[m] for m in 의미.의미들(s)]
            for c in sc:
                s_r.append(n_s); s_c.append(c)
            for m in sm:
                s_r.append(n_s); s_c.append(m)
            for c in pc:
                c_r.append(n_s); c_c.append(c)
            row_para.append(pi); row_post.append(po); row_kw.append(k); row_len.append(len(s))
            n_s += 1
        if pi % 5000 == 0:
            print(f"  문단 {pi:,} · 문장 {n_s:,} · {time.time()-t0:.0f}s", flush=True)
    n_p = len(para_ids)
    S = sparse.csr_matrix((np.ones(len(s_r), dtype=np.uint8), (s_r, s_c)), shape=(n_s, len(cols)))
    S.data[:] = 1
    C = sparse.csr_matrix((np.ones(len(c_r), dtype=np.uint8), (c_r, c_c)), shape=(n_s, len(nodes)))
    C.data[:] = 1
    Q = sparse.csr_matrix((np.ones(len(q_r), dtype=np.uint8), (q_r, q_c)), shape=(n_p, len(nodes)))
    Q.data[:] = 1
    OUT.mkdir(parents=True, exist_ok=True)
    sparse.save_npz(OUT / "S.npz", S)
    sparse.save_npz(OUT / "C.npz", C)
    sparse.save_npz(OUT / "Q.npz", Q)
    np.savez_compressed(OUT / "rows.npz", para=np.array(row_para, dtype=np.int32), post=np.array(row_post, dtype=np.int32),
                        kw=np.array(row_kw, dtype=np.int8), slen=np.array(row_len, dtype=np.int16))
    np.savez_compressed(OUT / "paras.npz", post=np.array(para_post_l, dtype=np.int32), kw=np.array(para_kw_l, dtype=np.int8))
    (OUT / "meta.json").write_text(json.dumps({"nodes": nodes, "meanings": meanings, "cols": cols, "관법": kw,
                                               "para_ids": para_ids, "post_ids": post_ids,
                                               "문장수": n_s, "문단수": n_p}, ensure_ascii=False), encoding="utf-8")
    T = 제목_행렬(nodes, post_ids)
    print(f"  제목 주제: 글 {int((T.sum(axis=1) > 0).sum()):,}편")
    nnz_m = S[:, len(nodes):].astype(np.int64).sum(axis=0).A1
    print(f"[완료] 문장 {n_s:,} · 문단 {n_p:,} · 글 {len(post_ids):,} · 개념 {len(nodes)} · 의미 {len(meanings)} · {time.time()-t0:.0f}s")
    print("  의미별 문장 수: " + " · ".join(f"{m} {int(x):,}" for m, x in sorted(zip(meanings, nnz_m), key=lambda z: -z[1])))


if __name__ == "__main__":
    if sys.argv[1:] == ["제목"]:
        T = 제목_행렬()
        print(f"[제목 주제] 글 {int((T.sum(axis=1) > 0).sum()):,}편 · 칸 {T.nnz:,}")
    else:
        main()
