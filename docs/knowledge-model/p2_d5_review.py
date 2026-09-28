"""Read-only F04 comparison. --check verifies an audit, NOT P2 eligibility.

Historical P2, builders, alias verdict and D5 remain untouched. Local records are
scoped reconstructions from the archived field diff, never raw local-file copies.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unicodedata

REPO = Path(__file__).resolve().parents[2]
REVIEW = 'docs/knowledge-model/data/foundation_p2_d5_review.json'
MEASUREMENT = 'docs/knowledge-model/data/foundation_p2_d5_measurement.json'
BUNDLE = 'docs/knowledge-model/data/foundation_review_bundle.json'
GUARD = '정제/문서/역추론_작업큐/queue_guard.py'
ALIASES = '정제/_현황판/data/별칭_판정.json'
PILOTS = ('정제/P2_유닛/pilot_UJ.jsonl', '정제/P2_유닛/pilot_UI.jsonl')
IDS = tuple(f'{kind}-{i:04}' for kind in ('UI', 'UJ') for i in range(1, 7))
REVIEW_SHA256 = 'c60e801f0e60f04a067b714ff0d75c6113571c800c152bc6b1be584976884e9e'
OPS = frozenset({'조회', '계산', '관측', '판정', '반전', '검증', '프로브'})


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def checked_path(repo, relative):
    root = Path(repo).resolve()
    p = root / relative
    require(isinstance(relative, str) and not Path(relative).is_absolute()
            and '..' not in Path(relative).parts and p.resolve().is_relative_to(root),
            'Source path escapes repository')
    return p


def file_hash(path):
    # Same UTF-8 content on LF/CRLF checkouts, no Unicode/content normalization.
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def validate(review, repo=REPO):
    require(digest(review) == REVIEW_SHA256, 'Reviewed payload changed')
    for rel, expected in review['inputs'].items():
        require(file_hash(checked_path(repo, rel)) == expected, 'Input changed: ' + rel)
    require(review['inference_enabled'] is False and review['training_labels'] is False
            and review['probability'] is None, 'Audit cannot enable inference/training')
    require([u['unit_id'] for u in review['units']] == list(IDS), 'Review identities changed')
    for pid, binding in review['paragraphs'].items():
        source = review['sources'][binding['post_id']]
        pp = [p for p in rows(checked_path(repo, source['para_index'])) if p['para_id'] == pid]
        posts = [p for p in rows(checked_path(repo, source['post_index'])) if p['post_id'] == binding['post_id']]
        require(len(pp) == len(posts) == 1, 'Ambiguous paragraph/post: ' + pid)
        require(pp[0]['post_id'] == binding['post_id'] and pp[0]['lines'] == binding['lines'], 'Paragraph binding changed: ' + pid)
        require(posts[0]['file'] == Path(source['path']).name and posts[0]['author'] == source['author']
                and posts[0]['url'] == source['url'], 'Post binding changed: ' + pid)
        body = paragraph_text(review, pid, repo)
        require(hashlib.sha256(body.encode()).hexdigest() == binding['text_sha256'], 'Paragraph text changed: ' + pid)
    return review


def load_review(repo=REPO):
    return validate(json.loads(checked_path(repo, REVIEW).read_text(encoding='utf-8')), repo)


def paragraph_text(review, pid, repo=REPO):
    binding = review['paragraphs'][pid]
    source = review['sources'][binding['post_id']]
    lines = checked_path(repo, source['path']).read_text(encoding='utf-8').splitlines()
    a, b = binding['lines']
    require(type(a) is int and type(b) is int and 1 <= a <= b <= len(lines), 'Invalid paragraph range')
    return '\n'.join(lines[a - 1:b])


def reconstruct(repo=REPO):
    bundle = json.loads(checked_path(repo, BUNDLE).read_text(encoding='utf-8'))
    repository, paths = {}, {}
    for rel in PILOTS:
        expected = next(x['repository_sha256'] for x in bundle['inputs'] if x['repository_path'] == rel)
        require(file_hash(checked_path(repo, rel)) == expected, 'P2 snapshot hash mismatch: ' + rel)
        for unit in rows(checked_path(repo, rel)):
            uid = unit['unit_id']
            require(uid not in repository, 'Duplicate unit: ' + uid)
            repository[uid], paths[uid] = unit, rel
    require(set(repository) == set(IDS), 'P2 IDs mismatch')
    diff = bundle['p2_units']
    require(len(diff) == len(IDS) and {x['unit_id'] for x in diff} == set(IDS), 'Difference IDs mismatch')
    local = copy.deepcopy(repository)
    for row in diff:
        uid = row['unit_id']
        require(row['repository_path'] == paths[uid], 'Unit file binding mismatch')
        for field, pair in row['changes'].items():
            require(set(pair) == {'repository', 'local'} and field in repository[uid], 'Incomplete field difference')
            require(canonical(repository[uid][field]) == canonical(pair['repository']), 'Repository-side difference mismatch')
            require(canonical(pair['repository']) != canonical(pair['local']), 'Not a field difference')
            local[uid][field] = copy.deepcopy(pair['local'])
    return repository, local, {r['unit_id']: r for r in diff}


def load_guard(repo=REPO):
    # Explicit relocation binding. Fresh module isolates legacy global caches.
    spec = importlib.util.spec_from_file_location('f04_historical_d5', checked_path(repo, GUARD))
    guard = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(guard)
    finally:
        sys.dont_write_bytecode = previous
    native_alias_path_exists = Path(guard._ALIAS_JSON).is_file()
    guard._ALIAS_JSON = str(checked_path(repo, ALIASES))
    return guard, native_alias_path_exists


def nfc(text):
    return unicodedata.normalize('NFC', text)


def quote_check(unit, evidence, review, guard, repo=REPO):
    pid = evidence['para_id']
    require(pid in review['paragraphs'], 'Unbound evidence paragraph')
    binding = review['paragraphs'][pid]
    source = review['sources'][binding['post_id']]
    require(unit['사건']['post_id'] == binding['post_id']
            and unit['author_cluster'] == source['author'], 'Wrong unit source/author')
    require(evidence['file'] == Path(source['path']).name
            and canonical(evidence['lines']) == canonical(binding['lines']), 'Evidence location mismatch')
    require(guard.is_citable(pid), 'Banned answer paragraph')
    body, quote = nfc(paragraph_text(review, pid, repo)), nfc(evidence['quote'])
    require(bool(quote) and quote in body, 'Quote not in source paragraph')
    spans, offset = [], 0
    while True:
        pos = body.find(quote, offset)
        if pos < 0:
            break
        start = binding['lines'][0] + body[:pos].count('\n')
        spans.append([start, start + quote.count('\n')])
        offset = pos + 1
    return {'para_id': pid, 'source_path': source['path'], 'paragraph_lines': binding['lines'],
            'quote_sha256': hashlib.sha256(evidence['quote'].encode()).hexdigest(),
            'physical_quote_spans': spans, 'literal_match': True, 'answer_leak_blocked': False}


def d5_links(unit, guard):
    before = len(guard.QUOTABLE_MISSES)
    failures = guard.assert_quotable(unit, context=unit['unit_id'])
    misses = guard.QUOTABLE_MISSES[before:]
    links = []
    for i, link in enumerate(unit['links']['횡단']):
        if not link['to'].startswith('개념:'):
            links.append({'index': i, 'target': link['to'], 'status': 'outside_d5_unit_link'})
            continue
        concept = link['to'][3:]
        forms = guard.quotable_forms(concept)
        matches = sorted(f for f in forms if f in guard.quote_base(unit))
        raw_matches = sorted(f for f in forms if f in guard.quote_base(dict(unit, 오전사={})))
        status = 'surface_pass' if matches else ('rollup_exempt' if concept in guard.ROLLUP_면제 else 'blocked')
        links.append({'index': i, 'target': link['to'], 'status': status,
                      'matched_forms': matches, 'raw_matched_forms': raw_matches,
                      'asr_only': bool(matches and not raw_matches)})
    require(sum(x['status'] == 'blocked' for x in links) == len(failures), 'Legacy D5 parity failed')
    require(sum(x['status'] in {'blocked', 'rollup_exempt'} for x in links) == len(misses), 'Exemption parity failed')
    return links


def audit_unit(unit, review, guard, repo=REPO):
    evidence = [quote_check(unit, e, review, guard, repo) for e in unit['근거']]
    links = d5_links(unit, guard)
    pids = {e['para_id'] for e in unit['근거']}
    chain = [{'seq': s['seq'], 'op': s['op'], 'para_id': s['근거'],
              'paragraph_in_evidence': s['근거'] in pids,
              'op_in_v3_enum': s['op'] in OPS, 'effect': copy.deepcopy(s.get('effect'))}
             for s in unit['chain']]
    return {'record_sha256': digest(unit), 'evidence': evidence, 'chain': chain,
            'd5_links': links, 'd5_eligible': all(x['status'] != 'blocked' for x in links),
            'quote_characters': sum(len(e['quote']) for e in unit['근거']),
            'historical_p3': unit['P3검증'], 'historical_mean_weight': unit['평균강도'],
            'fallback_author_mismatch': unit['관법fallback']['to'] != unit['author_cluster'],
            'semantic_eligible': False, 'inference_enabled': False, 'training_labels': False, 'probability': None}


def alias_promotion_probe(repository, local, repo=REPO):
    """Controlled counterfactual, not a regenerated alias verdict or approval."""
    additions = {'배우자': {'부부 사이'}, '상극': {'극을 하', '극하니까', '극합니다'}}
    original, _ = load_guard(repo)
    promoted, _ = load_guard(repo)
    promoted._C2A = copy.deepcopy(promoted._safe_alias_map())
    for concept, aliases in additions.items():
        require(not aliases.intersection(promoted._C2A.get(concept, set())), 'Probe aliases are no longer new')
        promoted._C2A.setdefault(concept, set()).update(aliases)
    changed = []
    for version, units in [('repository', repository), ('local_overlay', local)]:
        for uid in IDS:
            unit = units[uid]
            for link in unit['links']['횡단']:
                if not link['to'].startswith('개념:'):
                    continue
                concept = link['to'][3:]
                before = original.is_quotable(concept, unit)
                after = promoted.is_quotable(concept, unit)
                if before != after:
                    changed.append({'version': version, 'unit_id': uid, 'target': link['to'],
                                    'before': before, 'hypothetical_after': after})
    synthetic = {'근거': [{'quote': '보호본능을 자극합니다'}]}
    return {'applied_to_stored_aliases': False, 'hypothetical_additions': {k: sorted(v) for k, v in additions.items()},
            'changed_surface_results': changed,
            'synthetic_boundary_counterexample': {'text': synthetic['근거'][0]['quote'],
                'before': original.is_quotable('상극', synthetic),
                'hypothetical_after': promoted.is_quotable('상극', synthetic)},
            'semantic_approval': False}


def measure(repo=REPO):
    review = load_review(repo)
    repository, local, changes = reconstruct(repo)
    guard, native_path = load_guard(repo)
    units = []
    for uid in IDS:
        before, after = repository[uid], local[uid]
        units.append({'unit_id': uid, 'changed_fields': sorted(changes[uid]['changes']),
                      'preserved_changes': copy.deepcopy(changes[uid]['changes']),
                      'repository': audit_unit(before, review, guard, repo),
                      'local_overlay': audit_unit(after, review, guard, repo)})
    summary = {}
    for version in ('repository', 'local_overlay'):
        counts = {k: 0 for k in ('surface_pass', 'blocked', 'rollup_exempt', 'outside_d5_unit_link')}
        quotes = 0
        for u in units:
            quotes += len(u[version]['evidence'])
            for link in u[version]['d5_links']:
                counts[link['status']] += 1
        summary[version] = dict(counts, evidence_quotes=quotes, d5_eligible=counts['blocked'] == 0)
    return {'schema': 'p2-d5-measurement-v1', 'review_sha256': digest(review),
            'legacy_d5_native_alias_path_exists': native_path,
            'legacy_d5_binding': ALIASES, 'summary': summary, 'units': units,
            'alias_promotion_probe': alias_promotion_probe(repository, local, repo),
            'personal_inference_eligible_units': 0, 'training_eligible_units': 0, 'probability': None}


def check(repo=REPO):
    observed = measure(repo)
    preserved = json.loads(checked_path(repo, MEASUREMENT).read_text(encoding='utf-8'))
    require(canonical(observed) == canonical(preserved), 'P2/D5 audit measurement changed')
    return {'audit_reproduced': True, 'units_compared': len(observed['units']),
            'd5': observed['summary'], 'personal_inference_eligible_units': 0,
            'training_eligible_units': 0, 'probability': None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--strict-d5', action='store_true')
    mode.add_argument('--unit', choices=IDS)
    args = parser.parse_args()
    result = check()
    if args.unit:
        data = measure()
        result = {'comparison': next(u for u in data['units'] if u['unit_id'] == args.unit),
                  'review': next(u for u in load_review()['units'] if u['unit_id'] == args.unit)}
    print(json.dumps(result, ensure_ascii=True, indent=2))
    if args.strict_d5 and any(not v['d5_eligible'] for v in result['d5'].values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
