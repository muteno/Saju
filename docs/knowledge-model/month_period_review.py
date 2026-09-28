"""Source-period audit. Synthetic offsets are NOT birth dates or probabilities.

The stored sources do not define a complete astronomical/calendar policy. This
module compares cumulative lengths only; no chart or application imports it.
"""
import argparse
from copy import deepcopy
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]
REVIEW = Path('docs/knowledge-model/data/foundation_month_period_review.json')
MEASUREMENT = Path('docs/knowledge-model/data/foundation_month_period_measurement.json')
BASE = 'b83f8de4cd74c34a549644607f3789e58e7b90af'
BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
STEMS = '甲乙丙丁戊己庚辛壬癸'
STAGES = ('초기', '중기', '정기')
MISSING = ('actual_solar_entry_utc', 'birth_time_zone', 'elapsed_day_origin',
           'endpoint_inclusion', 'actual_month_to_30_day_mapping', 'after_30_days')
FROZEN = (
    'dosa-app/engine/src/tables.js', 'dosa-app/engine/src/manseryeok.js',
    'dosa-app/engine/src/judge.js', 'docs/knowledge-model/chart_context.mjs',
    'docs/knowledge-model/chart_context_v2.mjs',
    'docs/knowledge-model/data/foundation_taxonomy_review.json',
    'docs/knowledge-model/data/foundation_calculation_review.json',
    'docs/knowledge-model/data/foundation_calculation_measurement.json',
    'docs/knowledge-model/data/foundation_timezone_measurement.json',
    'docs/knowledge-model/data/foundation_strength_consumers.json',
    'docs/knowledge-model/data/foundation_strength_correction.json',
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def load_review(repo=REPO):
    review = json.loads((repo / REVIEW).read_text(encoding='utf-8'))
    validate(review, repo)
    return review


def validate(review, repo=REPO):
    require(review['schema_version'] == 1 and review['base_commit'] == BASE,
            'Unexpected source review version/base')
    require(review['hash_policy'] == 'sha256_lf_git_text'
            and review['scope'] == 'source_period_review_only', 'Wrong review scope')
    require(review['line_policy'] == 'python_str_splitlines_1based', 'Unknown source coordinates')
    require(review['inference_enabled'] is False
            and review['use_as_training_labels'] is False
            and review['probability'] is None, 'No personal inference or training')
    evidence = review['evidence']
    by_id = {e['id']: e for e in evidence}
    require(len(by_id) == len(evidence) == 23, 'Missing/duplicate evidence')
    texts = {}
    for e in evidence:
        relative = Path(e['path'])
        path = (repo / relative).resolve()
        require(not relative.is_absolute() and path.is_relative_to(repo.resolve()),
                'Evidence must stay inside repository')
        if path not in texts:
            texts[path] = (digest(path), path.read_text(encoding='utf-8-sig').splitlines())
        sha, lines = texts[path]
        require(sha == e['sha256'], 'Source hash changed: ' + e['id'])
        bounds = e['lines']
        require(len(bounds) == 2 and all(type(n) is int for n in bounds), 'Invalid lines')
        a, b = bounds
        require(1 <= a <= b <= len(lines), 'Out-of-range evidence')
        require(bool(e['quote']) and e['quote'] in '\n'.join(lines[a-1:b]),
                'Quote mismatch: ' + e['id'])
        require(e['source_profile'] in {'board_snapshot','choco','sagong','seokwoodang_asr'}
                and e['role'] == 'attributed_source_only', 'Unattributed source')

    used = set()
    def refs(ids, profile=None):
        require(bool(ids) and len(ids) == len(set(ids))
                and all(i in by_id for i in ids), 'Unknown/duplicate evidence link')
        if profile:
            require(all(by_id[i]['source_profile'] == profile for i in ids),
                    'Cross-author policy')
        used.update(ids)

    variants = review['period_variants']
    bindings = {
        'sagong_table': ('sagong', ['period_sagong_table']),
        'sagong_prose': ('sagong', ['month_sagong_scope','month_sagong_wu_table']),
        'choco_prose': ('choco', ['month_choco_period']),
    }
    require([v['id'] for v in variants] == ['sagong_table','sagong_prose','choco_prose'],
            'Unexpected period variants')
    for v in variants:
        require((v['source_profile'],v['evidence_ids']) == bindings[v['id']],
                'Period variant lost its reviewed source binding')
        refs(v['evidence_ids'], v['source_profile'])
        require(v['reference_days'] == 30 and v['scope'] == 'month_branch'
                and v['personal_application'] == 'withheld', 'Unreviewed scope')
        require(v['boundary_policy'] == dict.fromkeys(MISSING), 'Unreviewed calendar policy')
        if v['id'] == 'sagong_table':
            require(v['kind'] == 'stem_period_table' and v['periods'] is None,
                    'Table must be parsed from source')
        else:
            require(v['kind'] == 'stage_duration_prose' and v['periods'] == {
                'birth':[7,7,16], 'peak':[10,None,20],
                'storage':[9,3,18], 'wu':[10,10,10]}, 'Prose duration changed')
    claims = review['claims']
    require(len(claims) == len({c['id'] for c in claims}) == 11, 'Missing/duplicate claims')
    for c in claims:
        refs(c['evidence_ids'])
        require(c['status'] == 'source_claim' and bool(c['statement'].strip()), 'Invalid claim')
    expected = [('myo_local','卯',[33,None,67],'stages_choco_myo_ratio'),
                ('myo_group','卯',[30,None,60],'stages_choco_wang_ratio'),
                ('wu_power','午',[33,30,37],'period_choco_wu_ratio')]
    require([(p['id'],p['branch'],p['values'],p['evidence_id'])
             for p in review['power_variants']] == expected, 'Power conflict must be preserved')
    for p in review['power_variants']:
        refs([p['evidence_id']], 'choco')
        require(p['unit'] == 'source_asserted_power_percent', 'Power is not probability/days')
    require(used == set(by_id), 'Unlinked evidence')
    contract = review['comparison_contract']
    require(contract['axis'] == 'synthetic_30_day_offset_not_birth_time'
            and contract['origin'] == 'implementation_defined_zero'
            and contract['internal_endpoints'] == 'return_both_adjacent_candidates'
            and contract['outer_endpoints'] == 'withhold_at_0_and_30'
            and contract['personal_application'] == 'withheld', 'Comparison must not become chart policy')
    period_table(review)


def period_table(review):
    """Parse the complete source table, retaining empty middle-stage cells."""
    quote = next(e['quote'] for e in review['evidence'] if e['id'] == 'period_sagong_table')
    rows = [[x.strip() for x in line.split('|')] for line in quote.splitlines()[:4]]
    require(rows[0] == ['지지', *BRANCHES], 'Missing/changed source table header')
    require([row[0] for row in rows[1:]] == list(STAGES)
            and all(len(row) == 13 for row in rows), 'Malformed table or lost empty cells')
    result = {}
    for i, branch in enumerate(BRANCHES, 1):
        slots = []
        for stage, row in zip(STAGES, rows[1:]):
            cell = row[i]
            if not cell:
                require(stage == '중기', 'Missing non-middle stage')
                continue
            match = re.fullmatch(r'([甲乙丙丁戊己庚辛壬癸]) ([1-9][0-9]*)', cell)
            require(match is not None, 'Malformed source cell')
            slots.append(dict(stage=stage, stem=match[1], days=int(match[2])))
        require(sum(s['days'] for s in slots) == 30, 'Source table no longer totals 30')
        result[branch] = slots
    return result


def other_position_table(review):
    quote = next(e['quote'] for e in review['evidence'] if e['id'] == 'period_sagong_other_table')
    rows = [[x.strip() for x in line.split('|')] for line in quote.splitlines()[-2:]]
    require(rows[0] == ['지지', *BRANCHES] and len(rows[1]) == 13
            and rows[1][0] == '장간', 'Malformed other-position table')
    result = {b: rows[1][i].split() for i,b in enumerate(BRANCHES, 1)}
    require(all(values and all(s in STEMS and len(s) == 1 for s in values)
                for values in result.values()), 'Malformed other-position stem')
    return result


def compare_offset(review, branch, offset):
    """Compare lengths on an explicitly artificial axis, never real elapsed time."""
    require(isinstance(branch, str) and len(branch) == 1 and branch in BRANCHES, 'Invalid branch')
    require(type(offset) in (str,int,float,Decimal), 'Invalid synthetic offset')
    try:
        point = Decimal(str(offset))
    except InvalidOperation as exc:
        raise ValueError('Invalid synthetic offset') from exc
    require(point.is_finite() and 0 <= point <= 30, 'Offset must be finite, between 0 and 30')
    table = period_table(review)
    group = 'wu' if branch == '午' else 'birth' if branch in '寅巳申亥' else 'peak' if branch in '子卯酉' else 'storage'
    variants = []
    for v in review['period_variants']:
        slots = table[branch] if v['kind'] == 'stem_period_table' else [
            dict(stage=s, stem=None, days=n) for s,n in zip(STAGES, v['periods'][group]) if n is not None]
        candidates, start = [], 0
        for s in slots:
            end = start + s['days']
            if 0 < point < 30 and start <= point <= end:
                candidates.append(dict(stage=s['stage'], stem=s['stem'], start=start, end=end))
            start = end
        variants.append(dict(id=v['id'], source_profile=v['source_profile'],
                             evidence_ids=list(v['evidence_ids']), candidates=candidates,
                             status='outer_boundary_unknown' if point in (0,30) else
                                    'internal_boundary_unknown' if len(candidates)>1 else 'synthetic_interior_only'))
    return dict(branch=branch, offset=str(point), axis=review['comparison_contract']['axis'],
                variants=variants, personal_application='withheld',
                missing_calendar_policy=list(MISSING), inference_enabled=False,
                probability=None, use_as_training_labels=False)


def measure(repo=REPO):
    review = load_review(repo)
    # Every reviewed group boundary, plus adjacent tenths and a witness inside 19..20.
    offsets = ['0','0.1','6.9','7','7.1','8.9','9','9.1','9.9','10','10.1',
               '11.9','12','12.1','13.9','14','14.1','18.9','19','19.1','19.5',
               '19.9','20','20.1','29.9','30']
    comparisons = []
    for b in BRANCHES:
        for o in offsets:
            result = compare_offset(review,b,o)
            comparisons.append(dict(branch=b,offset=o,variants=[dict(
                id=v['id'],status=v['status'],
                stages=[c['stage'] for c in v['candidates']],
                stems=[c['stem'] for c in v['candidates']]) for v in result['variants']]))
    table = period_table(review)
    other = other_position_table(review)
    differences = [b for b in BRANCHES if [s['stem'] for s in table[b]] != other[b]]
    paths = [*FROZEN, REVIEW.as_posix(), 'docs/knowledge-model/month_period_review.py']
    return dict(schema_version=1,base_commit=BASE,hash_policy='sha256_lf_git_text',
                inputs={p:digest(repo/p) for p in paths}, evidence_ranges=len(review['evidence']),
                period_table=table,other_position_table=other,
                month_vs_other_composition_differences=differences,
                power_variants=deepcopy(review['power_variants']),
                comparison_contract=review['comparison_contract'],
                comparison_rows=len(comparisons), comparisons=comparisons,
                inference_enabled=False,probability=None,use_as_training_labels=False)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--check',action='store_true')
    mode.add_argument('--write-measurement',action='store_true')
    mode.add_argument('--synthetic-offset',help='Artificial 0..30 axis; NOT elapsed days from birth/solar entry')
    parser.add_argument('--branch',choices=list(BRANCHES),default='午')
    args=parser.parse_args()
    if args.synthetic_offset is not None:
        result=compare_offset(load_review(),args.branch,args.synthetic_offset)
    else:
        result=measure()
        if args.check:
            require(result==json.loads((REPO/MEASUREMENT).read_text(encoding='utf-8')),'Month period measurement changed')
        elif args.write_measurement:
            (REPO/MEASUREMENT).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        result={k:result[k] for k in ('evidence_ranges','comparison_rows',
                'month_vs_other_composition_differences','inference_enabled','probability')}
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
