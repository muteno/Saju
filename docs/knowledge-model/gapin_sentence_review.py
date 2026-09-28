"""Read-only review of every Gapin draft leaf; never a personal reading.

The canonical digest freezes editorial judgments. The independent checks below
reproduce draft coverage, archived paragraphs, prior reviews and provenance;
they do not establish semantic correctness or predictive accuracy.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path

from basic_sentence_review import archive_units, canonical, digest, path_in, require

REPO = Path(__file__).resolve().parents[2]
REVIEW = 'docs/knowledge-model/data/gapin_sentence_review.json'
REVIEW_SHA256 = '1e93a4eb882ee9661b60dbe2c1563c29498e7804546a756908032cd19dadd781'
PRIOR = 'docs/knowledge-model/data/basic_sentence_review.json'
PRIOR_SHA256 = '6c5ce9d82a8f589cd30f8c85548e9ce42fdbee1ccf405e26d54ca3d31199d754'
DRAFT = 'dosa-app/kb/distilled/ilju/갑인.json'
INDEX = 'dosa-app/kb/unit_index.json'
CATALOG = 'refine-tools/units.json'
KEY = 'ilju/갑인'
# Human-reviewed semantic links are distinct from mere shared source context.
# Their meanings are frozen by REVIEW_SHA256; provenance is reproduced below.
PARTIAL_REUSE = {
    ('distilled', '핵심'): ['IN01', 'IN05'],
    ('distilled', '성격', 6): ['IN02'],
    ('distilled', '주의', 3): ['IN06'],
    ('인용', 0, 'text'): ['IN01'],
    ('인용', 1, 'text'): ['IN02'],
}


def string_leaves(value, pointer=()):
    """Enumerate exact JSON leaves, retaining object names and list indices."""
    if isinstance(value, dict):
        for key, child in value.items():
            yield from string_leaves(child, pointer + (key,))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from string_leaves(child, pointer + (index,))
    elif isinstance(value, str):
        yield pointer, value


def pointer_at(value, pointer):
    require(isinstance(pointer, list) and pointer, 'Invalid pointer')
    for part in pointer:
        if isinstance(value, list):
            require(type(part) is int and 0 <= part < len(value), 'Invalid list pointer')
        else:
            require(isinstance(value, dict) and isinstance(part, str) and part in value,
                    'Invalid object pointer')
        value = value[part]
    return value


def role_of(pointer):
    if (pointer[0] in ('distilled', '기타') or
            (pointer[0] == '인용' and pointer[-1] == 'text') or
            (pointer[0] == '관점차이' and pointer[-1] == '내용')):
        return 'claim'
    if pointer[0] == '관점차이' and pointer[-1] == '주제':
        return 'topic_label'
    if pointer == ('제외메모',):
        return 'exclusion_note'
    return 'metadata'


def unique_records(records, label):
    require(isinstance(records, list), 'Invalid ' + label)
    result = {}
    for row in records:
        require(isinstance(row, dict) and isinstance(row.get('id'), str) and row['id'],
                'Invalid ' + label + ' id')
        require(row['id'] not in result, 'Duplicate ' + label)
        result[row['id']] = row
    return result


def check_withheld(item):
    require(item.get('personal_application') == 'withheld'
            and item.get('training_eligible') is False
            and item.get('probability', 'missing') is None,
            'Cannot promote a reviewed draft')
    if 'personal_inference_eligible' in item:
        require(item['personal_inference_eligible'] is False, 'Cannot enable personal inference')


def prior_binding(pointer, prior_items):
    exact = [item['id'] for item in prior_items if item['pointer'] == pointer]
    if exact:
        return exact, 'exact_prior_pointer'
    groups = [item['id'] for item in prior_items
              if pointer[:len(item['pointer'])] == item['pointer']]
    return (groups, 'contained_in_prior_group') if groups else ([], 'new')


def validate(review, repo=REPO):
    require(isinstance(review, dict) and type(review.get('schema_version')) is int
            and review['schema_version'] == 1, 'Invalid schema version')
    require(review.get('inference_enabled') is False
            and type(review.get('training_eligible')) is int
            and review['training_eligible'] == 0
            and review.get('probability', 'missing') is None
            and review.get('independent_support_count', 'missing') is None,
            'No personal inference, training or independent support count')
    require({DRAFT, PRIOR, INDEX, CATALOG} <= set(review['inputs']), 'Missing required input')
    require(review['draft_path'] == DRAFT and review['prior_review_path'] == PRIOR,
            'Review input identity changed')
    for rel, expected in review['inputs'].items():
        raw = path_in(repo, rel).read_bytes().replace(b'\r\n', b'\n')
        require(hashlib.sha256(raw).hexdigest() == expected, 'Input changed: ' + rel)
    read_json = lambda rel: json.loads(path_in(repo, rel).read_text(encoding='utf-8'))
    draft, prior, index, catalog_rows = (read_json(rel) for rel in (DRAFT, PRIOR, INDEX, CATALOG))
    root = Path(repo).resolve()
    actual_files = sorted(path_in(repo, 'dosa-app/kb/distilled/ilju').glob('*.json'))
    input_files = sorted(rel for rel in review['inputs'] if rel.startswith('dosa-app/kb/distilled/ilju/'))
    require([path.relative_to(root).as_posix() for path in actual_files] == input_files,
            'Ilju input inventory changed')
    all_drafts = [read_json(rel) for rel in input_files]
    require(draft['key'] == KEY and digest(prior) == PRIOR_SHA256, 'Prior review or draft identity changed')
    prior_items = [item for item in prior['items'] if item['key'] == KEY]
    require([item['id'] for item in prior_items] == ['IN01', 'IN02', 'IN03', 'IN04', 'IN05', 'IN06'],
            'Prior item inventory changed')
    for item in prior_items:
        require(canonical(pointer_at(draft, item['pointer'])) == canonical(item['draft_value']),
                'Prior draft binding changed')

    leaves = dict(string_leaves(draft))
    entries = unique_records(review['inventory']['entries'], 'inventory entry')
    coverage = {}
    for entry in entries.values():
        pointer = entry['pointer']
        value = pointer_at(draft, pointer)
        key = tuple(pointer)
        require(key not in coverage, 'Duplicate inventory pointer')
        require(isinstance(value, str) and value == entry['draft_value'], 'Draft leaf changed')
        require(entry['role'] == role_of(key), 'Inventory role changed')
        coverage[key] = entry
    require(set(coverage) == set(leaves), 'Draft leaf inventory is incomplete')

    archives = {}
    for rel, expected in review['archives'].items():
        raw = path_in(repo, rel).read_bytes()
        require(hashlib.sha256(raw).hexdigest() == expected, 'Archive changed: ' + rel)
        archives[rel] = archive_units(raw)
    catalog = {row['key']: row for row in catalog_rows}
    require(len(catalog) == len(catalog_rows), 'Duplicate catalog unit')
    allowed = {source['unit']: source for source in draft['sources']}
    indexed = {source['key']: source for source in index[KEY]}
    require(set(allowed) == set(indexed) == set(review['source_units']), 'Source inventory changed')
    units = {}
    for key, source in review['source_units'].items():
        doc, seq = key.rsplit('#', 1)
        require(seq.isdigit() and len(seq) == 4, 'Invalid source sequence')
        rel = source['archive_path']
        path_in(repo, rel)
        require(rel == '정제본/' + doc + '.docx' and rel in archives, 'Unit/archive mismatch')
        require(int(seq) < len(archives[rel]), 'Source sequence outside archive')
        unit = archives[rel][int(seq)]
        for field in ('title', 'meta', 'heading_xml_paragraph'):
            require(canonical(source[field]) == canonical(unit[field]), 'Source identity changed: ' + key)
        require(allowed[key]['doc'] == indexed[key]['doc'] == doc
                and allowed[key]['title'] == indexed[key]['title'] == catalog[key]['title'] == unit['title'],
                'Source catalog/index provenance changed')
        require(source['lineage'] in review['source_lineage'], 'Unknown source lineage')
        require(canonical(source) == canonical(prior['source_units'][key]), 'Prior source provenance changed')
        units[key] = unit
    require(set(archives) == {source['archive_path'] for source in review['source_units'].values()},
            'Archive inventory changed')

    spans = unique_records(review['spans'], 'source span')
    for span in spans.values():
        require(span['unit'] in units, 'Span source outside draft')
        require(isinstance(span['body_paragraphs'], list) and len(span['body_paragraphs']) == 2,
                'Invalid body range')
        a, b = span['body_paragraphs']
        body = units[span['unit']]['body']
        require(type(a) is int and type(b) is int and 1 <= a <= b <= len(body), 'Invalid body range')
        require(span['id'] == f"{span['unit']}@{a}-{b}", 'Span id/range mismatch')
        require(canonical(body[a - 1:b]) == canonical(span['paragraphs']), 'Source span changed')
        require(canonical(span['context_before']) == canonical(body[max(0, a - 3):a - 1]),
                'Source preceding context changed')
        require(canonical(span['context_after']) == canonical(body[b:b + 2]),
                'Source following context changed')
    prior_evidence = {span_id for item in prior_items for span_id in item['evidence']}
    for old_span in prior['spans']:
        if old_span['id'] in prior_evidence:
            require(old_span['id'] in spans and all(
                canonical(spans[old_span['id']][field]) == canonical(old_span[field])
                for field in ('unit', 'body_paragraphs', 'paragraphs')),
                'Prior comparison evidence missing or changed')

    items = unique_records(review['items'], 'review item')
    seen_item_ids = set()
    for pointer, entry in coverage.items():
        if entry['role'] not in ('claim', 'exclusion_note'):
            require(entry['review_item_id'] is None and entry['prior_review_ids'] == []
                    and entry['reuse_kind'] == 'new', 'Metadata promoted to reviewed claim')
            continue
        item_id = entry['review_item_id']
        require(item_id in items and item_id not in seen_item_ids, 'Review item coverage changed')
        seen_item_ids.add(item_id)
        item = items[item_id]
        require(item['key'] == KEY and item['draft_path'] == DRAFT, 'Item draft identity changed')
        for field in ('pointer', 'draft_value', 'prior_review_ids', 'reuse_kind'):
            require(canonical(item[field]) == canonical(entry[field]), 'Item/inventory binding changed')
        expected_ids, reuse = prior_binding(item['pointer'], prior_items)
        if pointer in PARTIAL_REUSE:
            require(not expected_ids and entry['reuse_kind'] == 'semantic_partial_reuse'
                    and entry['prior_review_ids'] == PARTIAL_REUSE[pointer], 'Invalid semantic reuse binding')
        elif entry['reuse_kind'] == 'shared_evidence_only':
            require(not expected_ids and entry['prior_review_ids']
                    and all(ref in {old['id'] for old in prior_items} for ref in entry['prior_review_ids']),
                    'Invalid shared evidence binding')
        else:
            require(entry['prior_review_ids'] == expected_ids and entry['reuse_kind'] == reuse,
                    'Prior review binding changed')
        require(type(item['source_review_complete']) is bool, 'Invalid source review state')
        check_withheld(item)
        evidence = item['evidence']
        require(isinstance(evidence, list) and evidence and all(isinstance(e, str) for e in evidence)
                and len(set(evidence)) == len(evidence)
                and all(e in spans for e in evidence), 'Invalid item evidence')
        if entry['reuse_kind'] in ('semantic_partial_reuse', 'shared_evidence_only'):
            old_spans = {span['id']: span for span in prior['spans']}
            for ref in entry['prior_review_ids']:
                old_item = next(old for old in prior_items if old['id'] == ref)
                shared = any(spans[new]['unit'] == old_spans[old]['unit']
                             and max(spans[new]['body_paragraphs'][0], old_spans[old]['body_paragraphs'][0])
                             <= min(spans[new]['body_paragraphs'][1], old_spans[old]['body_paragraphs'][1])
                             for new in evidence for old in old_item['evidence'])
                require(shared, 'Prior evidence overlap not reproduced')
        explicit_source = None
        if pointer[0] == '인용':
            explicit_source = draft['인용'][pointer[1]]['src']
        if pointer[0] == '관점차이':
            explicit_source = draft['관점차이'][pointer[1]]['견해'][pointer[3]]['src']
        if explicit_source:
            allowed_attributions = ({view['src'] for view in draft['관점차이'][pointer[1]]['견해']}
                                    if pointer[0] == '관점차이' else {explicit_source})
            require(any(spans[e]['unit'] == explicit_source for e in evidence)
                    and all(spans[e]['unit'] in allowed_attributions for e in evidence),
                    'Explicit source attribution changed')
        if pointer[0] == '인용':
            require(any(item['draft_value'] in paragraph['text'] for e in evidence
                        for paragraph in spans[e]['paragraphs']), 'Quotation not found in source')
        require(isinstance(item['review'], dict) and all(
            isinstance(item['review'].get(field), str) and item['review'][field].strip()
            for field in ('status', 'conditions', 'exceptions_or_counterpoints', 'scope', 'unknown',
                          'time_scope', 'gender_scope', 'position_scope', 'lineage_note')),
            'Missing contextual review')
    require(seen_item_ids == set(items), 'Orphan review item')

    groups = review['perspective_groups']
    require(isinstance(groups, list) and len(groups) == len(draft['관점차이']), 'Perspective groups missing')
    for number, group in enumerate(groups):
        require(group['pointer'] == ['관점차이', number]
                and canonical(group['draft_value']) == canonical(draft['관점차이'][number]),
                'Perspective group changed')
        members = [item['id'] for item in items.values()
                   if item['pointer'][:2] == group['pointer']]
        require(group['member_item_ids'] == members, 'Perspective group membership changed')
        require(group['prior_review_ids'] == (['IN06'] if number == 0 else []), 'Prior group changed')
        check_withheld(group)
    counts = review['inventory']['counts']
    prior_personality = {(item['draft_path'], tuple(item['pointer'])) for item in prior['items']
                         if item['pointer'][:2] == ['distilled', '성격']}
    current_personality = {(item['draft_path'], tuple(item['pointer'])) for item in items.values()
                           if item['pointer'][:2] == ['distilled', '성격']}
    carried = sum(item['reuse_kind'] in ('exact_prior_pointer', 'contained_in_prior_group')
                  for item in items.values())
    computed = {
        'string_leaves': len(leaves),
        'claim_leaves': sum(entry['role'] == 'claim' for entry in entries.values()),
        'exclusion_note_leaves': sum(entry['role'] == 'exclusion_note' for entry in entries.values()),
        'metadata_leaves': sum(entry['role'] == 'metadata' for entry in entries.values()),
        'topic_label_leaves': sum(entry['role'] == 'topic_label' for entry in entries.values()),
        'review_items': len(items), 'prior_review_claim_leaves': carried,
        'new_review_items': len(items) - carried,
        'semantic_partial_reuse_items': sum(item['reuse_kind'] == 'semantic_partial_reuse' for item in items.values()),
        'shared_evidence_only_items': sum(item['reuse_kind'] == 'shared_evidence_only' for item in items.values()),
        'narrative_slots': sum(entry['role'] == 'claim' and entry['pointer'][0] != '관점차이'
                               for entry in entries.values()) + len(groups),
        'prior_narrative_slots': len(prior_items),
        'new_narrative_slots': sum(entry['role'] == 'claim' and entry['pointer'][0] != '관점차이'
                                   for entry in entries.values()) + len(groups) - len(prior_items),
        'new_claim_leaves': sum(entry['role'] == 'claim' and entry['reuse_kind'] not in
                               ('exact_prior_pointer', 'contained_in_prior_group') for entry in entries.values()),
        'perspective_groups': len(groups),
        'perspective_claim_leaves': sum(item['pointer'][0] == '관점차이' for item in items.values()),
        'source_review_complete_items': sum(item['source_review_complete'] for item in items.values()),
        'new_personality_review_items': len(current_personality - prior_personality),
        'all_ilju_files': len(all_drafts),
        'all_personality_drafts': sum(len(draft['distilled']['성격']) for draft in all_drafts),
        'prior_personality_review_items': len(prior_personality),
        'cumulative_personality_review_items': len(prior_personality | current_personality),
        'full_narrative_source_audits': int(all(item['source_review_complete'] for item in items.values())),
        'fully_approved_ilju': 0,
    }
    require(canonical(counts) == canonical(computed), 'Inventory counts changed')
    require(review['delivery_policy']['added_to_app_policy'] is False,
            'Archival review cannot change app delivery')
    require(digest(review) == REVIEW_SHA256, 'Reviewed payload changed')
    return review


def load_review(repo=REPO):
    return validate(json.loads(path_in(repo, REVIEW).read_text(encoding='utf-8')), repo)


def retrieve(item_id=None, repo=REPO):
    """Return detached review with complete comparison and source context."""
    review = load_review(repo)
    if item_id is None:
        return copy.deepcopy(review)
    matches = [item for item in review['items'] if item['id'] == item_id]
    require(len(matches) == 1, 'Unknown reviewed item')
    groups = [group for group in review['perspective_groups'] if item_id in group['member_item_ids']]
    related_ids = {item_id} | {member for group in groups for member in group['member_item_ids']}
    items = [item for item in review['items'] if item['id'] in related_ids]
    prior = json.loads(path_in(repo, PRIOR).read_text(encoding='utf-8'))
    prior_ids = {ref for item in items for ref in item['prior_review_ids']}
    prior_items = [item for item in prior['items'] if item['id'] in prior_ids]
    evidence = {span_id for item in items for span_id in item['evidence']}
    evidence |= {span_id for item in prior_items for span_id in item['evidence']}
    spans = [span for span in review['spans'] if span['id'] in evidence]
    sources = {span['unit'] for span in spans}
    return copy.deepcopy({'item': matches[0], 'comparison_items': items, 'perspective_groups': groups,
                          'prior_review_items': prior_items, 'scope': review['scope'],
                          'delivery_policy': review['delivery_policy'],
                          'unreviewed_scope': review['unreviewed_scope'],
                          'spans': spans, 'source_units': {key: value for key, value in review['source_units'].items()
                                                        if key in sources},
                          'source_lineage': review['source_lineage'], 'inference_enabled': False,
                          'training_eligible': 0, 'probability': None, 'independent_support_count': None})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--item')
    group.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = retrieve(args.item)
    if args.check:
        result = {'status': 'archival_review_verified', **result['inventory']['counts'],
                  'spans': len(result['spans']),
                  'inference_enabled': False, 'training_eligible': 0, 'probability': None}
    print(json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
