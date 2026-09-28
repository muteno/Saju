"""Read-only archival review of selected draft items, never personal inference.

The pinned review is a human interpretation. Provenance checks can reproduce
its inputs and locators, but cannot establish semantic or predictive accuracy.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

REPO = Path(__file__).resolve().parents[2]
REVIEW = 'docs/knowledge-model/data/basic_sentence_review.json'
REVIEW_SHA256 = '6c5ce9d82a8f589cd30f8c85548e9ce42fdbee1ccf405e26d54ca3d31199d754'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def path_in(repo, relative):
    root = Path(repo).resolve()
    require(isinstance(relative, str), 'Invalid path')
    path = root / relative
    require(not Path(relative).is_absolute() and '..' not in Path(relative).parts
            and path.resolve().is_relative_to(root), 'Path escapes repository')
    return path


def at(value, pointer):
    for part in pointer:
        value = value[part]
    return value


def archive_units(raw):
    """Match repository's zero-based Heading1 units, with physical XML locators.

    Parse XML independently of extract_bodies.py's regex extraction. Empty
    paragraphs count toward XML locators, but not toward body ordinals.
    """
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
    paragraphs = list(document.iter(W + 'p'))
    text = lambda p: ''.join(t.text or '' for t in p.iter(W + 't')).strip()
    headings = [i for i, p in enumerate(paragraphs)
                if any(s.get(W + 'val') == 'Heading1' for s in p.iter(W + 'pStyle'))]
    result = []
    for seq, start in enumerate(headings):
        end = headings[seq + 1] if seq + 1 < len(headings) else len(paragraphs)
        body, meta = [], None
        for index in range(start + 1, end):
            value = text(paragraphs[index])
            if not value:
                continue
            if meta is None and value.startswith('작성일 '):
                meta = value
                continue
            body.append({'xml_paragraph': index + 1, 'text': value})
        result.append({'title': text(paragraphs[start]), 'meta': meta,
                       'heading_xml_paragraph': start + 1, 'body': body})
    return result


def validate(review, repo=REPO):
    require(digest(review) == REVIEW_SHA256, 'Reviewed payload changed')
    require(review['inference_enabled'] is False and review['training_eligible'] == 0
            and review['probability'] is None, 'No personal inference or training')
    for rel, expected in review['inputs'].items():
        raw = path_in(repo, rel).read_bytes().replace(b'\r\n', b'\n')
        require(hashlib.sha256(raw).hexdigest() == expected, 'Input changed: ' + rel)
    files = sorted(path_in(repo, 'dosa-app/kb/distilled/ilju').glob('*.json'))
    root = Path(repo).resolve()
    expected_files = sorted(p for p in review['inputs'] if p.startswith('dosa-app/kb/distilled/ilju/'))
    require([p.relative_to(root).as_posix() for p in files] == expected_files, 'Inventory files changed')
    drafts = {p.relative_to(root).as_posix(): json.loads(p.read_text(encoding='utf-8')) for p in files}
    require(len(files) == review['inventory']['ilju_files']
            and sum(len(d['distilled']['성격']) for d in drafts.values())
            == review['inventory']['personality_drafts'], 'Inventory counts changed')
    archives = {}
    for rel, expected in review['archives'].items():
        raw = path_in(repo, rel).read_bytes()
        require(hashlib.sha256(raw).hexdigest() == expected, 'Archive changed: ' + rel)
        archives[rel] = archive_units(raw)
    index = json.loads(path_in(repo, 'dosa-app/kb/unit_index.json').read_text(encoding='utf-8'))
    catalog = {x['key']: x for x in json.loads(path_in(repo, 'refine-tools/units.json').read_text(encoding='utf-8'))}
    units = {}
    for key, source in review['source_units'].items():
        doc, seq = key.rsplit('#', 1)
        require(source['archive_path'] == '정제본/' + doc + '.docx', 'Unit/archive mismatch')
        unit = archives[source['archive_path']][int(seq)]
        for field in ('title', 'meta', 'heading_xml_paragraph'):
            require(unit[field] == source[field], 'Source identity changed: ' + key)
        require(catalog[key]['title'] == unit['title'], 'Catalog title changed')
        units[key] = unit
    spans = {s['id']: s for s in review['spans']}
    require(len(spans) == len(review['spans']), 'Duplicate span')
    for span in spans.values():
        a, b = span['body_paragraphs']
        body = units[span['unit']]['body']
        require(type(a) is int and type(b) is int and 1 <= a <= b <= len(body), 'Invalid body range')
        require(canonical(body[a - 1:b]) == canonical(span['paragraphs']), 'Source span changed')
    for item in review['items']:
        draft = drafts[item['draft_path']]
        require(draft['key'] == item['key'], 'Draft key changed')
        require(canonical(at(draft, item['pointer'])) == canonical(item['draft_value']), 'Draft binding changed')
        allowed = {s['unit'] for s in draft['sources']}
        indexed = {s['key'] for s in index[item['key']]}
        require(allowed <= indexed, 'Draft sources absent from index')
        require(item['evidence'] and all(spans[e]['unit'] in allowed for e in item['evidence']),
                'Evidence belongs to another draft')
        require(item['personal_application'] == 'withheld' and item['training_eligible'] is False
                and item['probability'] is None, 'Cannot promote a reviewed draft')
    fallback = review['fallback_review']
    require([s['key'] for s in index[fallback['key']]][:2]
            == [u['unit'] for u in fallback['ordered_units']], 'Fallback order changed')
    for entry in fallback['ordered_units']:
        require([x['text'] for x in units[entry['unit']]['body'][:6]]
                == entry['first_six_body_paragraphs'], 'Fallback binding changed')
    return review


def load_review(repo=REPO):
    return validate(json.loads(path_in(repo, REVIEW).read_text(encoding='utf-8')), repo)


def retrieve(item_id=None, repo=REPO):
    review = load_review(repo)
    if item_id is None:
        return copy.deepcopy(review)
    matches = [x for x in review['items'] if x['id'] == item_id]
    require(len(matches) == 1, 'Unknown reviewed item')
    item = matches[0]
    evidence = [s for s in review['spans'] if s['id'] in item['evidence']]
    keys = {s['unit'] for s in evidence}
    # Comparison groups and contextual paragraphs stay atomic. The caller
    # cannot obtain a source-only string without its recorded limitations.
    return copy.deepcopy({'item': item, 'spans': evidence,
                          'source_units': {k: v for k, v in review['source_units'].items() if k in keys},
                          'source_lineage': review['source_lineage'],
                          'inference_enabled': False, 'training_eligible': 0,
                          'probability': None, 'independent_support_count': None})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--item')
    group.add_argument('--check', action='store_true')
    args = parser.parse_args()
    value = retrieve(args.item)
    if args.check:
        value = {'status': 'archival_review_verified', **value['inventory'],
                 'source_units': len(value['source_units']), 'spans': len(value['spans']),
                 'inference_enabled': False, 'training_eligible': 0, 'probability': None}
    print(json.dumps(value, ensure_ascii=True, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
