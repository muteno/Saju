"""Verified, source-scoped structural reference. Not imported by the app.

The canonical digest freezes editorial bindings, not the truth of source claims.
DOCX positions/text and text-snapshot ranges are independently reproduced.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess

from basic_sentence_review import archive_units, canonical, digest, path_in, require

REPO = Path(__file__).resolve().parents[2]
REVIEW = 'docs/knowledge-model/data/gapin_structure_review.json'
REVIEW_DIGEST = '1c804314a8c169b087deedaecf48f1b019afb9548f623b2bb60dd7a0b418405d'
OBSERVER = 'docs/knowledge-model/gapin_structure_observations.mjs'
MEASUREMENT = 'docs/knowledge-model/data/gapin_structure_measurement.json'


def validate(review, repo=REPO):
    require(digest(review) == REVIEW_DIGEST, 'Reviewed source/claim payload changed')
    units, texts, archives = {}, {}, {}
    for rel, expected in review['inputs'].items():
        raw = path_in(repo, rel).read_bytes().replace(b'\r\n', b'\n')
        require(hashlib.sha256(raw).hexdigest() == expected, 'Input changed: ' + rel)
    for key, source in review['sources'].items():
        raw = path_in(repo, source['path']).read_bytes()
        if source['kind'] == 'text':
            raw = raw.replace(b'\r\n', b'\n')
            texts[key] = raw.decode('utf-8').splitlines()
        else:
            if source['path'] not in archives:
                archives[source['path']] = archive_units(raw)
            unit = archives[source['path']][source['unit_index']]
            require(all(unit[k] == source[k] for k in ('title', 'meta', 'heading_xml_paragraph')),
                    'Source identity changed: ' + key)
            units[key] = unit
        require(hashlib.sha256(raw).hexdigest() == source['sha256'], 'Source changed: ' + key)
    for evidence in review['evidence']:
        key = evidence['source']
        if key in units:
            body = units[key]['body']; a, b = evidence['body_paragraphs']
            require(1 <= a <= b <= len(body), 'Invalid paragraph range')
            require(canonical(body[a-1:b]) == canonical(evidence['paragraphs']), 'Paragraph changed')
            require(canonical(body[max(0, a-2):a-1]) == canonical(evidence['context_before'])
                    and canonical(body[b:b+1]) == canonical(evidence['context_after']), 'Context changed')
        else:
            a, b = evidence['lines']; lines = texts[key]
            require(1 <= a <= b <= len(lines) and '\n'.join(lines[a-1:b]) == evidence['text'],
                    'Snapshot range changed')
    # The header and the selected cell travel together; the nearby effect paragraphs do not.
    board = next(e['text'] for e in review['evidence'] if e['id'] == 'board_stage').splitlines()
    header = next(line for line in board if '갑(甲)목' in line).split('|')
    row = next(line for line in board if line.startswith('| 건록')).split('|')
    require('갑(甲)' in header[2] and '인(寅)' in row[2], 'Board column binding changed')
    prior = json.loads(path_in(repo, 'docs/knowledge-model/data/gapin_sentence_review.json').read_text(encoding='utf-8'))
    require(set(review['condition_review']['prior_ids']) <= {x['id'] for x in prior['items']},
            'Prior reference missing')
    return review


def load_review(repo=REPO):
    return validate(json.loads(path_in(repo, REVIEW).read_text(encoding='utf-8')), repo)


def run_observer(pillars=None, *, measure=False, repo=REPO):
    if not measure:
        require(isinstance(pillars, list) and len(pillars) == 4
                and all(x is None or (type(x) is int and 0 <= x < 60) for x in pillars),
                'Expected four symbolic pillar indices (0..59 or null)')
    command = ['node', str(path_in(repo, OBSERVER))] + (['--measure'] if measure else [])
    result = subprocess.run(command, input='' if measure else json.dumps(pillars),
                            capture_output=True, text=True, encoding='utf-8', timeout=30, check=True)
    return json.loads(result.stdout)


def query(pillars=None, repo=REPO):
    review = load_review(repo)
    evidence = {e['id']: e for e in review['evidence']}
    claims = []
    for claim in review['claims']:
        item = copy.deepcopy(claim)
        item['evidence'] = [{**copy.deepcopy(evidence[eid]),
                            'source_metadata': copy.deepcopy(review['sources'][evidence[eid]['source']])}
                           for eid in claim['evidence_ids']]
        claims.append(item)
    condition = copy.deepcopy(review['condition_review'])
    condition['evidence'] = [{**copy.deepcopy(evidence[eid]),
                              'source_metadata': copy.deepcopy(review['sources'][evidence[eid]['source']])}
                             for eid in condition['evidence_ids']]
    return {'kind': 'literature_reference_not_personal_reading', 'claims': claims,
            'condition_review': condition, 'delivery_contract': copy.deepcopy(review['delivery_contract']),
            'symbol_comparison': None if pillars is None else run_observer(pillars, repo=repo),
            'personal_application': 'withheld', 'training_eligible': 0, 'probability': None}


def check(repo=REPO):
    review = load_review(repo)
    measurement = json.loads(path_in(repo, MEASUREMENT).read_text(encoding='utf-8'))
    actual = run_observer(measure=True, repo=repo)
    require(canonical(actual) == canonical(measurement), 'Symbol measurement changed')
    return {'claims': len(review['claims']), 'evidence_spans': len(review['evidence']),
            'sources': len(review['sources']), 'symbol_cases': actual['cases'],
            'unique_vectors': actual['uniqueVectors'], 'present_counts': actual['presentCounts'],
            'app_integration': False, 'personal_application': 'withheld',
            'training_eligible': 0, 'probability': None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--check', action='store_true')
    group.add_argument('--query', action='store_true')
    parser.add_argument('--pillars', help='JSON [year,month,day,hour], 0..59/null; symbolic only')
    args = parser.parse_args()
    if args.check and args.pillars is not None:
        parser.error('--pillars requires --query')
    pillars = None if args.pillars is None else json.loads(args.pillars)
    if args.pillars is not None and not isinstance(pillars, list):
        parser.error('--pillars must be a JSON array of four symbolic indices/nulls')
    result = check() if args.check else query(pillars)
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
