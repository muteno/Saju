# -*- coding: utf-8 -*-
"""증류본 검증기 — kb/distilled/**/*.json 전수 검사.

반환각 원칙: 증류본의 모든 주장은 코퍼스에 근거해야 한다.
  1. 스키마 필수 필드 (key/title/sources/distilled/인용)
  2. sources.unit 이 unit_index(해당 키의 별칭 체인 포함)와 unit_bodies에 실존
  3. 인용.text 가 해당 출처 유닛 본문에 '축자(verbatim)'로 존재  ← 핵심
  4. 관점차이.견해.src 가 sources 목록에 존재
  5. ilju/* 키는 elements(일지십신·십이운성·공망)를 엔진(node)으로 재계산해 대조

실행: python validate_distilled.py
"""
import json, os, glob, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KB = os.path.join(HERE, '..', 'kb')
ENGINE = os.path.join(HERE, '..', 'engine').replace(os.sep, '/')

NODE = r'''
import { STEMS, BRANCHES, HIDDEN_STEMS, TEN_GODS, tenGod, twelveStage, TWELVE_STAGES, sexIndex } from '%E%/src/tables.js';
import { gongmang } from '%E%/src/sinsal.js';
const [stem, branch] = process.argv[2].split(',');
const s = STEMS.indexOf(stem), b = BRANCHES.indexOf(branch);
const hs = HIDDEN_STEMS[b];
console.log(JSON.stringify({
  일지십신: TEN_GODS[tenGod(s, hs[hs.length - 1])],
  십이운성: TWELVE_STAGES[twelveStage(s, b)],
  공망: gongmang(sexIndex(s, b)).map(x => BRANCHES[x]).join(''),
}));
'''

def engine_elements(stem, branch):
    tmp = os.path.join(HERE, '_val.mjs')
    open(tmp, 'w', encoding='utf-8').write(NODE.replace('%E%', ENGINE))
    try:
        out = subprocess.run(['node', tmp, f'{stem},{branch}'], capture_output=True, text=True, check=True).stdout
    finally:
        os.remove(tmp)
    return json.loads(out)

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
BOARD = os.path.join(HERE, '..', 'methodology', 'figjam_board_full.md')

def source_text(unit, bodies):
    """유닛 참조 → 원문 텍스트. 블로그(unit_index 키) / yt:<vid> / board 지원."""
    if unit == 'board':
        return open(BOARD, encoding='utf-8').read()
    if unit.startswith('yt:'):
        fp = os.path.join(YT_TXT, unit[3:] + '.txt')
        return open(fp, encoding='utf-8', errors='replace').read() if os.path.exists(fp) else None
    b = bodies.get(unit)
    return '\n'.join(b['paras']) if b else None

def main():
    index = json.load(open(os.path.join(KB, 'unit_index.json'), encoding='utf-8'))
    aliases = {k: v for k, v in json.load(open(os.path.join(KB, 'aliases.json'), encoding='utf-8')).items() if not k.startswith('_')}
    bodies = json.load(open(os.path.join(KB, 'unit_bodies.json'), encoding='utf-8'))
    yt_vids = {x['vid'] for x in json.load(open(os.path.join(KB, 'yt_saju.json'), encoding='utf-8'))}

    files = sorted(glob.glob(os.path.join(KB, 'distilled', '**', '*.json'), recursive=True))
    errors, n_quotes = [], 0
    for path in files:
        d = json.load(open(path, encoding='utf-8'))
        name = os.path.relpath(path, os.path.join(KB, 'distilled'))
        err = lambda m: errors.append(f'{name}: {m}')

        for field in ['key', 'title', 'sources', 'distilled', '인용']:
            if field not in d: err(f'필수 필드 없음: {field}')
        if errors and errors[-1].startswith(name): continue

        chain = aliases.get(d['key'], [d['key']])
        indexed = {e['key'] for c in chain for e in index.get(c, [])}
        src_units = set()
        for s in d['sources']:
            src_units.add(s['unit'])
            if s['unit'] == 'board':
                continue  # 방법론 보드 — 항상 유효
            if s['unit'].startswith('yt:'):
                if s['unit'][3:] not in yt_vids: err(f"유튜브 출처가 yt_saju에 없음: {s['unit']}")
                continue
            if s['unit'] not in indexed: err(f"출처가 색인에 없음: {s['unit']}")
            if s['unit'] not in bodies: err(f"출처 본문 없음: {s['unit']}")

        for q in d.get('인용', []):
            n_quotes += 1
            if q['src'] not in src_units:
                err(f"인용 출처가 sources에 없음: {q['src']}")
            joined = source_text(q['src'], bodies) or ''
            if q['text'] not in joined:
                err(f"인용문이 원문에 없음(축자 불일치): {q['text'][:40]}…")

        for pd in d.get('관점차이', []):
            for v in pd.get('견해', []):
                if v['src'] not in src_units: err(f"관점차이 출처가 sources에 없음: {v['src']}")

        if d['key'].startswith('ilju/') and 'elements' in d:
            gj = d['key'].split('/')[1]
            calc = engine_elements(gj[0], gj[1])
            for k, v in calc.items():
                if d['elements'].get(k) != v:
                    err(f'elements.{k} 불일치: 증류본={d["elements"].get(k)} 엔진={v}')

    print(f'검사: 파일 {len(files)}개, 인용 {n_quotes}건')
    if errors:
        print(f'실패 {len(errors)}건:')
        for e in errors: print(' -', e)
        sys.exit(1)
    print('전부 통과')

if __name__ == '__main__':
    main()
