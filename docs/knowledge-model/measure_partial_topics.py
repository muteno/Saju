"""Compare the bounded partial/zi-mao lookup to PR #196 on the frozen corpus."""
import argparse
import json
from pathlib import Path
import re
import sys
from unittest.mock import patch

import measure_hidden_stages as shared
from foundation_partial import BASE, PARTIAL, ZI_MAO, REPO, load_and_strip


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def measure():
    sys.path.insert(0, str(shared.LEGACY))
    import 코퍼스 as reader
    with patch.object(shared, 'BASE', BASE):
        before, after = shared.load_pair(True), shared.load_pair(False)
    stripped, extension = load_and_strip(after[1].TAXONOMY)
    if stripped != before[1].TAXONOMY:
        raise ValueError('Unexpected pre-extension taxonomy')
    rows=list(reader.문단들(제목포함=True))
    by_id={r['q']['para_id']:r for r in rows}
    old=json.loads((REPO/'docs/knowledge-model/data/foundation_priority_measurement.json').read_text())
    corpus_hash=shared.sha(json.dumps([[r['q']['para_id'],r['text'],r['출처종']] for r in rows],
                                    ensure_ascii=False,separators=(',',':')).encode())
    if len(rows)!=56202 or len(by_id)!=len(rows) or corpus_hash!=old['corpus_sha256']:
        raise ValueError('Input differs from frozen 56,202 rows')
    paths=['정제/_현황판/'+p for p in ['build_dashboard.py','ingest_transcripts.py','코퍼스.py',
           'data/posts_all.jsonl','data/paras_all.jsonl','data/전사_글.jsonl','data/전사_문단.jsonl']]
    paths += ['docs/knowledge-model/'+p for p in ['measure_partial_topics.py','measure_hidden_stages.py',
              'foundation_partial.py','data/foundation_partial_review.json','data/foundation_priority_measurement.json']]
    inputs={p:shared.sha((REPO/p).read_bytes()) for p in paths}
    unchanged={}
    for p in ['docs/knowledge-model/data/foundation_priority_review.json',
              'docs/knowledge-model/data/foundation_f02_review.json',
              'docs/knowledge-model/data/foundation_taxonomy_review.json',
              'docs/knowledge-model/knowledge_graph.json','docs/knowledge-model/data/context_reviews.json',
              'docs/knowledge-model/data/foundation_claim_links.json', 'dosa-app/engine/src/relations.js']:
        import subprocess
        raw=(REPO/p).read_bytes()
        if raw!=subprocess.check_output(['git','show',f'{BASE}:{p}'],cwd=REPO):
            raise ValueError('Frozen source changed: '+p)
        unchanged[p]=shared.sha(raw)
    baseline=shared.run_pair(before,rows,reader,'baseline')
    current=shared.run_pair(after,rows,reader,'current')
    names=set(before[0].concept_meta)
    if len(names)!=281 or set(after[0].concept_meta)!=names|{'자묘형'}:
        raise ValueError('Unexpected concept set')
    # Independent token oracle: split into words; no production gate/regex call.
    forms={'반형','반형이','반형이다','반형이죠','반형을','반형살을'}
    ban_ids={r['q']['para_id'] for r in rows
             if forms & set(re.findall('[가-힣A-Za-z0-9_]+',r['text']))}
    spaced_ids={r['q']['para_id'] for r in rows if any(a in r['text'] for a in PARTIAL[1:])}
    zi_ids={r['q']['para_id'] for r in rows if any(a in r['text'] for a in ZI_MAO)}
    changes={b:shared.delta(baseline[b],current[b]) for b in baseline}
    id_hashes={}
    for b in baseline:
        for name in names-{'삼형'}:
            if baseline[b].get(name,set())!=current[b].get(name,set()):
                raise ValueError('Unrelated concept changed: '+b+'/'+name)
        if current[b]['삼형']!=baseline[b]['삼형']|ban_ids|spaced_ids:
            raise ValueError('Partial matches differ from independent oracle')
        if current[b]['자묘형']!=zi_ids:
            raise ValueError('Zi-mao matches differ from literal oracle')
        id_hashes[b]={label:shared.sha(encode({n:sorted(h.get(n,set())) for n in sorted(names-{'삼형'})}))
                      for label,h in [('before',baseline[b]),('after',current[b])]}
    reviewed=[]
    for e in old['reviewed_partial_omissions']:
        pid=e['para_id'];row=by_id[pid]
        if shared.sha(row['text'].encode())!=e['text_sha256'] or row['post'].get('file')!=e['source_file']:
            raise ValueError('Prior omission input changed: '+pid)
        reviewed.append({**e,'after_hits':{b:pid in h['삼형'] for b,h in current.items()}})
    for p,h in inputs.items():
        if shared.sha((REPO/p).read_bytes())!=h:
            raise ValueError('Input changed during measurement: '+p)
    with patch.object(shared,'BASE',BASE):
        if shared.load_pair(True)[2]!=before[2] or shared.load_pair(False)[2]!=after[2]:
            raise ValueError('Builders changed during measurement')
    return dict(schema_version=1,base_commit=BASE,scope='lexical_retrieval_only',corpus_rows=len(rows),
                corpus_sha256=corpus_hash,title_included=True,gist_included=False,executable_concepts=282,
                independent_evidence_count=None,inference_enabled=False,use_as_training_labels=False,probability=None,
                extension=extension,code=dict(before=before[2],after=after[2]),inputs=inputs,unchanged=unchanged,
                unchanged_280_concept_id_sha256=id_hashes,
                counts={label:{b:{n:len(h.get(n,set())) for n in ['삼형','자묘형']} for b,h in data.items()}
                        for label,data in [('before',baseline),('after',current)]},
                actual_concept_assignment_changes=changes,reviewed_partial_omissions=reviewed,
                independent_oracle=dict(ban_ids=sorted(ban_ids),spaced_ids=sorted(spaced_ids),zi_mao_ids=sorted(zi_ids)),
                limits=['Mentions include negative/source-disagreement contexts; no chart validity is inferred.',
                        'ST/T copies and repeated titles are not independent sources.',
                        'Only three exact spaced aliases and six ban-hyeong inflections are enabled.',
                        'Maps/edges/cards/alias-judgment/D5/P2/app outputs are not regenerated.'])


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True)
    args=p.parse_args();result=measure()
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['counts'],ensure_ascii=False),flush=True)
