"""Source integrity, bounded recall and unrelated-node preservation."""
from copy import deepcopy
import json
import sys
import unicodedata
import unittest
from unittest.mock import patch

from foundation_partial import BASE, GROUP, PARTIAL, REPO, REVIEW, validate_and_strip
from foundation_review import TAXONOMY, load_taxonomy, validate, fingerprint, REVIEW as F01
import measure_hidden_stages as shared


class PartialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads((REPO / REVIEW).read_text())
        cls.taxonomy = load_taxonomy(REPO / TAXONOMY)
        cls.f01 = json.loads((REPO / F01).read_text())
        sys.path.insert(0, str(shared.LEGACY))
        cls.after = shared.load_pair(False)

    def test_extension_strips_to_exact_previous_taxonomy_without_mutation(self):
        tax, review = deepcopy(self.taxonomy), deepcopy(self.review)
        stripped, result = validate_and_strip(review, tax)
        # PR #196 taxonomy fingerprint; no historical Git objects required by unit tests.
        self.assertEqual(fingerprint(stripped),
                         '162a5a7eea63e9866c04ae5a18fed9234942d6cda2eb6b0399daf29f4e99e8c2')
        self.assertEqual(tax, self.taxonomy)
        self.assertEqual(review, self.review)
        self.assertEqual((result['added_concepts'], result['added_existing_aliases']), (1, 4))
        self.assertIsNone(result['probability'])
        result = validate(self.f01)
        self.assertEqual(result['executable_concepts'], 282)
        self.assertEqual((result['concepts'], result['evidence_ranges']), (271, 176))
        self.assertEqual(result['f02_priority']['evidence_ranges'], 34)

    def test_manifest_and_taxonomy_cannot_jointly_authorize_more(self):
        for alias in ['상형', '육형', '미술 형', '반형태']:
            r, t = deepcopy(self.review), deepcopy(self.taxonomy)
            r['additions'][0]['aliases'].append(alias)
            t[GROUP[0]][GROUP[1]]['삼형'].append(alias)
            with self.subTest(alias=alias), self.assertRaises(ValueError):
                validate_and_strip(r, t)
        for mutate in [lambda t: t[GROUP[0]][GROUP[1]]['삼형'].remove('신인형'),
                       lambda t: t[GROUP[0]][GROUP[1]].update(새형=['자묘상형']),
                       lambda t: t[GROUP[0]][GROUP[1]]['자묘형'].append('무례지형')]:
            t = deepcopy(self.taxonomy); mutate(t)
            with self.assertRaises(ValueError):
                validate(self.f01, taxonomy=t)

    def test_claims_cannot_enable_inference_or_training(self):
        for change in [dict(inference_enabled=True), dict(use_as_training_labels=0),
                       dict(probability=.7), dict(scope='chart_inference')]:
            r = deepcopy(self.review);r.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_and_strip(r, self.taxonomy)

    def test_source_tampering_and_cross_links_fail(self):
        edits = [lambda r: r['evidence'][0].update(quote='없는 인용'),
                 lambda r: r['evidence'][0].update(sha256='0'*64),
                 lambda r: r['evidence'][0].update(lines=[True, 3]),
                 lambda r: r['evidence'][0].update(path='../outside'),
                 lambda r: r['claims'][0].update(evidence_ids=['missing']),
                 lambda r: r['additions'][0].update(evidence_ids=['ideal_counter']),
                 lambda r: r['evidence'].append(deepcopy(r['evidence'][0]))]
        for edit in edits:
            r=deepcopy(self.review);edit(r)
            with self.assertRaises(ValueError):
                validate_and_strip(r,self.taxonomy)

    def test_f01_does_not_skip_partial_review(self):
        from pathlib import Path
        read = Path.read_text
        r=deepcopy(self.review);r['claims'][0]['status']='learned_rule'
        def changed(p,*args,**kwargs):
            return json.dumps(r) if p == REPO / REVIEW else read(p,*args,**kwargs)
        with patch.object(Path,'read_text',changed),self.assertRaises(ValueError):
            validate(self.f01)

    def test_actual_omissions_and_negation_remain_mentions(self):
        for text in ['근데 이 인사\n형살이라고 하죠.', '축술 형살이 들어갔잖아요.',
                     '이거는? 반형이죠', '시간이 지나면 이게 반형이 되구요',
                     '반형을 인정하지 않는다.', '반형살을 가지고 있는데']:
            self.assertIn('삼형',self.after[0].concepts_in(text))
            self.assertIn('삼형',self.after[0].concepts_in(unicodedata.normalize('NFD',text)))

    def test_ordinary_words_do_not_become_partial_or_zi_mao(self):
        for text in ['일반형', '반형식적 태도', '반형태', '교육형', '이상형', '상형문자',
                     '인사 형식', '미술 형태', '반형은 미검수 어미']:
            with self.subTest(text=text):
                self.assertFalse(self.after[0].concepts_in(text) & {'삼형','자묘형'})
        self.assertIn('삼형',self.after[0].concepts_in('일반형과 반형이 함께 있다'))

    def test_zi_mao_is_separate_and_old_components_survive(self):
        for text in ['자묘형','자묘상형','자묘 형살']:
            self.assertEqual(self.after[0].concepts_in(text),{'자묘형'})
        expected = {'자묘형살인상생': {'살인상생'}, '자묘상형과 사신형': {'삼형'},
                    '갑목 자묘형 일지': {'갑목(甲)', '일지'},
                    '인사 형살인상생': {'살인상생'}, '축술 형살과 월지': {'월지'}}
        for text, old_concepts in expected.items():
            self.assertLessEqual(old_concepts,self.after[0].concepts_in(text))
        self.assertNotIn('삼형',self.after[0].concepts_in('자묘형'))

    def test_two_builders_agree_on_bounded_new_matches(self):
        import 코퍼스 as reader
        texts=['반형', '반형이죠', '반형살을', '일반형', '반형식', '반형도',
               '인사\n형살', '인사 형살', '축술 형살', '인사 형식',
               '자묘형', '자묘상형', '자묘 형살', '교육형', '상형문자',
               '상관패인사 형살', '재고귀인사 형살']
        rows=[dict(q=dict(para_id=str(i)),post={},text=t) for i,t in enumerate(texts)]
        # Clean checkouts have no ignored corpus files; this test supplies its own rows.
        with patch.object(self.after[1], 'load', return_value=({}, [])):
            hits=shared.run_pair(self.after,rows,reader,'partial_regression')
        self.assertEqual(hits['neuron']['삼형'],hits['concept_map']['삼형'])
        self.assertEqual(hits['neuron']['자묘형'],hits['concept_map']['자묘형'])
        self.assertEqual(hits['neuron']['삼형'],{'0','1','2','6','7','8','15','16'})
        self.assertEqual(hits['neuron']['자묘형'],{'10','11','12'})


if __name__=='__main__':
    unittest.main()
