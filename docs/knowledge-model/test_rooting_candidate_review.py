import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import rooting_candidate_review as review


class RootingCandidateReviewTests(unittest.TestCase):
    def test_review_and_non_independent_groups(self):
        value = review.load_review()
        self.assertEqual([c['legacy_anchor_count'] for c in value['candidates']], [226, 1, 1, 1])
        groups = value['source_groups']
        self.assertEqual([len(g['candidate_ids']) for g in groups], [1, 3])
        self.assertEqual({g['post_id'] for g in groups}, {'SG-MID-P012'})
        self.assertIsNone(value['summary']['independent_support_count'])
        self.assertEqual(value['summary']['condition_rules_added'], 0)

    def test_definition_distance_is_not_strength(self):
        value = review.load_review()
        definition = value['claims'][0]
        self.assertIn('같은 강도라는 규칙은 아니다', definition['position'])
        self.assertIn('대운·세운은 여기서 검증되지 않음', definition['time'])
        self.assertIn('동주/인접만 허용하는 조건을 덧붙이지 않음', definition['limits'])
        self.assertEqual(value['comparisons'][0]['identity'], 'same_character')
        self.assertEqual(value['comparisons'][4]['identity'], 'same_or_supporting_element')

    def test_every_projection_keeps_food_god_and_shared_condition(self):
        for cid in review.IDS[1:]:
            with self.subTest(cid=cid):
                value = review.retrieve(cid)
                claim = value['claims'][1]
                self.assertEqual([x['label'] for x in claim['outcomes']],
                                 ['재성', '관성', '식신', '상관', '칠살(편관)'])
                self.assertIn('양자택일', claim['logic'])
                self.assertIn('역명제', claim['unknown'])
                self.assertFalse(value['inference_enabled'])
                self.assertFalse(value['training_labels'])
                self.assertIsNone(value['probability'])

    def test_unknown_candidate_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown reviewed candidate'):
            review.retrieve('rooting')

    def test_review_mutations_are_rejected(self):
        value = review.load_review()
        for mutate in (
                lambda x: x.update(inference_enabled=True),
                lambda x: x.update(probability=0.9),
                lambda x: x['candidates'][0].update(source_span='SG-MID-P012-04'),
                lambda x: x['claims'][1]['outcomes'].pop(2),
                lambda x: x['source_groups'][1]['candidate_ids'].pop(),
                lambda x: x['summary'].update(reviewed_candidates=True),
                lambda x: x['source']['post_record'].update(url='www.sajustudy.com/111')):
            changed = copy.deepcopy(value)
            mutate(changed)
            with self.assertRaisesRegex(ValueError, 'Reviewed payload changed'):
                review.validate(changed)

    def test_source_mutation_is_rejected(self):
        value = review.load_review()
        original = Path.read_bytes
        target = review.REPO / value['source']['path']
        def changed(path):
            content = original(path)
            return content + b'changed' if path == target else content
        with patch.object(Path, 'read_bytes', changed):
            with self.assertRaisesRegex(ValueError, 'Input changed'):
                review.validate(value)

    def test_archive_mutation_is_rejected(self):
        value = review.load_review()
        original = Path.read_bytes
        target = review.REPO / value['archive']['path']
        def changed(path):
            content = original(path)
            return content + b'changed' if path == target else content
        with patch.object(Path, 'read_bytes', changed):
            with self.assertRaisesRegex(ValueError, 'Archive changed'):
                review.validate(value)

    def test_crlf_text_checkout_is_supported(self):
        value = review.load_review()
        original = Path.read_bytes
        paths = {review.REPO / p for p in value['inputs']}
        def windows(path):
            content = original(path)
            return content.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n') if path in paths else content
        with patch.object(Path, 'read_bytes', windows):
            review.validate(value)

    def test_paths_and_resolved_symlink_escape_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve() / 'repo'
            root.mkdir()
            outside = Path(tmp) / 'outside'
            outside.write_text('x')
            for path in ('../outside', str(outside)):
                with self.subTest(path=path), self.assertRaises(ValueError):
                    review.path_in(root, path)
            # Windows non-admin accounts may not create symlinks (error 1314).
            # Exercise the resolved-target boundary without requiring that
            # unrelated OS privilege or silently skipping the check.
            original = Path.resolve
            def resolved(path, *args, **kwargs):
                target = outside if path == root / 'link' else path
                return original(target, *args, **kwargs)
            with patch.object(Path, 'resolve', resolved), self.assertRaises(ValueError):
                review.path_in(root, 'link')

    def test_cli_from_other_cwd_and_ascii_console(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, PYTHONIOENCODING='ascii')
            out = subprocess.run([sys.executable, str(Path(review.__file__)), '--check'],
                                 cwd=tmp, env=env, capture_output=True, check=True)
        value = json.loads(out.stdout)
        self.assertEqual(value['status'], 'source_review_verified')
        self.assertEqual(value['training_eligible'], 0)

    def test_retrieval_is_detached_and_does_not_write_inputs(self):
        value = review.load_review()
        paths = [review.REPO / p for p in value['inputs']]
        before = [p.read_bytes() for p in paths]
        result = review.retrieve(review.IDS[0])
        result['claims'][1]['outcomes'].clear()
        self.assertEqual(len(review.retrieve(review.IDS[0])['claims'][1]['outcomes']), 5)
        self.assertEqual(before, [p.read_bytes() for p in paths])


if __name__ == '__main__':
    unittest.main()
