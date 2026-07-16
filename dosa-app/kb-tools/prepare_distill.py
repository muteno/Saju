# -*- coding: utf-8 -*-
"""증류 원료 번들 생성 — 키별로 근거 유닛 전체 본문을 한 파일(md)에 모은다.

증류 작업자(Claude 배치)는 이 번들만 읽고 kb/distilled/<키>.json 을 쓴다.
실행: python prepare_distill.py ilju        # ilju/* 전체
      python prepare_distill.py ilju/갑자   # 특정 키
출력: kb/distill_src/<키공간>_<이름>.md  (git 제외 — 재생성 가능)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KB = os.path.join(HERE, '..', 'kb')

def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else 'ilju'
    index = json.load(open(os.path.join(KB, 'unit_index.json'), encoding='utf-8'))
    bodies = json.load(open(os.path.join(KB, 'unit_bodies.json'), encoding='utf-8'))
    outdir = os.path.join(KB, 'distill_src')
    os.makedirs(outdir, exist_ok=True)

    targets = [k for k in index if k == prefix or k.startswith(prefix.rstrip('/') + '/')] if '/' not in prefix \
        else [k for k in index if k == prefix]
    n = 0
    for key in sorted(targets):
        entries = index[key]
        lines = [f'# 증류 원료: {key}', '']
        for e in entries:
            b = bodies.get(e['key'])
            if not b:
                continue
            lines.append(f'## [출처 {e["key"]}] {e["doc"]} · 「{e["title"]}」')
            if b.get('meta'):
                lines.append(f'({b["meta"]})')
            lines.append('')
            lines.extend(b['paras'])
            lines.append('')
        fn = key.replace('/', '_') + '.md'
        with open(os.path.join(outdir, fn), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        n += 1
    print(f'번들 {n}개 → {os.path.normpath(outdir)}')

if __name__ == '__main__':
    main()
