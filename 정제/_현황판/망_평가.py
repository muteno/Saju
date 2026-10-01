# -*- coding: utf-8 -*-
"""
관계망 정확도 묶음 — 파이프라인 단계. 코퍼스가 바뀌어 원장이 다시 생기면 정확도도 다시 잰다.

  ① 일주 대조(평가.py)   고수 일주론 글 vs 망(엄격 홀드아웃) — 의미 AUC·정답 일주 순위·강조 상관
                          강조 = 같은 고수의 다른 일주 글 대비(장르기준) · 예측 = 60일주 대비 중심화(풀이의 백분위와 같은 원리)
  ② 사례 대조(사례평가.py) 실제 한 사람의 명식 풀이 11건 vs 망 — 진짜 명식 순위(무작위 199개 중)
  ③ 고수 간 대조(고수간대조.py) 고수끼리 서로 맞히는 만큼 vs 망이 맞히는 만큼 — 천장

⚠ 셋 다 «문헌 속 고수 풀이와의 일치»다. 그 사람 삶의 적중(개인 적중률)이 아니다. 개인 적중은 측정한 적 없다.
산출: data/망_평가.json (사람이 읽는다)
"""
import contextlib, io, json, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 평가, 사례평가, 고수간대조


def main():
    with contextlib.redirect_stdout(io.StringIO()):
        il = 평가.실행(출력=False, 장르기준=True, 중심=2)
        cs = 사례평가.실행(보기=False)
        ce = 고수간대조.실행()
    m = lambda xs: float(np.mean(xs)) if len(xs) else None
    ee = [r for r in il if r["강조AUC"] is not None]
    out = {
        "잰때": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST"),
        "주의": "문헌 속 고수 풀이와의 일치. 개인 적중률 아님(미측정).",
        "일주대조": {"글": len(il), "의미AUC_망": m([r["AUC_망"] for r in il]), "의미AUC_빈도": m([r["AUC_빈도"] for r in il]),
                   "강조상관": m([r["강조상관"] for r in il]), "정답일주_평균순위": m([r["강조순위"] for r in il]),
                   "무작위순위": 30.5, "5등안": m([r["강조순위"] <= 5 for r in il]), "강조AUC": m([r["강조AUC"] for r in ee])},
        "사례대조": {"건": len(cs), "평균순위": m([r[4] for r in cs]), "무작위": 0.5,
                   "건별": [{"이름": r[0], "기둥": r[1], "순위": r[4]} for r in cs]},
        "고수간대조": {"건": len(ce), "고수가_맞힌_순위": m([r[5] for r in ce]), "망이_맞힌_순위": m([r[6] for r in ce]), "무작위": 0.5},
    }
    (HERE / "data" / "망_평가.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    i, c, g = out["일주대조"], out["사례대조"], out["고수간대조"]
    print(f"일주 대조 {i['글']}편: 정답 일주 평균 순위 {i['정답일주_평균순위']:.1f}/60(무작위 30.5) · 강조 상관 {i['강조상관']:+.3f} · 의미 AUC {i['의미AUC_망']:.3f}(빈도 {i['의미AUC_빈도']:.3f})")
    print(f"사례 대조 {c['건']}건: 진짜 명식 평균 순위 {c['평균순위']:.2f}(0=1등, 무작위 0.5)")
    print(f"고수 간 {g['건']}건: 고수 {g['고수가_맞힌_순위']:.3f} vs 망 {g['망이_맞힌_순위']:.3f} (0=1등, 무작위 0.5)")


if __name__ == "__main__":
    main()
