"""Verify literal source cases and compare reviewed antecedents, without training.

python docs/knowledge-model/source_case_review.py [--input cases.json] [--summary]
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess

from build_corpus import source_units
from context_query import ROOT, REPO, assess, signature, validate_reviews
from legacy_import import digest

STEMS, BRANCHES = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
KSTEMS, KBRANCHES = '갑을병정무기경신임계', '자축인묘진사오미신유술해'
SLOTS = ['natal.' + p for p in ('year', 'month', 'day', 'hour')] + [
    'time.' + p for p in ('daewoon', 'yearly', 'monthly')]


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def evidence_index(bundle, repo):
    loaded, result = {}, {}
    for entry in bundle['evidence']:
        eid = entry['id']
        if not nonempty(eid) or eid in result:
            raise ValueError('Evidence ids must be unique and nonempty')
        path = (repo / entry['path']).resolve()
        if not path.is_relative_to(repo.resolve()) or path.suffix != '.docx':
            raise ValueError('Source must be a repository DOCX')
        if path not in loaded:
            loaded[path] = (digest(path.read_bytes()), {x['locator']: x['text'] for x in source_units(path)})
        file_hash, paragraphs = loaded[path]
        p = paragraphs.get(entry['paragraph'])
        start, end = entry['start'], entry['end']
        if (p is None or type(start) is not int or type(end) is not int or not 0 <= start < end <= len(p)
                or file_hash != entry['sha256'] or digest(p.encode()) != entry['paragraph_sha256']
                or p[start:end] != entry['quote']):
            raise ValueError('Source excerpt or hash changed: ' + eid)
        result[eid] = entry
    return result


def references(refs, evidence, allowed=None):
    if (not isinstance(refs, list) or not refs or any(not nonempty(r) for r in refs)
            or len(set(refs)) != len(refs) or not set(refs) <= evidence.keys()
            or allowed is not None and not set(refs) <= set(allowed)):
        raise ValueError('Unbound or duplicate evidence reference')


def bound_pillar(binding, evidence, allowed):
    value, symbols = binding['value'], binding['symbols']
    if (not isinstance(value, str) or len(value) != 2 or value[0] not in STEMS or value[1] not in BRANCHES
            or not isinstance(symbols, list) or len(symbols) != 2):
        raise ValueError('A pillar requires a canonical stem and branch with two symbol anchors')
    for i, symbol in enumerate(symbols):
        references([symbol['evidence']], evidence, allowed)
        quote, offset = evidence[symbol['evidence']]['quote'], symbol['offset']
        if type(offset) is not int or not 0 <= offset < len(quote):
            raise ValueError('Symbol offset outside excerpt')
        char = quote[offset]
        hanja, korean = (STEMS, KSTEMS) if i == 0 else (BRANCHES, KBRANCHES)
        normalized = hanja[korean.index(char)] if char in korean else char
        if normalized != value[i]:
            raise ValueError('Transcribed pillar does not match source symbols')
    references(binding['position_evidence'], evidence, allowed)
    if not nonempty(binding['position_note']):
        raise ValueError('Position mapping needs an explicit reading note')
    matches = [i for i in range(60) if STEMS[i % 10] + BRANCHES[i % 12] == value]
    if not matches:
        raise ValueError('Impossible sexagenary stem/branch pair')
    return matches[0]


def case_request(case, evidence):
    references(case['evidence_ids'], evidence)
    if (case['origin'] not in ('source_clock_example', 'source_illustration', 'source_self_report', 'source_reported_chart')
            or case.get('training_label', 'missing') is not None
            or any(k in case for k in ('birth', 'evaluated_at', 'features', 'labels', 'context_request'))):
        raise ValueError('Literature cases cannot supply births, features or training labels')
    for field in ('id', 'label', 'source_group', 'subject_group'):
        if not nonempty(case[field]):
            raise ValueError('Missing case metadata: ' + field)
    if not case['dependency_groups'] or any(not nonempty(x) for x in case['dependency_groups']):
        raise ValueError('Explicit dependency groups are required')
    request = {'pillars': dict.fromkeys(('year', 'month', 'day', 'hour')), 'incoming': {}}
    seen = set()
    if not case['bindings']:
        raise ValueError('At least one source-reported pillar is required')
    for binding in case['bindings']:
        slot = binding['at']
        if slot not in SLOTS or slot in seen:
            raise ValueError('Duplicate or unknown pillar position')
        seen.add(slot)
        section, key = slot.split('.')
        request['pillars' if section == 'natal' else 'incoming'][key] = bound_pillar(binding, evidence, case['evidence_ids'])
    if not case['author_assertions']:
        raise ValueError('Keep the source explanation alongside each case')
    for entry in case['author_assertions'] + case['issues']:
        references(entry['evidence_refs'], evidence, case['evidence_ids'])
        if not nonempty(entry['summary']):
            raise ValueError('Empty source assertion or issue')
    return request


def dependency_components(cases, evidence):
    """Conservative declared groups, not authenticated independent people/sources."""
    parents = list(range(len(cases)))
    def root(i):
        while parents[i] != i:
            i = parents[i]
        return i
    owners = {}
    for i, case in enumerate(cases):
        tokens = [('source', case['source_group']), ('subject', case['subject_group'])]
        tokens += [('dependency', x) for x in case['dependency_groups']]
        tokens += [('source_file', evidence[x]['sha256']) for x in case['evidence_ids']]
        for token in tokens:
            if token in owners:
                parents[root(i)] = root(owners[token])
            else:
                owners[token] = i
    groups = {}
    for i, case in enumerate(cases):
        groups.setdefault(root(i), []).append(case['id'])
    return list(groups.values())


def audit(bundle, reviews, legacy, repo=REPO):
    if (bundle.get('schema_version') != 1 or bundle.get('use_as_training_labels') is not False
            or bundle.get('review_kind') != 'implementation_source_reading_not_expert_validation'
            or not isinstance(bundle.get('cases'), list) or not bundle['cases']):
        raise ValueError('Invalid source case review policy')
    validate_reviews(reviews, legacy, repo)
    evidence = evidence_index(bundle, repo)
    cases = bundle['cases']
    if len({c['id'] for c in cases}) != len(cases):
        raise ValueError('Duplicate case id')
    requests = [case_request(c, evidence) for c in cases]
    run = subprocess.run(['node', str(ROOT / 'reported_context.mjs'), '-'],
                         input=json.dumps(requests, ensure_ascii=False, allow_nan=False),
                         capture_output=True, text=True, check=False)
    if run.returncode:
        raise ValueError(run.stderr.strip())
    contexts = json.loads(run.stdout)
    if len(contexts) != len(cases):
        raise ValueError('Incomplete source context response')
    rows = []
    for case, context in zip(cases, contexts):
        assessed = assess(context, reviews)
        rows.append({**case, 'reported_input': context['natal']['pillars'],
                     'time_context': context['time_context'], 'evaluated_at': None,
                     'missing_pillars': [p for p, v in context['natal']['pillars'].items() if v is None],
                     'conditions': [{k: r[k] for k in ('id', 'condition_value', 'status', 'evaluation_scope', 'trace')}
                                    for r in assessed['conditions']],
                     'observations': assessed['observations'], 'measurement_bounds': assessed['measurement_bounds'],
                     'provenance': assessed['provenance'], 'training_eligible': False,
                     'exclusion_reason': 'source_assertions_are_not_independent_review_labels',
                     'author_assertions_status': 'source_author_statements_not_independently_validated',
                     'prediction': {'status': 'source_review_only', 'probability': None}})
    return {'schema_version': 1, 'status': 'source_review_only', 'case_count': len(rows),
            'source_file_count': len({e['path'] for e in evidence.values()}),
            'training_eligible_count': 0, 'training_labels_created': False, 'probability': None,
            'literal_evidence_checked': True, 'position_mapping_expert_verified': False,
            'historical_access_verified': False, 'calendar_consistency_verified': False,
            'dependency_components': dependency_components(cases, evidence),
            'dependency_identity_truth_verified': False, 'evidence': bundle['evidence'],
            'condition_coverage': {r['id']: dict(Counter(
                next(c['status'] for c in row['conditions'] if c['id'] == r['id']) for row in rows))
                for r in reviews['reviews']},
            'reviewed_conditions': reviews,
            'provenance': {'bundle_sha256': signature(bundle), 'review_sha256': signature(reviews),
                           'condition_evaluator_sha256': digest((ROOT / 'context_query.py').read_bytes()),
                           'source_reader_sha256': digest((ROOT / 'build_corpus.py').read_bytes()),
                           'reviewer_code_sha256': digest(Path(__file__).read_bytes())}, 'cases': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'data/source_cases.json')
    parser.add_argument('--summary', action='store_true')
    args = parser.parse_args()
    try:
        result = audit(json.loads(args.input.read_text(encoding='utf-8')),
                       json.loads((ROOT / 'data/context_reviews.json').read_text(encoding='utf-8')),
                       json.loads((ROOT / 'data/legacy_review.json').read_text(encoding='utf-8')))
        if args.summary:
            result = {**{k: v for k, v in result.items() if k not in ('cases', 'evidence', 'reviewed_conditions')},
                      'cases': [{k: row[k] for k in ('id', 'reported_input', 'missing_pillars', 'issues', 'training_eligible')}
                                | {'conditions': {r['id']: r['condition_value'] for r in row['conditions']}}
                                for row in result['cases']]}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(json.dumps({'status': 'validation_error', 'message': str(error)}, ensure_ascii=False))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
