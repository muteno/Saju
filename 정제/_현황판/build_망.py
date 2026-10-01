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


# 문장 나누기 — 웹은 문장부호, 전사는 종결어미 뒤 공백이 경계다.
SENT = re.compile(r"(?<=[.!?。…])\s+|\n+|(?<=[다요죠])\s+")


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
        text = r["text"]
        pc = [cidx[c] for c in (bnm.concepts_in(text) | 간지들(text)) if c in cidx]
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
        for s in SENT.split(text):
            s = s.strip()
            if len(s) < 6:
                continue
            sc = [cidx[c] for c in (bnm.concepts_in(s) | 간지들(s)) if c in cidx]
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
    nnz_m = S[:, len(nodes):].sum(axis=0).A1
    print(f"[완료] 문장 {n_s:,} · 문단 {n_p:,} · 글 {len(post_ids):,} · 개념 {len(nodes)} · 의미 {len(meanings)} · {time.time()-t0:.0f}s")
    print("  의미별 문장 수: " + " · ".join(f"{m} {int(x):,}" for m, x in sorted(zip(meanings, nnz_m), key=lambda z: -z[1])))


if __name__ == "__main__":
    main()
