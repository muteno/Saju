# -*- coding: utf-8 -*-
"""상호작용 키 증류용 번들 — interaction_index의 근거 문단을 전후 맥락(±2문단)과 함께 모은다.

사용: python prepare_interaction_bundles.py "hapchung/충/묘유" ["chain/식상생재" ...]
      python prepare_interaction_bundles.py --top 30   # 히트 상위 30개 키 일괄
출력: kb/distill_src/ix_<키>.md  (git 제외)

번들 구성: 소스(보드→유튜브→블로그 순, 보드가 1순위 기준)별로
  [출처 표기] + 매칭 문단(±2 맥락) 블록. 중복 문단은 병합.
"""
import json, os, re, sys, glob, zipfile, html
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KB = os.path.join(HERE, '..', 'kb')
REFINED = os.path.join(ROOT, '정제본')
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
BOARD = os.path.join(HERE, '..', 'methodology', 'figjam_board_full.md')
PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)
CTX = 2
MAX_BLOCKS_PER_SRC_TYPE = {'f': 999, 'y': 40, 'b': 60}  # 보드는 전량, 강의·블로그는 상한

_doc_cache = {}
def blog_paras(doc):
    if doc not in _doc_cache:
        path = os.path.join(REFINED, doc + '.docx')
        xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
        _doc_cache[doc] = [html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()
                           for p in PARA_RX.findall(xml)]
    return _doc_cache[doc]

_yt_cache = {}
def yt_paras(vid):
    if vid not in _yt_cache:
        raw = open(os.path.join(YT_TXT, vid + '.txt'), encoding='utf-8', errors='replace').read()
        _yt_cache[vid] = [s.strip() for s in raw.split('\n') if len(s.strip()) > 15]
    return _yt_cache[vid]

_board_lines = None
def board_paras():
    global _board_lines
    if _board_lines is None:
        _board_lines = [l.strip() for l in open(BOARD, encoding='utf-8')]
    return _board_lines

def yt_title_map():
    yt = json.load(open(os.path.join(KB, 'yt_saju.json'), encoding='utf-8'))
    return {x['vid']: x['title'] for x in yt}

def build(key, index, titles):
    entry = index.get(key)
    if not entry:
        print(f'키 없음: {key}')
        return
    by_src = defaultdict(lambda: defaultdict(set))  # src_type → id → {para indices}
    for r in entry['refs']:
        by_src[r['s']][r['id']].add(r['p'])

    lines = [f'# 증류 원료(상호작용): {key}', f'(전체 히트 {entry["count"]}건 중 표본 {len(entry["refs"])}건, 전후 ±{CTX}문단 포함)', '']
    for src in ('f', 'y', 'b'):
        label = {'f': '방법론 보드(유료강의 요약 — 1순위 기준)', 'y': '유튜브 강의', 'b': '블로그 문헌'}[src]
        ids = by_src.get(src)
        if not ids:
            continue
        lines.append(f'## {label}')
        nblocks = 0
        for sid, pset in ids.items():
            if nblocks >= MAX_BLOCKS_PER_SRC_TYPE[src]:
                lines.append(f'(…{label} 블록 상한 도달 — 나머지는 interaction_index 참조)')
                break
            paras = board_paras() if src == 'f' else yt_paras(sid) if src == 'y' else blog_paras(sid)
            title = 'board' if src == 'f' else titles.get(sid, sid) if src == 'y' else sid
            # 매칭 문단들을 ±CTX 확장 후 구간 병합
            spans = []
            for p in sorted(pset):
                lo, hi = max(0, p - CTX), min(len(paras) - 1, p + CTX)
                if spans and lo <= spans[-1][1] + 1:
                    spans[-1][1] = max(spans[-1][1], hi)
                else:
                    spans.append([lo, hi])
            for lo, hi in spans:
                lines.append(f'### [출처 {src}:{sid} 문단 {lo}-{hi}] {title}')
                for i in range(lo, hi + 1):
                    t = paras[i]
                    if t:
                        lines.append(t)
                lines.append('')
                nblocks += 1
        lines.append('')

    outdir = os.path.join(KB, 'distill_src')
    os.makedirs(outdir, exist_ok=True)
    fn = 'ix_' + key.replace('/', '_') + '.md'
    text = '\n'.join(lines)
    open(os.path.join(outdir, fn), 'w', encoding='utf-8').write(text)
    print(f'{fn}: {len(text):,}자')

def main():
    args = sys.argv[1:]
    idx_file = 'interaction_index.json'
    if args and args[0] == '--index':
        idx_file = args[1]; args = args[2:]
    index = json.load(open(os.path.join(KB, idx_file), encoding='utf-8'))
    titles = yt_title_map()
    if args and args[0] == '--top':
        n = int(args[1]) if len(args) > 1 else 30
        keys = list(index.keys())[:n]
    else:
        keys = args
    for k in keys:
        build(k, index, titles)

if __name__ == '__main__':
    main()
