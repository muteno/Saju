# -*- coding: utf-8 -*-
"""끝-대-끝 스모크: 생년월일시 → (node 엔진) 키셋 → (aliases) → unit_index → unit_bodies.

결정론 조회 경로 전체가 실제로 근거 문헌을 돌려주는지 검증한다.
실행: python smoke_lookup.py [YYYY-MM-DD HH:MM M|F]  (기본: 포스텔러 픽스처)
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KB = os.path.join(HERE, '..', 'kb')
ENGINE = os.path.join(HERE, '..', 'engine')

NODE_SNIPPET = r'''
import { readFileSync } from 'node:fs';
import { computeChart } from '%ENGINE%/src/manseryeok.js';
import { chartToKeys } from '%ENGINE%/src/keyset.js';
const { terms } = JSON.parse(readFileSync('%ENGINE%/data/solar_terms.json', 'utf-8'));
const [y, mo, d, h, mi, g, unse] = process.argv.slice(2);
const chart = computeChart({ year: +y, month: +mo, day: +d, hour: +h, minute: +mi, gender: g }, terms);
const ks = chartToKeys(chart, { unseYearName: unse });
console.log(JSON.stringify({ saju: Object.fromEntries(Object.entries(chart.saju).map(([k, v]) => [k, v.name])),
  daeun: chart.daeun.su, keys: ks.keys }, null, 0));
'''

def main():
    args = sys.argv[1:]
    if args:
        ymd, hm, g = args[0], args[1], args[2]
        y, mo, d = ymd.split('-'); h, mi = hm.split(':')
    else:
        y, mo, d, h, mi, g = '1990', '1', '1', '12', '0', 'F'
    unse = '병오'  # 2026

    snippet = NODE_SNIPPET.replace('%ENGINE%', ENGINE.replace(os.sep, '/'))
    tmp = os.path.join(HERE, '_emit_keys.mjs')
    open(tmp, 'w', encoding='utf-8').write(snippet)
    try:
        out = subprocess.run(['node', tmp, y, mo, d, h, mi, g, unse],
                             capture_output=True, text=True, check=True).stdout
    finally:
        os.remove(tmp)
    data = json.loads(out)
    print('사주:', ' '.join(f"{p}={n}" for p, n in data['saju'].items()), f"대운수={data['daeun']}")
    print(f"방출 키 {len(data['keys'])}개\n")

    index = json.load(open(os.path.join(KB, 'unit_index.json'), encoding='utf-8'))
    aliases = {k: v for k, v in json.load(open(os.path.join(KB, 'aliases.json'), encoding='utf-8')).items() if not k.startswith('_')}
    bodies = json.load(open(os.path.join(KB, 'unit_bodies.json'), encoding='utf-8'))

    total_units, missing = 0, []
    for key in data['keys']:
        chain = aliases.get(key, [key])
        found = []
        for c in chain:
            for e in index.get(c, []):
                if e['key'] not in [f['key'] for f in found]:
                    found.append(e)
        nparas = sum(len(bodies[e['key']]['paras']) for e in found if e['key'] in bodies)
        total_units += len(found)
        status = f'유닛 {len(found):2d}건, 문단 {nparas:4d}' if found else '--- 소장 문헌 없음 ---'
        print(f'  {key:32s} {status}')
        if not found:
            missing.append(key)
    print(f'\n합계: 근거 유닛 {total_units}건 / 키 {len(data["keys"])}개 (문헌 없음 {len(missing)}건: {missing})')

if __name__ == '__main__':
    main()
