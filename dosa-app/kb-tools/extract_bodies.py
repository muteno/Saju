# -*- coding: utf-8 -*-
"""매핑된 유닛의 전체 본문 추출 → kb/unit_bodies.json (git 제외 — 정제본에서 재생성).

refine-tools/extract_units.py와 동일 규약(정제본 docx, Heading1 분할, key=문서명#순번)으로
kb/unit_index.json에 등장하는 유닛만 전체 문단을 뽑는다. 제목 불일치 시 assert 중단(누락 방지).

실행: python extract_bodies.py
"""
import zipfile, re, os, sys, json, html
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
REFINED = os.path.join(ROOT, '정제본')
KB = os.path.join(HERE, '..', 'kb')
PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)

def txt(p):
    return html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()

def main():
    index = json.load(open(os.path.join(KB, 'unit_index.json'), encoding='utf-8'))
    units_meta = {u['key']: u for u in json.load(open(os.path.join(ROOT, 'refine-tools', 'units.json'), encoding='utf-8'))}

    need = defaultdict(set)  # doc → {seq}
    for entries in index.values():
        for e in entries:
            doc, seq = e['key'].rsplit('#', 1)
            need[doc].add(int(seq))

    bodies = {}
    for doc, seqs in sorted(need.items()):
        path = os.path.join(REFINED, doc + '.docx')
        assert os.path.exists(path), f'정제본 없음: {doc}'
        xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
        paras = PARA_RX.findall(xml)
        h1s = [i for i, p in enumerate(paras) if 'Heading1' in p]
        for n in sorted(seqs):
            assert n < len(h1s), f'{doc}: seq {n} 범위 초과 (H1 {len(h1s)}개)'
            i = h1s[n]
            j = h1s[n + 1] if n + 1 < len(h1s) else len(paras)
            title = txt(paras[i])
            key = f'{doc}#{n:04d}'
            expect = units_meta.get(key, {}).get('title')
            assert expect is None or title == expect, f'제목 불일치 {key}: docx={title!r} units={expect!r}'
            meta, body = None, []
            for p in paras[i + 1:j]:
                t = txt(p)
                if not t:
                    continue
                if meta is None and t.startswith('작성일 '):
                    meta = t
                    continue
                body.append(t)
            bodies[key] = {'title': title, 'meta': meta, 'paras': body}

    out = os.path.join(KB, 'unit_bodies.json')
    json.dump(bodies, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    nchars = sum(len(p) for b in bodies.values() for p in b['paras'])
    print(f'유닛 {len(bodies)}건, 문단 {sum(len(b["paras"]) for b in bodies.values()):,}개, 본문 {nchars/1e6:.1f}M자')
    print('저장:', os.path.normpath(out))

if __name__ == '__main__':
    main()
