"""Preserve source disagreements and reproduce existing Hyeonchim markers.

Board cells are observations: an unmarked cell is NOT a negative rule. The ASR
sources are not corrected or converted into a personal inference policy.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
REVIEW = HERE / 'data/foundation_hyeonchim_review.json'
MEASUREMENT = HERE / 'data/foundation_hyeonchim_measurement.json'
BASE = '5afcb70816ceb17c6bec84b0853f7c03e8e0d56c'
STEMS = '甲乙丙丁戊己庚辛壬癸'
BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
POSITIONS = ('year', 'month', 'day', 'hour')
BINDINGS = {
    'count_ambiguity': ['choco_count', 'choco_hidden'],
    'five_members_asr': ['choco_members'],
    'combine_weakening': ['choco_combine'],
    'hidden_scope': ['choco_hidden'],
    'counterview': ['saram_example', 'saram_reject'],
    'partial_web': ['study_myo', 'study_members'],
    'interpretation_not_rule': ['intro_interpretation'],
}

# Reviewed BASE coordinates/hashes are anchored independently of the editable JSON.
EVIDENCE_SPECS = {'choco_members': {'path': '정제/원본/전사/1. 초코명리/초코서당(초명)/20240419_현침살이 있으면 능력자가 됩니다__Kvzaz2OhXA.md',
                   'lines': [21, 34],
                   'sha256': '70554166f972c0fc3b7b9d8a966434bf415d842010e49533a455d7b23dff1714',
                   'source_profile': 'choco',
                   'status': 'unverified_asr'},
 'choco_count': {'path': '정제/원본/전사/1. 초코명리/초코서당(초명)/20240419_현침살이 있으면 능력자가 됩니다__Kvzaz2OhXA.md',
                 'lines': [35, 44],
                 'sha256': '70554166f972c0fc3b7b9d8a966434bf415d842010e49533a455d7b23dff1714',
                 'source_profile': 'choco',
                 'status': 'unverified_asr'},
 'choco_combine': {'path': '정제/원본/전사/1. 초코명리/초코서당(초명)/20240419_현침살이 있으면 능력자가 됩니다__Kvzaz2OhXA.md',
                   'lines': [61, 70],
                   'sha256': '70554166f972c0fc3b7b9d8a966434bf415d842010e49533a455d7b23dff1714',
                   'source_profile': 'choco',
                   'status': 'unverified_asr'},
 'choco_hidden': {'path': '정제/원본/전사/1. 초코명리/초코서당(초명)/20240419_현침살이 있으면 능력자가 됩니다__Kvzaz2OhXA.md',
                  'lines': [92, 97],
                  'sha256': '70554166f972c0fc3b7b9d8a966434bf415d842010e49533a455d7b23dff1714',
                  'source_profile': 'choco',
                  'status': 'unverified_asr'},
 'saram_example': {'path': '정제/원본/전사/4. 사람공부/사람공부/20201204_[명리한담] 현침살_Uj_ugiIBH_E.md',
                   'lines': [65, 72],
                   'sha256': '59ee384d7e8525b1f7f49d287fb4342ea78486fd705ccf5de648d5ce9963a87e',
                   'source_profile': 'saram',
                   'status': 'unverified_asr'},
 'saram_reject': {'path': '정제/원본/전사/4. 사람공부/사람공부/20201204_[명리한담] 현침살_Uj_ugiIBH_E.md',
                  'lines': [96, 101],
                  'sha256': '59ee384d7e8525b1f7f49d287fb4342ea78486fd705ccf5de648d5ce9963a87e',
                  'source_profile': 'saram',
                  'status': 'unverified_asr'},
 'study_myo': {'path': '정제/원본/P0_인벤토리/webtxt_v1/사주공부-명리 중급 글모음.txt',
               'lines': [6253, 6253],
               'sha256': '18f4578fe0599baba0df5a76bfebf5aee88f99921fdd6d01196ff0ac0353ac9b',
               'source_profile': 'study',
               'status': 'preserved_source'},
 'study_members': {'path': '정제/원본/P0_인벤토리/webtxt_v1/사주공부-명리 중급 글모음.txt',
                   'lines': [6216, 6216],
                   'sha256': '18f4578fe0599baba0df5a76bfebf5aee88f99921fdd6d01196ff0ac0353ac9b',
                   'source_profile': 'study',
                   'status': 'preserved_source'},
 'intro_interpretation': {'path': '정제/원본/P0_인벤토리/webtxt_v1/명리학입문 게시판 글모음.txt',
                          'lines': [856, 858],
                          'sha256': 'ca3b48d23d57570caa7204d2cf3c2c51b7539e031aa8855d93a4728527f38aa6',
                          'source_profile': 'intro',
                          'status': 'preserved_source'}}
FROZEN_INPUTS = {'dosa-app/engine/src/sinsal.js': '83160a812f3e3c78f27881002332e335f944656efce0a0c2058ae5505cebc32d',
 'dosa-app/engine/src/tables.js': '94988a5b27d831a4e30b6d503040fb9235d5b103943a86f8f66a247f9b71f2e3',
 'dosa-app/engine/src/keyset.js': '3e460f1355221138df5d25a7c7b6759272e16c717062ed4f9a483eac021e48a7',
 'dosa-app/engine/src/report.js': 'bc598498402c426afc1336b12f75051c72f8088a53a19fd03d59d6a6b20e02bc',
 'dosa-app/engine/src/judge.js': '6f0f53d223bb7e159650145e201f0db2c94d2d6067ace86a79b1dc45daa8045d',
 'dosa-app/engine/src/manseryeok.js': 'b401b6dc14f6f7828b6d23d6d4ee92c90c2d0261faea19873eda284da35239c1',
 'dosa-app/engine/src/relations.js': 'fdc6f4b3674b3821940e10b89c0beab6916ddb92bcf12ad87358e3d6d0297acb',
 'dosa-app/engine/src/unse.js': '0f195d42addad6a1fe3688c994a199c84714a305f4fab63dc4e74bd7500f0408',
 'app/src/engine/index.js': '359e1d4bdbf3bada8359207a2025690c7349736eae6a10acbf1e8c06ab398bff',
 'app/src/data/saju.ts': '978e285afbb67677af55a4562288c871a16d9be2697b1faf2193f317ca7f6f51',
 'app/src/data/dosaTopics.ts': '198924572a41febae32cf81ae7e39c9bd5687867df8196080cdc6b0d32eb8172',
 'app/src/data/useReport.ts': 'f352b9207b7535fa17b4aaf009a358ff5deac0efca6d2f3bcfb8980b80947a96',
 'docs/knowledge-model/data/foundation_taxonomy_review.json': '4083f3236be1285a8b7229b72fbc83a3887175c9a910b6ee8cc703c6c4c581be',
 'docs/knowledge-model/data/foundation_calculation_review.json': 'f3dc94ae6a14b65d98be04b08e9fe2884b6e5d8cf2fc67abcf7be7f3541b79b8',
 'docs/knowledge-model/data/foundation_calculation_measurement.json': '9647c836531ef36b027cc04744b3732d8528d67683c5024a6458678871d8647e',
 'docs/knowledge-model/data/foundation_timezone_measurement.json': 'd37e55b00b8afe57fa9d5267de6ae95ee3130e1916e3df61c3479c692eb9094e',
 'docs/knowledge-model/data/foundation_strength_consumers.json': '0e1a114e2b3d67eadbcec4f2563b4ae028e8449adb9ebe201c0019756eb4fcad',
 'docs/knowledge-model/data/foundation_strength_correction.json': 'bb4ee97719dcdf7742e27883f1bdf80baf7e145c00dcfc2409c61a8a7a17cd92',
 'docs/knowledge-model/data/foundation_month_period_review.json': '2020f24b03e75ee7a4a188f7908f46a31593b3817cabe2a91352e9274dfe7c15',
 'docs/knowledge-model/data/foundation_month_period_measurement.json': 'caa2dbabbd9dbbea35003f90794f97790bc2b73137a33f0225b725da1c4877a8'}
BOARD_SHA256 = 'de4883a873e3e332f3e77c3fbd2c2fac10dd8759de1704df69704b250292fe4b'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def inside(path, root):
    relative = Path(path)
    resolved = (root / relative).resolve()
    require(not relative.is_absolute() and resolved.is_relative_to(root.resolve()),
            'Source must stay inside repository')
    return resolved


def validate(review, root=ROOT):
    require(type(review['schema_version']) is int and review['schema_version'] == 1
            and review['base_commit'] == BASE, 'Wrong review version/base')
    require(review['scope'] == 'hyeonchim_source_audit_only'
            and review['hash_policy'] == 'sha256_lf_git_text'
            and review['line_policy'] == 'python_str_splitlines_1based', 'Wrong audit contract')
    require(review['inference_enabled'] is False and review['probability'] is None
            and review['use_as_training_labels'] is False, 'Personal inference/training forbidden')
    evidence = review['evidence']
    ids = {e['id'] for e in evidence}
    require(len(ids) == len(evidence) == 9 and ids == {i for v in BINDINGS.values() for i in v},
            'Missing/duplicate evidence')
    for e in evidence:
        require({k: e[k] for k in EVIDENCE_SPECS[e['id']]} == EVIDENCE_SPECS[e['id']],
                'Reviewed evidence binding changed: ' + e['id'])
        path = inside(e['path'], root)
        require(digest(path) == e['sha256'], 'Source hash changed: ' + e['id'])
        lines = path.read_text(encoding='utf-8-sig').splitlines()
        a, b = e['lines']
        require(type(a) is int and type(b) is int and 1 <= a <= b <= len(lines), 'Invalid evidence range')
        require(bool(e['quote']) and e['quote'] == '\n'.join(lines[a-1:b]), 'Evidence mismatch: ' + e['id'])
        profile = e['id'].split('_')[0]
        require(e['source_profile'] == profile, 'Wrong source profile')
        require(e['status'] == ('unverified_asr' if profile in ('choco', 'saram') else 'preserved_source')
                and e['use_as_training_labels'] is False, 'Source qualification changed')
    claims = review['claims']
    require(len(claims) == 7 and {c['id'] for c in claims} == set(BINDINGS), 'Wrong claim set')
    for c in claims:
        require(c['evidence_ids'] == BINDINGS[c['id']], 'Source binding changed')
        require(bool(c['statement'].strip()) and c['application_status'] == 'withheld'
                and c['probability'] is None, 'Unreviewed claim application')
    board = review['board']
    require(board['path'] == 'dosa-app/methodology/figjam_board_raw.txt'
            and board['table_id'] == '384:5593'
            and type(board['rows']) is int and board['rows'] == 28
            and type(board['columns']) is int and board['columns'] == 11,
            'Wrong source table')
    require(board['interpretation'] == 'cell_observation_not_personal_rule'
            and board['blank_means'] == 'not_listed_not_negative'
            and all(board[k] is None for k in ('count_scope', 'adjacency_rule', 'fortune_layer_rule')),
            'Unreviewed board interpretation')
    require(board['sha256'] == BOARD_SHA256
            and digest(inside(board['path'], root)) == BOARD_SHA256, 'Board changed')
    require(review['frozen_inputs'] == FROZEN_INPUTS, 'Frozen BASE input manifest changed')
    for path, expected in review['frozen_inputs'].items():
        require(digest(inside(path, root)) == expected, 'Frozen input changed: ' + path)
    return review


def load_review():
    return validate(json.loads(REVIEW.read_text(encoding='utf-8')))


def board_cells(review, root=ROOT):
    """Read row/column coordinates, not serialization order or nearby text."""
    validate(review, root)
    text = inside(review['board']['path'], root).read_text(encoding='utf-8-sig')
    tables = re.findall(r'<table id="384:5593"[^>]*>.*?</table>', text, re.S)
    require(len(tables) == 1, 'Missing/duplicate board table')
    cells = {}
    for attrs, content in re.findall(r'<table-cell ([^>]+)>(.*?)</table-cell>', tables[0], re.S):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        key = (int(a['tableCellRowIndex']), int(a['tableCellColumnIndex']))
        require(key not in cells, 'Duplicate board coordinate')
        cells[key] = {'node_id': a['id'], 'text': content}
    require(set(cells) == {(r, c) for r in range(28) for c in range(11)}, 'Incomplete board grid')
    result = []
    for col in range(1, 11):
        header = cells[0, col]
        require(header['text'].startswith('갑을병정무기경신임계'[col-1] + '('), 'Changed Korean header')
        for row in range(4, 27, 2):
            branch = cells[row-1, col]
            matches = re.findall(r'[子丑寅卯辰巳午未申酉戌亥]', branch['text'])
            require(len(matches) == 1, 'Ambiguous branch header')
            marker = cells[row, col]
            listed = '현침살' in marker['text']
            result.append({'stem': STEMS[col-1], 'branch': matches[0], 'row': row, 'column': col,
                           'header': dict(header), 'branch_cell': dict(branch), 'marker_cell': dict(marker),
                           'header_hanja_matches': f'({STEMS[col-1]})' in header['text'],
                           'listed': listed, 'count_note': '2개 이상必' if listed and '2개 이상必' in marker['text'] else None,
                           'personal_application': 'withheld'})
    require(len({(x['stem'], x['branch']) for x in result}) == 120, 'Repeated/missing branch coordinates')
    return result


def engine_observations():
    result = subprocess.run(['node', str(HERE / 'measure_hyeonchim_engine.mjs')], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8', timeout=60)
    require(result.returncode == 0, result.stdout + result.stderr)
    return json.loads(result.stdout)


def measure(review=None):
    review = load_review() if review is None else validate(review)
    cells = board_cells(review)
    engine = engine_observations()
    day = {r['index']: r['observations']['day'] for r in engine['singlePillars'] if r['position'] == 'day'}
    by_pair = {(c['stem'], c['branch']): c for c in cells}
    comparison = []
    for i in range(60):
        c = by_pair[STEMS[i % 10], BRANCHES[i % 12]]
        comparison.append({'index': i, 'name': c['stem'] + c['branch'],
                           'board_node_id': c['marker_cell']['node_id'],
                           'board_listed': c['listed'], 'board_count_note': c['count_note'],
                           'engine_same_pillar_markers': int(day[i]['stem']) + int(day[i]['branch']),
                           'scope': 'same_pillar_diagnostic_not_board_target_position_policy',
                           'personal_application': 'withheld'})
    files = ['docs/knowledge-model/hyeonchim_review.py', 'docs/knowledge-model/measure_hyeonchim_engine.mjs',
             'docs/knowledge-model/data/foundation_hyeonchim_review.json', 'dosa-app/engine/data/solar_terms.json']
    return {'schema_version': 1, 'base_commit': BASE, 'inference_enabled': False, 'probability': None,
            'use_as_training_labels': False, 'input_hashes': dict(review['frozen_inputs']),
            'implementation_hashes': {p: digest(ROOT / p) for p in files},
            'summary': {'board_cells': len(cells), 'board_listed': sum(c['listed'] for c in cells),
                        'board_count_notes': sum(c['count_note'] is not None for c in cells),
                        'engine_single_pillar_inputs': len(engine['singlePillars']),
                        'combination_inputs': len(engine['combinations']), 'report_inputs': len(engine['reports']),
                        'engine_marked_board_unlisted': [r['name'] for r in comparison if r['engine_same_pillar_markers'] and not r['board_listed']]},
            'board_cells': cells, 'same_pillar_comparison': comparison, 'engine': engine}


def same_json(left, right):
    # Python equality treats True == 1 and False == 0; JSON must preserve types.
    return json.dumps(left, sort_keys=True, allow_nan=False) == json.dumps(right, sort_keys=True, allow_nan=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--write-measurement', action='store_true')
    args = parser.parse_args()
    result = measure()
    if args.write_measurement:
        MEASUREMENT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    else:
        require(same_json(result, json.loads(MEASUREMENT.read_text(encoding='utf-8'))), 'Measurement changed')
    # ASCII JSON remains readable by JSON parsers on non-UTF-8 consoles.
    print(json.dumps(result['summary'], ensure_ascii=True))


if __name__ == '__main__':
    main()
