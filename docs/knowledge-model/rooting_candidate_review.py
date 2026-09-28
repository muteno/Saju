"""Source-bound review of four legacy candidates; no chart or inference API.

The digest pins the human-reviewed meaning, while source/record checks validate
its provenance. Neither check establishes personal applicability or accuracy.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REVIEW = 'docs/knowledge-model/data/foundation_rooting_candidates.json'
REVIEW_SHA256 = 'c27e3e172af522589258984835c47de0b6af2341da60d5e57665ef9ce3a831ff'
IDS = ('legacy_candidate_e6ae40a2c5f49866760a',
       'legacy_candidate_37d94c50ce3a4be489a0',
       'legacy_candidate_51b7d3ebc8fd2f9e9272',
       'legacy_candidate_f6a14a608168bad599d0')


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def path_in(repo, relative):
    root = Path(repo).resolve()
    require(isinstance(relative, str), 'Invalid source path')
    path = root / relative
    require(not Path(relative).is_absolute() and '..' not in Path(relative).parts
            and path.resolve().is_relative_to(root), 'Source escapes repository')
    return path


def rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()
            if line.strip()]


def validate(review, repo=REPO):
    require(digest(review) == REVIEW_SHA256, 'Reviewed payload changed')
    for rel, expected in review['inputs'].items():
        raw = path_in(repo, rel).read_bytes().replace(b'\r\n', b'\n')
        require(hashlib.sha256(raw).hexdigest() == expected, 'Input changed: ' + rel)
    require(review['inference_enabled'] is False and review['training_labels'] is False
            and review['probability'] is None, 'Review cannot enable inference/training')
    source = review['source']
    post = source['post_record']
    posts = [p for p in rows(path_in(repo, source['post_index']))
             if p['post_id'] == post['post_id']]
    require(canonical(posts) == canonical([post]), 'Post identity changed')
    require(post['file'] == Path(source['path']).name, 'Post path mismatch')
    paras = {p['para_id']: p for p in rows(path_in(repo, source['paragraph_index']))}
    f01 = json.loads(path_in(repo, 'docs/knowledge-model/data/foundation_taxonomy_review.json')
                     .read_text(encoding='utf-8'))
    old_evidence = {e['id']: e for e in f01['evidence']}
    spans = {s['id']: s for s in review['spans']}
    for span in spans.values():
        a, b = span['lines']
        lines = path_in(repo, span['source_path']).read_text(encoding='utf-8').splitlines()
        require(type(a) is int and type(b) is int and 1 <= a <= b <= len(lines),
                'Invalid source range')
        require('\n'.join(lines[a - 1:b]) == span['text'], 'Source text changed: ' + span['id'])
        if 'index_record' in span:
            require(canonical(paras[span['id']]) == canonical(span['index_record'])
                    and span['post_id'] == post['post_id']
                    and span['lines'] == paras[span['id']]['lines'], 'Paragraph binding changed')
        else:
            require(canonical(old_evidence[span['id']]) == canonical(span['f01_record']),
                    'F01 binding changed')
    archive = review['archive']
    archive_path = path_in(repo, archive['path'])
    require(hashlib.sha256(archive_path.read_bytes()).hexdigest() == archive['sha256'],
            'Archive changed')
    from build_corpus import source_units
    document = {p['locator']: p['text'] for p in source_units(archive_path)}
    source_lines = path_in(repo, source['path']).read_text(encoding='utf-8').splitlines()
    for binding in archive['bindings']:
        require(document[binding['archive_locator']] == source_lines[binding['text_line'] - 1],
                'Archive/text locator mismatch')
    legacy = json.loads(path_in(repo, 'docs/knowledge-model/data/legacy_review.json')
                        .read_text(encoding='utf-8'))
    candidates = {c['id']: c for c in legacy['candidates']}
    require(tuple(c['id'] for c in review['candidates']) == IDS, 'Candidate identities changed')
    for item in review['candidates']:
        old = candidates[item['id']]
        require(digest(old) == item['legacy_record_sha256'], 'Legacy candidate changed')
        require(old['legacy_para_id'] == item['source_span'] == item['legacy_para_id']
                and old['evidence_group'] == item['legacy_group']
                and len(old['evidence_ids']) == item['legacy_anchor_count'], 'Candidate binding changed')
        span = spans[item['source_span']]
        require(span['lines'][0] <= item['source_line'] <= span['lines'][1],
                'Candidate outside paragraph')
        for rec in old['legacy_records']:
            raw_line = path_in(repo, rec['path']).read_text(encoding='utf-8').splitlines()[rec['line'] - 1]
            # legacy_import hashes canonical UTF-8 JSON, not physical whitespace.
            original = json.loads(raw_line)
            actual = hashlib.sha256(json.dumps(original, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            require(actual == rec['record_sha256'], 'Legacy origin changed')
    return review


def load_review(repo=REPO):
    return validate(json.loads(path_in(repo, REVIEW).read_text(encoding='utf-8')), repo)


def retrieve(candidate_id=None, repo=REPO):
    """Validated detached source review, never a truth value for a birth chart."""
    review = load_review(repo)
    if candidate_id is None:
        return copy.deepcopy(review)
    require(candidate_id in IDS, 'Unknown reviewed candidate')
    item = next(c for c in review['candidates'] if c['id'] == candidate_id)
    # Full shared context accompanies every projection; two target edges do not
    # acquire independent support, nor lose the sentence's other outcomes.
    return copy.deepcopy({'candidate': item, 'source': review['source'],
                          'source_groups': review['source_groups'], 'claims': review['claims'],
                          'comparisons': review['comparisons'], 'spans': review['spans'],
                          'summary': review['summary'], 'inference_enabled': False,
                          'training_labels': False, 'probability': None})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', choices=IDS)
    parser.add_argument('--check', action='store_true', help='Verify provenance, not personal applicability')
    args = parser.parse_args()
    result = retrieve(args.candidate)
    if args.check:
        result = {'status': 'source_review_verified', **result['summary']}
    # ASCII escaping also supports Windows consoles without UTF-8.
    print(json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
