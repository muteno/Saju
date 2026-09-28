import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import basic_sentence_review as review


class BasicSentenceReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.value = review.load_review()

    def test_scope_is_selected_items_not_three_complete_ilju(self):
        value = self.value
        self.assertEqual(value['inventory']['personality_drafts'], 402)
        self.assertEqual(value['inventory']['personality_drafts_reviewed'], 4)
        self.assertEqual(value['inventory']['ilju_fully_reviewed'], 0)
        self.assertEqual(len(value['items']), 14)
        self.assertEqual(sum(isinstance(x['draft_value'], str) for x in value['items']), 12)
        self.assertIsNone(value['independent_support_count'])

    def test_temporal_heading_and_missing_other_pillars_remain_with_claim(self):
        time = review.retrieve('IN05')
        original = '\n'.join(p['text'] for s in time['spans'] for p in s['paragraphs'])
        self.assertIn('경자년(2020년) 갑인일주 운세', original)
        context = review.retrieve('IN02')
        original = '\n'.join(p['text'] for s in context['spans'] for p in s['paragraphs'])
        self.assertIn('다른 요인에 의해 얼마든지 달라질 수 있지만', original)
        self.assertEqual(context['item']['personal_application'], 'withheld')

    def test_comparison_keeps_both_authors_and_adjacent_qualification(self):
        value = review.retrieve('OH04')
        self.assertEqual(len(value['item']['draft_value']['견해']), 2)
        text = '\n'.join(p['text'] for s in value['spans'] for p in s['paragraphs'])
        self.assertIn('충극이 없이 안정', text)
        self.assertIn('명조일 수 있습니다', text)
        self.assertIn('내적인 만족이나 결실', text)
        self.assertEqual(len(value['source_units']), 2)

    def test_review_mutations_cannot_promote_or_swap_claims(self):
        mutations = [
            lambda x: x.update(inference_enabled=True),
            lambda x: x.update(probability=.8),
            lambda x: x['items'][1]['review'].update(conditions=''),
            lambda x: x['items'][9]['draft_value']['견해'].pop(),
            lambda x: x['items'][0].update(evidence=x['items'][2]['evidence']),
            lambda x: x['inventory'].update(ilju_fully_reviewed=3),
            lambda x: x['source_units']['현묘의 사주 이야기 글모음#0032'].update(lineage='independent'),
            lambda x: x['items'][0].update(training_eligible=1),
        ]
        for mutate in mutations:
            value = copy.deepcopy(self.value)
            mutate(value)
            with self.assertRaisesRegex(ValueError, 'Reviewed payload changed'):
                review.validate(value)

    def test_actual_source_and_inventory_changes_are_detected(self):
        # A small physical copy tests reads from a caller-supplied repository,
        # without patching the checker or relying on generated unit_bodies.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            for rel in [review.REVIEW, *self.value['inputs'], *self.value['archives']]:
                target = root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(review.REPO / rel, target)
            review.load_review(root)
            source = root / next(iter(self.value['archives']))
            original = source.read_bytes()
            source.write_bytes(original + b'changed')
            with self.assertRaisesRegex(ValueError, 'Archive changed'):
                review.load_review(root)
            source.write_bytes(original)
            draft = root / 'dosa-app/kb/distilled/ilju/갑인.json'
            original = draft.read_bytes()
            draft.write_bytes(original.replace('손해볼'.encode(), '이익볼'.encode()))
            with self.assertRaisesRegex(ValueError, 'Input changed'):
                review.load_review(root)
            draft.write_bytes(original)
            (draft.parent / 'extra.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Inventory files changed'):
                review.load_review(root)
            (draft.parent / 'extra.json').unlink()
            for rel in self.value['inputs']:
                path = root / rel
                path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
            review.load_review(root)

    def test_xml_locators_include_empty_paragraphs(self):
        value = self.value
        for rel in value['archives']:
            units = review.archive_units((review.REPO / rel).read_bytes())
            for key, source in value['source_units'].items():
                if source['archive_path'] != rel:
                    continue
                unit = units[int(key.rsplit('#', 1)[1])]
                positions = [p['xml_paragraph'] for p in unit['body']]
                self.assertEqual(positions, sorted(set(positions)))
                self.assertGreater(positions[0], unit['heading_xml_paragraph'])
        self.assertEqual(value['fallback_review']['ordered_units'][0]['unit'],
                         '명리학탐구(고급1) 게시판 글모음#0017')

    def test_path_escape_and_resolved_target(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve() / 'repo'
            root.mkdir()
            outside = root.parent / 'outside'
            for rel in ('../outside', str(outside)):
                with self.assertRaises(ValueError):
                    review.path_in(root, rel)
            resolve = Path.resolve
            def moved(path, *args, **kwargs):
                return resolve(outside if path == root / 'link' else path, *args, **kwargs)
            with patch.object(Path, 'resolve', moved), self.assertRaises(ValueError):
                review.path_in(root, 'link')

    def test_detached_read_only_query_and_unknown_id(self):
        with (patch.object(Path, 'write_text', side_effect=AssertionError('write')),
              patch.object(Path, 'write_bytes', side_effect=AssertionError('write'))):
            result = review.retrieve('IN06')
            result['item']['draft_value']['견해'].clear()
            self.assertEqual(len(review.retrieve('IN06')['item']['draft_value']['견해']), 2)
        with self.assertRaisesRegex(ValueError, 'Unknown reviewed item'):
            review.retrieve('all-ilju-approved')

    def test_cli_works_from_another_cwd_with_ascii_console(self):
        with tempfile.TemporaryDirectory() as temp:
            result = subprocess.run([sys.executable, str(Path(review.__file__)), '--check'],
                                    cwd=temp, env={**os.environ, 'PYTHONIOENCODING': 'ascii'},
                                    capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['status'], 'archival_review_verified')


if __name__ == '__main__':
    unittest.main()
