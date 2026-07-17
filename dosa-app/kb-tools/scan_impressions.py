# -*- coding: utf-8 -*-
"""인상(이미지) 지식 스캔 — "이런 요소라서 겉으로 이렇게 보인다" 순방향 지식의 전수 색인.

무속인 인터뷰(운명전쟁 49) 분석에서 확인된 역추론(이미지→사주)을 뒤집어,
사주 요소 → 대외 이미지·분위기·외모·말투 서술을 코퍼스 전체에서 찾는다.
같은 문단에 (a) 인상 어휘 + (b) 요소 용어가 함께 나오면 image/<요소> 키로 색인.

출력: kb/impression_index.json + 커버리지/공백 리포트(stdout)
실행: python scan_impressions.py
"""
import json, os, re, glob, zipfile, html
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KB = os.path.join(HERE, '..', 'kb')
REFINED = os.path.join(ROOT, '정제본')
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
BOARD = os.path.join(HERE, '..', 'methodology', 'figjam_board_full.md')
PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)
MAX_REFS = 200

# (a) 인상 어휘 — 겉으로 드러나는 모습
IMPRESSION = re.compile(
    r'이미지|첫인상|인상[이을은]|외모|생김새|분위기|말투|목소리|스타일|패션|옷차림'
    r'|겉모습|겉으로|비쳐|비치[는다]|보여지|처럼 보이|로 보이|보이는 사람'
    r'|주변에서|남들이 보|타인의 눈|매력|아우라|포스|느낌을 주|풍기|풍모|호감')

# (b) 요소 용어 → image/<키>
ELEMENT_TERMS = {}
for s in ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인']:
    ELEMENT_TERMS[f'image/sipsin/{s}'] = re.compile(s)
for g in ['비겁', '식상', '재성', '관성', '인성']:
    ELEMENT_TERMS[f'image/sipsin-group/{g}'] = re.compile(g)
for st, el in [('갑', '목'), ('을', '목'), ('병', '화'), ('정', '화'), ('무', '토'),
               ('기', '토'), ('경', '금'), ('신', '금'), ('임', '수'), ('계', '수')]:
    ELEMENT_TERMS[f'image/cheongan/{st}'] = re.compile(f'{st}{el}')
for pos in ['년주', '연주', '월주', '일주', '시주', '일지', '월지', '년지', '연지']:
    key = pos.replace('연', '년')
    ELEMENT_TERMS[f'image/gungwi/{key}'] = re.compile(pos)
for e in ['목', '화', '토', '금', '수']:
    ELEMENT_TERMS[f'image/ohaeng/{e}'] = re.compile(f'{e}\\s?기운|{e} 오행|오행.{{0,6}}{e}')
for ss in ['도화', '홍염', '역마', '화개', '양인', '괴강', '백호', '귀문', '천을귀인']:
    ELEMENT_TERMS[f'image/sinsal/{ss}'] = re.compile(ss)

def txt(p):
    return html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()

def scan(hits, src, sid, pi, text):
    if not IMPRESSION.search(text):
        return
    for key, rx in ELEMENT_TERMS.items():
        if rx.search(text):
            e = hits[key]
            e['count'] += 1
            if len(e['refs']) < MAX_REFS:
                e['refs'].append({'s': src, 'id': sid, 'p': pi, 'x': text[:100]})

def main():
    hits = defaultdict(lambda: {'count': 0, 'refs': []})

    for path in sorted(glob.glob(os.path.join(REFINED, '*.docx'))):
        name = os.path.splitext(os.path.basename(path))[0]
        if '통합본' in name:
            continue
        xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
        for i, p in enumerate(PARA_RX.findall(xml)):
            t = txt(p)
            if len(t) > 20:
                scan(hits, 'b', name, i, t)

    yt = json.load(open(os.path.join(KB, 'yt_saju.json'), encoding='utf-8'))
    for x in yt:
        fp = os.path.join(YT_TXT, x['vid'] + '.txt')
        if not os.path.exists(fp):
            continue
        raw = open(fp, encoding='utf-8', errors='replace').read()
        for i, t in enumerate([s.strip() for s in raw.split('\n') if len(s.strip()) > 20]):
            scan(hits, 'y', x['vid'], i, t)

    for i, t in enumerate([l.strip() for l in open(BOARD, encoding='utf-8')]):
        if len(t) > 20:
            scan(hits, 'f', 'board', i, t)

    out = {k: v for k, v in sorted(hits.items(), key=lambda kv: -kv[1]['count'])}
    json.dump(out, open(os.path.join(KB, 'impression_index.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)

    total = sum(v['count'] for v in out.values())
    print(f'인상 지식 키 {len(out)}개, 문단 히트 {total:,}건\n')
    print('=== 커버리지 상위 25 ===')
    for k, v in list(out.items())[:25]:
        by = defaultdict(int)
        for r in v['refs']: by[r['s']] += 1
        print(f"{v['count']:4d}  {k}  (b{by['b']}/y{by['y']}/f{by['f']})")
    print('\n=== 공백(히트 5건 미만) — 보강 필요 요소 ===')
    thin = [k for k in ELEMENT_TERMS if out.get(k, {'count': 0})['count'] < 5]
    print(', '.join(t.replace('image/', '') for t in thin) or '없음')

if __name__ == '__main__':
    main()
