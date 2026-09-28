import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import gapin_structure_review as g


class GapinStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = g.load_review()

    def test_sources_and_measurement_reproduced(self):
        result = g.check()
        self.assertEqual((result['claims'], result['evidence_spans'], result['symbol_cases']), (5, 20, 180))
        self.assertFalse(result['app_integration'])

    def test_node_oracle_and_existing_policy(self):
        completed = subprocess.run(['node', '--test', '--test-reporter=tap', str(g.REPO / 'docs/knowledge-model/test_gapin_structure_observations.mjs')],
                                   capture_output=True, text=True, timeout=30)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertIn('# tests 4', completed.stdout)
        self.assertIn('# pass 4', completed.stdout)
        self.assertIn('# skipped 0', completed.stdout)

    def test_reference_query_has_exact_sources_and_limits(self):
        result = g.query([0, 0, 50, 0])
        for claim in result['claims']:
            self.assertEqual([x['id'] for x in claim['evidence']], claim['evidence_ids'])
            self.assertTrue(all(x['source_metadata']['lineage'] for x in claim['evidence']))
            self.assertEqual(claim['personal_application'], 'withheld')
            self.assertTrue(claim['limits'])
        self.assertEqual(result['condition_review']['source_presence'], 'unknown')
        self.assertEqual(result['symbol_comparison']['sourceAbsence'], 'unknown')
        result['claims'][0]['text'] = 'tampered'
        self.assertNotEqual(g.query()['claims'][0]['text'], 'tampered')

    def test_semantics_evidence_and_null_cannot_be_swapped(self):
        for mutate in [
            lambda r: r['claims'][0].update(evidence_ids=['male_condition']),
            lambda r: r['claims'][0].update(text='success guaranteed'),
            lambda r: r['condition_review'].update(source_presence='met'),
            lambda r: r.update(probability=0.5),
            lambda r: r.update(training_eligible=False),
            lambda r: r['evidence'][0]['paragraphs'][0].update(text='changed'),
            lambda r: r['sources']['board_snapshot'].update(path='../outside'),
        ]:
            candidate = copy.deepcopy(self.review); mutate(candidate)
            with self.assertRaises(ValueError): g.validate(candidate)

    def test_changed_source_bytes_fail_even_if_review_is_untouched(self):
        original = Path.read_bytes
        def changed(path):
            raw = original(path)
            return raw + b'\nmodified' if path.name == 'figjam_board_full.md' else raw
        with patch.object(Path, 'read_bytes', changed):
            with self.assertRaisesRegex(ValueError, 'Source changed'): g.validate(self.review)

    def test_symbol_inputs_and_unknown_are_explicit(self):
        for value in [[], [0, 0, True, 0], [0, 0, 50.0, 0], [0, 0, '50', 0], [0, 0, 50, -1]]:
            with self.assertRaises(ValueError): g.run_observer(value)
        self.assertIsNone(g.query([0, 0, None, None])['symbol_comparison']['observations'])
        self.assertIsNone(g.query()['symbol_comparison'])

    def test_cli_other_cwd_ascii_stdout_and_invalid_options(self):
        command = ['python3', str(g.REPO / 'docs/knowledge-model/gapin_structure_review.py')]
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(command + ['--query', '--pillars', '[0,0,50,0]'], cwd=directory,
                                    capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout.decode('ascii')), g.query([0, 0, 50, 0]))
            bad = subprocess.run(command + ['--check', '--pillars', '[0,0,50,0]'], cwd=directory,
                                 capture_output=True, timeout=30)
            self.assertEqual(bad.returncode, 2)
            explicit_null = subprocess.run(command + ['--query', '--pillars', 'null'], cwd=directory,
                                           capture_output=True, timeout=30)
            self.assertEqual(explicit_null.returncode, 2)


if __name__ == '__main__':
    unittest.main()
