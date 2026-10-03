# Saju

기존 알고리즘의 개념 관계를 맥락·관법별 확률로 계산하고 뉴런처럼 그린다.

- 풀이: `python3 정제/_현황판/풀이.py 1990-05-15 14:30 남 --나이 35 --세운 2026`
- 개념 카드: `python3 정제/_현황판/개념카드.py '편관(칠살)'`
- 확률 뉴런도: `python3 정제/_현황판/build_neuralnet.py --확률 --맥락 월지` → `data/망/관계도.html`. `--관법`·`--맥락`을 바꿔 재계산한다. JSON은 `관계도.py`.
- 원장 만들기: `python3 정제/_현황판/build_망.py` (data/망/, git 제외, numpy·scipy 필요)
- 관계확률 검증: `관계검증.py`
- 정확도: `python3 정제/_현황판/망_평가.py`
- 앱: `app/` · 품질 게이트: `npm run verify`

목표는 `CLAUDE.md`, 현황·다음은 `AGENTS.md`.
