# -*- coding: utf-8 -*-
"""시험은행 리플레이 게이트 — /feed PASS 시트의 지식이 '여전히 찾아지는가' 회귀 검사.

kb/exams/*.json 중 status==pass 시트의 questions[].patterns를 KB 전 소스(보드·블로그
유닛·유튜브 자막 — 자기 vid 포함: 주입된 지식은 자기 원문이 정당한 출처)에 재실행한다.
어느 질문이든 적중 0이면 exit 1 — 색인·별칭·주입 배관의 회귀를 커밋 단계에서 잡는다.
(평의회 260717 아이데이션 1안 · 1호 시드 = 배관 박제 시트 JMCgXyFr2hg)

실행: python3 replay_exams.py   (verify.sh 4단계에 편입 — unit_bodies 재생성 이후여야 함)
"""
import json, os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KB = os.path.join(HERE, '..', 'kb')
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
BOARD = os.path.join(HERE, '..', 'methodology', 'figjam_board_full.md')


def main():
    sheets = sorted(glob.glob(os.path.join(KB, 'exams', '*.json')))
    todo = []
    for sp in sheets:
        d = json.load(open(sp, encoding='utf-8'))
        if d.get('status') != 'pass':
            continue
        for q in d.get('questions', []):
            pats = [p for p in q.get('patterns', []) if p.strip()]
            if pats:
                todo.append((os.path.basename(sp), q.get('id', '?'), pats))
    if not todo:
        print('replay_exams: PASS 시트 없음 — 통과(공허).')
        return 0

    corpus = [open(BOARD, encoding='utf-8').read()]
    bodies = json.load(open(os.path.join(KB, 'unit_bodies.json'), encoding='utf-8'))
    corpus += ['\n'.join(b['paras']) for b in bodies.values()]
    corpus += [open(f, encoding='utf-8', errors='replace').read()
               for f in glob.glob(os.path.join(YT_TXT, '*.txt'))]
    blob = '\n'.join(corpus)

    fails = []
    for sheet, qid, pats in todo:
        try:
            rx = re.compile('|'.join(pats))
        except re.error as e:
            fails.append(f'{sheet}#{qid}: 패턴 정규식 오류({e})')
            continue
        if not rx.search(blob):
            fails.append(f'{sheet}#{qid}: 적중 0 — PASS였던 지식이 더는 안 찾아짐(회귀)')
    if fails:
        print(f'❌ replay_exams 실패 {len(fails)}건:')
        [print(' -', f) for f in fails]
        return 1
    print(f'✅ replay_exams 통과 — PASS 시트 {len(set(s for s, _, _ in todo))}개·질문 {len(todo)}건 전부 재적중.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
