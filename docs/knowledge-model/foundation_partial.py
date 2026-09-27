"""Review and strip only the declared partial/zi-mao lexical extension.

Prior F01/F02 manifests stay frozen. Source claims never enable chart inference.
"""
import argparse
from copy import deepcopy
import json
from pathlib import Path

from foundation_additions import text_sha

REPO = Path(__file__).resolve().parents[2]
BASE = '7e7d89d1aa4b43b527d90f36f71e566f99440e02'
REVIEW = 'docs/knowledge-model/data/foundation_partial_review.json'
GROUP = ('S04 합충형파해', '형·파·해·원진')
PARTIAL = ['반형', '인사 형살', '인사\n형살', '축술 형살']
ZI_MAO = ['자묘형', '자묘상형', '자묘 형살']
BEFORE = ['삼형', '인사신', '축술미', '인사형', '사인형', '사신형', '신사형',
          '인신형', '신인형', '축술형', '술축형', '술미형', '미술형', '축미형', '미축형']


def validate_and_strip(review, taxonomy, repo=REPO):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def text(s):
        return isinstance(s, str) and bool(s.strip())

    require(review['schema_version'] == 1 and review['base_commit'] == BASE, 'Wrong partial version/base')
    require(review['scope'] == 'lexical_retrieval_only' and review['inference_enabled'] is False
            and review['use_as_training_labels'] is False and review['probability'] is None,
            'Partial review cannot enable inference/training')
    evidence = review['evidence']
    by_id = {e['id']: e for e in evidence}
    require(evidence and len(evidence) == len(by_id), 'Missing/duplicate partial evidence')
    cache = {}
    for e in evidence:
        require(text(e['id']) and text(e['source_profile'])
                and e['kind'] in {'board_snapshot', 'web', 'transcript'}, 'Missing source identity')
        rel = Path(e['path']); path = (repo / rel).resolve()
        require(not rel.is_absolute() and path.is_relative_to(repo.resolve()), 'Evidence outside repository')
        if path not in cache:
            raw = path.read_bytes()
            cache[path] = text_sha(raw), raw.decode('utf-8-sig').splitlines()
        digest, lines = cache[path]
        require(e['sha256'] == digest, 'Stale partial source: ' + e['id'])
        bounds = e['lines']
        require(isinstance(bounds, list) and len(bounds) == 2 and all(type(n) is int for n in bounds),
                'Invalid partial bounds')
        start, end = bounds
        require(1 <= start <= end <= len(lines), 'Partial bounds outside source')
        require(text(e['quote']) and e['quote'] in '\n'.join(lines[start-1:end]),
                'Partial quote mismatch: ' + e['id'])
    used = set()

    def refs(ids):
        require(isinstance(ids, list) and ids and len(ids) == len(set(ids))
                and all(i in by_id for i in ids), 'Invalid partial evidence links')
        used.update(ids)

    rows = review['additions']
    require(len(rows) == 2 and {r['concept'] for r in rows} == {'삼형', '자묘형'}, 'Unreviewed partial subjects')
    current = deepcopy(taxonomy)
    group = current.get(GROUP[0], {}).get(GROUP[1], {})
    for r in rows:
        name = r['concept']; aliases = PARTIAL if name == '삼형' else ZI_MAO
        require(r['decision'] == ('add_aliases' if name == '삼형' else 'add_topic')
                and r['aliases'] == aliases, 'Unreviewed partial aliases')
        require(sum(name in cs for gs in current.values() for cs in gs.values()) == 1,
                'Duplicate/missing partial topic')
        require(group.get(name) == (BEFORE + PARTIAL if name == '삼형' else ZI_MAO),
                'Unexpected partial taxonomy change')
        refs(r['evidence_ids'])
        for alias in aliases:
            # One reviewed transcript ingestion maps its LF to one space.
            forms = [by_id[i]['quote'] for i in r['evidence_ids']]
            if alias == '인사 형살':
                forms += [s.replace('\n', ' ') for s in forms]
            require(any(alias in s for s in forms), 'Alias absent from linked source')
            owners = [n for gs in current.values() for cs in gs.values()
                      for n, aa in cs.items() if alias in aa]
            require(owners == [name], 'Alias has unexpected owner')
    group['삼형'] = BEFORE[:]
    del group['자묘형']
    claims = review['claims']
    require(claims and len({c['id'] for c in claims}) == len(claims), 'Missing/duplicate partial claims')
    for c in claims:
        require(text(c['id']) and text(c['statement']) and c['status'] == 'source_claim'
                and c['type'] in {'definition', 'condition', 'disagreement', 'retrieval_limit'},
                'Unattributed partial claim')
        refs(c['evidence_ids'])
    require(used == set(by_id), 'Unlinked partial evidence')
    require(review['held'] and all(text(h['term']) and text(h['reason']) and text(h['resume'])
                                 for h in review['held']), 'Missing held scope')
    return current, dict(added_concepts=1, added_existing_aliases=4, topic_spellings=3,
                         evidence_ranges=len(evidence), claims=len(claims),
                         inference_enabled=False, training_labels=False, probability=None)


def load_and_strip(taxonomy, repo=REPO):
    return validate_and_strip(json.loads((repo / REVIEW).read_text(encoding='utf-8')), taxonomy, repo)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review', action='store_true')
    args = parser.parse_args()
    from foundation_review import load_taxonomy, TAXONOMY
    review = json.loads((REPO / REVIEW).read_text())
    _, result = validate_and_strip(review, load_taxonomy(REPO / TAXONOMY))
    print(json.dumps(review if args.review else result, ensure_ascii=False, indent=2))
