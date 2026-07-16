# -*- coding: utf-8 -*-
"""상호작용(조합) 지식 색인 — '바둑 한 수'에 달라붙는 지식의 문단 단위 전수 스캔.

원국에 어떤 글자가 놓이면 합충형파해원진·십신 체인·구조 판정이 연쇄로 붙는다.
그 조합 지식이 코퍼스 곳곳(블로그 전체 글·유튜브 강의·보드)에 흩어져 있으므로,
상호작용 키별로 "어느 문헌 몇 번째 문단에서 다루는지"를 전부 색인한다.

스캔 대상:
  1) 정제본/*.docx 전체 2,504글 (문단 단위 — 제목 매핑 946건에 한정하지 않음)
  2) 유튜브 명리 자막 184편 (kb/yt_saju.json + youtube-tools/book/fulltext/<vid>.txt)
  3) methodology/figjam_board_full.md (유료 입문강의 6개월 요약 — 최상위 기준)

출력: kb/interaction_index.json  { key: {count, refs:[{s,id,p,x}]}}
  s: b(블로그)|y(유튜브)|f(보드), id: 문서/vid/board, p: 문단 번호, x: 발췌(90자)
실행: python scan_interactions.py
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
MAX_REFS = 300

B = '자축인묘진사오미신유술해'
CHUNG = ['자오', '축미', '인신', '묘유', '진술', '사해']
YUKHAP = ['자축', '인해', '묘술', '진유', '사신', '오미']
STEM_HAP = ['갑기', '을경', '병신', '정임', '무계']
STEM_CHUNG = ['갑경', '을신', '병임', '정계']
PA = ['자유', '축진', '인해', '묘오', '사신', '술미']
HAE = ['자미', '축오', '인사', '묘진', '신해', '유술']
WONJIN = ['자미', '축오', '인유', '묘신', '진해', '사술']
HYEONG3 = ['인사신', '축술미']
HYEONG2 = ['인사', '사신', '인신', '축술', '술미', '축미', '자묘']
SAMHAP = ['신자진', '사유축', '인오술', '해묘미']
BANGHAP = ['인묘진', '사오미', '신유술', '해자축']

def pair_pat(pairs, suffix):
    # 양방향 + 붙임/띄움 허용: 자오충 | 오자충 | 자오 충
    alts = []
    for p in pairs:
        for q in (p, p[::-1] if len(p) == 2 else p):
            alts.append(q + r'\s?' + suffix)
    return '|'.join(dict.fromkeys(alts))

PATTERNS = {}
def add(key, pat):
    PATTERNS[key] = re.compile(pat)

for p in CHUNG: add(f'hapchung/충/{p}', pair_pat([p], '충'))
for p in YUKHAP: add(f'hapchung/육합/{p}', pair_pat([p], '합'))
for p in STEM_HAP: add(f'hapchung/천간합/{p}', pair_pat([p], '합'))
for p in STEM_CHUNG: add(f'hapchung/천간충/{p}', pair_pat([p], '충'))
for p in PA: add(f'hapchung/파/{p}', pair_pat([p], '파'))
for p in HAE: add(f'hapchung/해/{p}', pair_pat([p], '해'))
for p in WONJIN: add(f'hapchung/원진/{p}', pair_pat([p], '원진'))
for p in HYEONG3: add(f'hapchung/형/{p}', p + r'\s?(삼형|형)')
for p in HYEONG2: add(f'hapchung/형/{p}', pair_pat([p], '형'))
for p in SAMHAP: add(f'hapchung/삼합/{p}', p)
for p in BANGHAP: add(f'hapchung/방합/{p}', p)
add('hapchung/형/자형', r'자형\(|자형[을이은] |오오\s?자형|진진\s?자형|유유\s?자형|해해\s?자형')
add('hapchung/개념/반합', r'반합')
add('hapchung/개념/쟁합', r'쟁합|투합')
add('hapchung/개념/합거', r'합거')
add('hapchung/개념/충거', r'충거')
add('hapchung/개념/합충동시', r'합.{0,6}충.{0,10}(동시|같이|함께)|충.{0,6}합.{0,10}(동시|같이|함께)|합이\s?충을|충이\s?합을|충을\s?푸|충을\s?해소')
add('hapchung/개념/왕지충', r'왕지\s?충')
add('hapchung/개념/생지충', r'생지\s?충')
add('hapchung/개념/고지충', r'고지\s?충|묘고\s?충|입묘')
add('hapchung/개념/귀문', r'귀문')

# 십신 체인 (동선)
for name in ['식상생재', '식신생재', '상관생재', '재생관', '재생살', '관인상생', '살인상생',
             '군겁쟁재', '군비쟁재', '상관견관', '탐재괴인', '식신제살', '제살태과', '상관패인',
             '상관합살', '양인합살', '재극인', '비겁탈재', '관살혼잡', '살인상정', '아우생아']:
    add(f'chain/{name}', name)

# 구조 판정
for name, pat in [('신강', r'신강|신왕'), ('신약', r'신약'), ('극신약', r'극신약'), ('극신강', r'극신강'),
                  ('전왕', r'전왕|일행득기'), ('종격', r'종격|종재|종살|종아|종왕|종강'),
                  ('중화', r'중화'), ('조후', r'조후'), ('억부', r'억부'),
                  ('통근', r'통근'), ('투간', r'투간|투출'), ('득령', r'득령|실령'),
                  ('득지', r'득지'), ('득세', r'득세'), ('무관성', r'무관성|무\s?관성 사주|관성이 없'),
                  ('무식상', r'무식상|식상이 없'), ('무재성', r'무재성|재성이 없'),
                  ('무인성', r'무인성|인성이 없'), ('무비겁', r'무비겁|비겁이 없')]:
    add(f'frame/{name}', pat)

def txt(p):
    return html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()

def scan_para(key_hits, src, sid, pi, text):
    for key, rx in PATTERNS.items():
        m = rx.search(text)
        if m:
            e = key_hits[key]
            e['count'] += 1
            if len(e['refs']) < MAX_REFS:
                start = max(0, m.start() - 20)
                e['refs'].append({'s': src, 'id': sid, 'p': pi, 'x': text[start:start + 90]})

def main():
    hits = defaultdict(lambda: {'count': 0, 'refs': []})

    # 1) 정제본 전체
    n_docs = n_paras = 0
    for path in sorted(glob.glob(os.path.join(REFINED, '*.docx'))):
        name = os.path.splitext(os.path.basename(path))[0]
        if '통합본' in name:
            continue  # 통합본은 개별 문서의 중복
        xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
        paras = [txt(p) for p in PARA_RX.findall(xml)]
        for i, t in enumerate(paras):
            if len(t) > 15:
                scan_para(hits, 'b', name, i, t)
        n_docs += 1; n_paras += len(paras)

    # 2) 유튜브 명리 자막
    yt = json.load(open(os.path.join(KB, 'yt_saju.json'), encoding='utf-8'))
    n_yt = 0
    for x in yt:
        fp = os.path.join(YT_TXT, x['vid'] + '.txt')
        if not os.path.exists(fp):
            continue
        raw = open(fp, encoding='utf-8', errors='replace').read()
        for i, t in enumerate([s.strip() for s in raw.split('\n') if len(s.strip()) > 15]):
            scan_para(hits, 'y', x['vid'], i, t)
        n_yt += 1

    # 3) 보드
    if os.path.exists(BOARD):
        lines = [l.strip() for l in open(BOARD, encoding='utf-8')]
        for i, t in enumerate(lines):
            if len(t) > 15:
                scan_para(hits, 'f', 'board', i, t)

    out = {k: v for k, v in sorted(hits.items(), key=lambda kv: -kv[1]['count'])}
    json.dump(out, open(os.path.join(KB, 'interaction_index.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)

    total = sum(v['count'] for v in out.values())
    print(f'스캔: 블로그 {n_docs}문서 {n_paras:,}문단 + 유튜브 {n_yt}편 + 보드')
    print(f'상호작용 키 {len(out)}개 적중, 문단 히트 총 {total:,}건\n')
    print('=== 상위 40 ===')
    for k, v in list(out.items())[:40]:
        by = defaultdict(int)
        for r in v['refs']: by[r['s']] += 1
        print(f"{v['count']:5d}  {k}  (b{by['b']}/y{by['y']}/f{by['f']} 표본)")

if __name__ == '__main__':
    main()
