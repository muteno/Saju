"""Source boundaries, paired-topic deduplication and eight-topic preservation."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from foundation_claims import CATALOG as OLD_CATALOG, REVIEW as OLD_REVIEW, ClaimIndex, load_index
from foundation_livelihood import extend_index as previous_index, CombinedIndex
from foundation_peach import CATALOG, REVIEW, REPO, PeachIndex, validate
from foundation_additions import text_sha
from knowledge_query import query

ROOT = Path(__file__).resolve().parent


class PeachTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = json.loads((ROOT / "knowledge_graph.json").read_text())
        cls.legacy = json.loads((ROOT / "data/legacy_review.json").read_text())
        cls.review = json.loads((REPO / REVIEW).read_text())
        cls.catalog = json.loads((REPO / CATALOG).read_text())
        old = ClaimIndex(json.loads((REPO / OLD_CATALOG).read_text()), cls.graph,
                         json.loads((REPO / OLD_REVIEW).read_text()))
        cls.old = previous_index(old, cls.graph)
        cls.current = load_index(cls.graph)

    def context(self, term):
        return query(term, self.graph, claim_index=self.current)["source_claim_review"]

    def test_existing_eight_topics_and_186_base_queries_are_preserved(self):
        terms = {v for n in self.graph["nodes"] for v in (n["id"], n["title"], *n["aliases"])}
        self.assertEqual(len(terms), 186)
        for term in terms:
            before = query(term, self.graph, self.legacy, self.old)
            after = query(term, self.graph, self.legacy, self.current)
            a, b = before.pop("source_claim_review", None), after.pop("source_claim_review", None)
            self.assertEqual(before, after, term)
            if a:
                for field, key in (("topics", "id"), ("claims", "id"), ("lexical_reviews", "concept"), ("evidence", "id")):
                    ids = {r[key] for r in a[field]}
                    self.assertEqual([r for r in b[field] if r[key] in ids], a[field], (term, field))
        self.assertEqual(len(self.old.topics()), 8)
        for topic in self.old.topics():
            for term in (topic["id"], topic["title"]):
                self.assertEqual(query(term, self.graph, self.legacy, self.old),
                                 query(term, self.graph, self.legacy, self.current), term)

    def test_pair_returns_complete_source_context_once(self):
        for title in ("진도화", "가도화"):
            ctx = self.context(title)
            self.assertEqual([t["title"] for t in ctx["topics"]], [title])
            self.assertEqual(len(ctx["claims"]), 10)
            self.assertEqual(len(ctx["evidence"]), 10)
            self.assertEqual(ctx["lexical_reviews"], [next(d for d in self.review["decisions"] if d["concept"] == title)])
        self.assertEqual(self.context("진도화")["claims"], self.context("가도화")["claims"])
        shared = self.context("자(子)")
        self.assertEqual({t["title"] for t in shared["topics"]}, {"진도화", "가도화"})
        self.assertEqual(shared["claims"], self.context("진도화")["claims"])
        self.assertEqual(len({e["id"] for e in shared["evidence"]}), len(shared["evidence"]))
        self.assertEqual(self.current.counts["claims"], 52)
        self.assertEqual(self.current.counts["source_configurations"], 21)

    def test_source_specific_tables_have_alternatives_scope_and_same_pillar(self):
        claims = {c["id"]: c for c in self.context("진도화")["claims"]}
        # Independent source oracle: 사주공부1528–1531/1625–1628,
        # 보드3472–3476, 2020년 전사80–83 (the last two rows reverse order).
        expected = [("亥卯未", "子"), ("寅午戌", "卯"), ("巳酉丑", "午"), ("申子辰", "酉")]
        for cid in ("peach_base", "peach_narrow", "peach_table", "peach_dohwa"):
            rows = claims[cid]["configurations"]
            self.assertEqual([( ''.join(v.removeprefix('branch_') for v in r['reference_branch_options']),
                               r['target_branch_node_id'].removeprefix('branch_')) for r in rows], expected)
            self.assertTrue(all(r["application_status"] == "not_evaluated" for r in rows))
            if cid == "peach_narrow":
                self.assertEqual([r["same_pillar_stem_node_id"] for r in rows], ["stem_甲", "stem_丁", "stem_庚", "stem_癸"])
                self.assertTrue(all("같은 주" in r["target_scope"] and "일주 한정 아님" in r["target_scope"] for r in rows))
            else:
                self.assertTrue(all(r["same_pillar_stem_node_id"] is None for r in rows))
        self.assertTrue(all(r['reference_scope'] == '이 전사에서는 일지' for r in claims['peach_dohwa']['configurations']))
        self.assertTrue(all(r['reference_scope'] == '연지 또는 일지' for r in claims['peach_base']['configurations']))
        self.assertTrue(all('삼합국 열' in r['reference_scope'] and '방합국 열의 대응 미검수' in r['reference_scope']
                            for r in claims['peach_table']['configurations']))
        self.assertTrue(any('寅卯辰' in v and '亥卯未' in v for v in claims['peach_table']['unresolved']))

    def test_disagreements_asr_time_and_other_system_are_not_erased(self):
        c = {c["id"]: c for c in self.context("진도화")["claims"]}
        self.assertEqual(c['peach_narrow']['source_status'], 'author_does_not_use_origin_unknown')
        self.assertTrue(any('납음' in v for v in c['peach_hamji']['conditions']))
        self.assertTrue(any('완화' in v for v in c['peach_hamji']['exceptions']))
        self.assertIn('충/형', c['peach_effect']['statement'])
        self.assertIn('지지충', c['peach_table']['conditions'][1])
        self.assertTrue(any('85' in v for v in c['peach_dohwa']['unresolved']))
        self.assertTrue(any('87' in v for v in c['peach_dohwa']['unresolved']))
        self.assertIn('2020 경자년', c['peach_time']['time_scope'])
        self.assertTrue(any('옴휴파' in v for v in c['peach_priority']['unresolved']))
        self.assertEqual({c[k]['source_family'] for k in ('peach_dohwa','peach_time','peach_priority','peach_other_system')}, {'dohwa_kim_jeonghun'})
        self.assertEqual(c['peach_other_system']['source_system'], 'ziwei')
        self.assertEqual(c['peach_other_system']['source_status'], 'not_a_saju_rule')
        self.assertTrue(all(p['node_id'] is None for p in c['peach_other_system']['participants']))
        for claim in c.values():
            self.assertEqual(claim['application_status'], 'not_evaluated')
            self.assertFalse(claim['inference_enabled'])
            self.assertIsNone(claim['probability'])
            self.assertEqual(claim['relations'], [])

    def test_unmapped_names_and_non_transitive_anchors(self):
        for term in ('년살','목욕','함지살','탐랑','진도와','연지','일지','삼합 합화 오행'):
            self.assertEqual(query(term,self.graph,claim_index=self.current)['status'], 'not_found', term)
        expected = {'일간': {'관살혼잡','재고귀인'}, '지장간': {'재고귀인'},
                    '충': {'재고귀인','진도화','가도화'}, '재성': {'재생관','재고귀인','진도화','가도화'}}
        for term, titles in expected.items():
            self.assertEqual({t['title'] for t in self.context(term)['topics']}, titles)
        # The narrow source concerns 삼합 합화 오행, not the base 천간합화 rule.
        transformed = query('합화', self.graph, claim_index=self.current)
        self.assertNotIn('source_claim_review', transformed)

    def test_structural_scope_provenance_and_activation_mutations_fail(self):
        def claim(c, cid): return next(r for r in c['claims'] if r['id'] == cid)
        edits = [lambda c:c.update(inference_enabled=True), lambda c:c.update(use_as_training_labels=0),
                 lambda c:c.update(probability=.5), lambda c:c.update(schema_version=True),
                 lambda c:c['topics'].pop(), lambda c:c['claims'].pop(),
                 lambda c:c['claims'][0].update(weight=.3),
                 lambda c:c['claims'][0].update(evidence_ids=['peach_dohwa_time']),
                 lambda c:c['claims'][0]['topic_ids'].pop(),
                 lambda c:c['claims'][0]['participants'][0].update(node_id='authority'),
                 lambda c:c['topics'][0]['anchor_node_ids'].append('day_master'),
                 lambda c:claim(c,'peach_other_system').update(source_system='saju'),
                 lambda c:claim(c,'peach_narrow').update(source_status='attributed'),
                 lambda c:claim(c,'peach_narrow')['configurations'][0].update(same_pillar_stem_node_id='stem_乙'),
                 lambda c:claim(c,'peach_narrow')['configurations'][0].update(target_scope='일주'),
                 lambda c:claim(c,'peach_dohwa')['configurations'][0].update(reference_scope='연지'),
                 lambda c:claim(c,'peach_effect')['relations'].append({'predicate':'always'})]
        for i, edit in enumerate(edits):
            c=deepcopy(self.catalog); edit(c)
            with self.subTest(i=i), self.assertRaises(ValueError): validate(c,self.graph,self.review)

    def test_source_graph_and_composition_identity_checks(self):
        c=deepcopy(self.catalog); c['review_sha256']='0'*64
        with self.assertRaises(ValueError): validate(c,self.graph,self.review)
        for edit in ({'quote':'invented'}, {'sha256':'0'*64}, {'path':'../outside'}):
            r=deepcopy(self.review)
            next(e for e in r['evidence'] if e['id']=='peach_ziwei').update(edit)
            raw=(json.dumps(r,ensure_ascii=False)+'\n').encode()
            c=deepcopy(self.catalog); c['review_sha256']=text_sha(raw)
            read=Path.read_bytes
            with patch.object(Path,'read_bytes',lambda p:raw if p==REPO/REVIEW else read(p)):
                with self.assertRaises(ValueError): validate(c,self.graph,r)
        g=deepcopy(self.graph);g['nodes'][0]['definition']+=' changed'
        with self.assertRaises(ValueError): query('진도화',g,claim_index=self.current)
        with self.assertRaises(ValueError): CombinedIndex(self.current,self.current)

    def test_returned_nested_data_is_independent(self):
        c,r=deepcopy(self.catalog),deepcopy(self.review)
        index=PeachIndex(c,self.graph,r)
        expected=index.retrieve('branch_子')
        c['claims'].clear();r['evidence'].clear()
        output=index.retrieve('branch_子')
        output['claims'][1]['configurations'][0]['reference_branch_options'].clear()
        output['evidence'][0]['quote']='changed'
        self.assertEqual(index.retrieve('branch_子'),expected)
        out=self.context('충');out['claims'].clear()
        self.assertTrue(self.context('충')['claims'])

    def test_default_cli_explicit_base_mode_and_missing_catalog(self):
        for title in ('진도화','가도화'):
            cmd=[sys.executable,str(ROOT/'knowledge_query.py'),title]
            result=json.loads(subprocess.check_output(cmd+['--diagram-context'],cwd='/tmp',text=True))
            self.assertEqual(result.pop('diagram_context')['status'],'no_live_board_binding')
            self.assertEqual(result,query(title,self.graph,self.legacy,self.current))
            self.assertEqual(json.loads(subprocess.check_output(cmd+['--base-only'],cwd='/tmp',text=True))['status'],'not_found')
        read=Path.read_text
        def missing(p,*args,**kwargs):
            if p==REPO/CATALOG: raise FileNotFoundError(str(p))
            return read(p,*args,**kwargs)
        with patch.object(Path,'read_text',missing),self.assertRaises(FileNotFoundError): load_index(self.graph)


if __name__ == '__main__':
    unittest.main()
