# -*- coding: utf-8 -*-
"""주장/질문 커버리지 프로브 — /feed v2 블라인드 시험 루프의 기계 보조.

영상(답안지)에서 뽑은 질문/주장별 정규식 패턴으로, '그 영상을 제외한' KB 전 소스
(방법론 보드 / 블로그 유닛 / 유튜브 자막)에서 근거 문단이 실존하는지 센다.
'재현됨' 판정의 필요조건 검사기: 비자기 출처 적중 0이면 그 주장은 '공백 후보'.

사용:
  python3 probe_coverage.py kb/exams/<vid>.json [--exclude VID ...]
    - 시트의 questions[].patterns(정규식 목록)를 사용. --exclude 생략 시 시트의 vid 자동 제외.
  python3 probe_coverage.py claims.json --exclude VID
    - 간이 형식 [{"id","label","patterns":[...]}] 도 허용.

출력: 질문별 소스 유형 적중 통계 + 상위 출처. 패턴 없는 질문은 SKIP 표시(추출 에이전트가 채울 것).
"""
import json, os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KB = os.path.join(HERE, '..', 'kb')
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
BOARD = os.path.join(HERE, '..', 'methodology', 'figjam_board_full.md')


def load_questions(path):
    d = json.load(open(path, encoding='utf-8'))
    if isinstance(d, dict) and 'questions' in d:  # 시험 시트
        qs = [{'id': q.get('id', f'Q{i+1}'), 'label': q.get('q', ''),
               'patterns': q.get('patterns', [])} for i, q in enumerate(d['questions'])]
        return qs, [d.get('vid')] if d.get('vid') else []
    return d, []  # 간이 형식


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    sheet = args[0]
    excl = set()
    if '--exclude' in args:
        excl = set(args[args.index('--exclude') + 1:])
    questions, auto_excl = load_questions(sheet)
    excl |= set(auto_excl)

    bodies = json.load(open(os.path.join(KB, 'unit_bodies.json'), encoding='utf-8'))
    board = open(BOARD, encoding='utf-8').read()
    yt = {os.path.basename(f)[:-4]: open(f, encoding='utf-8', errors='replace').read()
          for f in glob.glob(os.path.join(YT_TXT, '*.txt'))
          if os.path.basename(f)[:-4] not in excl}
    titles = {x['vid']: x['title'][:45]
              for x in json.load(open(os.path.join(KB, 'yt_saju.json'), encoding='utf-8'))}

    print(f'제외 vid: {sorted(excl) or "(없음)"}  |  대조 소스: 보드 + 블로그 {len(bodies)}유닛 + 유튜브 {len(yt)}편\n')
    gaps = []
    for q in questions:
        if not q.get('patterns'):
            print(f"[{q['id']}] SKIP — patterns 없음: {q['label'][:60]}")
            continue
        rx = re.compile('|'.join(q['patterns']))
        b_hits = len(rx.findall(board))
        blog = sorted(((u, len(rx.findall('\n'.join(d['paras'])))) for u, d in bodies.items()),
                      key=lambda x: -x[1])
        blog = [(u, n) for u, n in blog if n]
        yhit = sorted(((v, len(rx.findall(t))) for v, t in yt.items() if rx.search(t)),
                      key=lambda x: -x[1])
        total = b_hits + sum(n for _, n in blog) + sum(n for _, n in yhit)
        flag = '  ⚠️ 공백 후보(비자기 근거 0)' if total == 0 else ''
        print(f"[{q['id']}] {q['label'][:60]}")
        print(f"   보드 {b_hits} | 블로그 {len(blog)}유닛 | 유튜브 {len(yhit)}편 | 총 {total}건{flag}")
        for u, n in blog[:3]:
            print(f'     블로그: {u} ({n})')
        for v, n in yhit[:4]:
            print(f'     yt:{v} ({n}) {titles.get(v, "?")}')
        if total == 0:
            gaps.append(q['id'])
    print(f"\n공백 후보: {gaps or '없음'}")


if __name__ == '__main__':
    main()
