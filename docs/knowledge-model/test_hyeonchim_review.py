"""Independent marker oracle, source provenance and consumer loss checks."""
from copy import deepcopy
import json
import os
import subprocess
import sys
import tempfile
import unittest

import hyeonchim_review as audit


class HyeonchimReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = audit.load_review()
        cls.result = audit.measure(cls.review)

    def test_reproducible_source_and_engine_measurement(self):
        self.assertTrue(audit.same_json(self.result, json.loads(audit.MEASUREMENT.read_text(encoding='utf-8'))))

    def test_all_sixty_pillars_in_all_four_positions(self):
        rows = self.result['engine']['singlePillars']
        self.assertEqual({(r['position'], r['index']) for r in rows},
                         {(p, i) for p in audit.POSITIONS for i in range(60)})
        for r in rows:
            for pos, index in r['pillars'].items():
                # Independent character membership; no regex of JS constants.
                self.assertEqual(r['observations'][pos], {
                    'stem': '甲乙丙丁戊己庚辛壬癸'[index % 10] in '甲辛',
                    'branch': '子丑寅卯辰巳午未申酉戌亥'[index % 12] in '卯午未申'})

    def test_counts_duplicates_hidden_stems_and_combinations(self):
        rows = {r['id']: r for r in self.result['engine']['combinations']}
        count = lambda r: sum(int(v) for x in r['observations'].values() for v in x.values())
        expected = {'none': 0, 'one-stem': 1, 'two-repeated-stems': 2, 'three-repeated-stems': 3,
                    'two-same-pillar': 2, 'two-separated': 2, 'myo-only': 1, 'mi-only': 1,
                    'hidden-jia-only': 0, 'jia-ji-neighbor': 1, 'jia-ji-separated': 1, 'eight-markers': 8}
        self.assertEqual({k: count(r) for k, r in rows.items()}, expected)
        self.assertTrue(rows['jia-ji-neighbor']['observations']['year']['stem'])
        self.assertTrue(rows['jia-ji-separated']['observations']['year']['stem'])

    def test_board_coordinates_blank_and_header_ambiguity(self):
        cells = self.result['board_cells']
        marked = [c for c in cells if c['listed']]
        self.assertEqual(len(cells), 120)
        self.assertEqual(len(marked), 24)
        self.assertEqual(sum(c['count_note'] is not None for c in marked), 20)
        plain = {c['stem'] + c['branch'] for c in marked if c['count_note'] is None}
        self.assertEqual(plain, {'甲午', '甲申', '辛卯', '辛未'})
        mismatch = [c for c in cells if not c['header_hanja_matches']]
        self.assertEqual(len(mismatch), 12)
        self.assertTrue(all(c['stem'] == '丁' and c['header']['text'].startswith('정(午)') for c in mismatch))
        self.assertEqual(self.review['board']['blank_means'], 'not_listed_not_negative')
        self.assertTrue(all(c['personal_application'] == 'withheld' for c in cells))

    def test_same_pillar_diagnostic_is_not_a_false_board_rule(self):
        rows = self.result['same_pillar_comparison']
        self.assertEqual(len(rows), 60)
        self.assertEqual({r['name'] for r in rows if r['engine_same_pillar_markers'] and not r['board_listed']},
                         {'乙未', '丁未', '己未', '癸未'})
        self.assertTrue(all(r['scope'] == 'same_pillar_diagnostic_not_board_target_position_policy' for r in rows))
        self.assertTrue(all(r['engine_same_pillar_markers'] > 0 for r in rows if r['board_listed']))

    def test_key_and_report_deduplication_loses_count(self):
        reports = self.result['engine']['reports']
        self.assertEqual(len(reports), 62)
        self.assertEqual(len({r['pillars']['day'] for r in reports}), 60)
        for row in reports:
            count = sum(int(v) for x in row['observations'].values() for v in x.values())
            self.assertEqual(row['topic_occurrences'], count)
            self.assertEqual(row['distinct_key_count'], int(count > 0))
            self.assertEqual(row['report_label_count'], int(count > 0))
        self.assertTrue(any(r['topic_occurrences'] > 1 and r['report_label_count'] == 1 for r in reports))
        self.assertEqual([r['topic_occurrences'] for r in reports[-2:]], [0, 1])
        self.assertEqual(self.result['engine']['report_scope'],
                         'label_propagation_with_empty_kb_not_excerpt_or_ui_validation')

    def test_reject_tampered_quotes_ranges_and_source_profiles(self):
        for field, value in [('quote', 'invented'), ('lines', [0, 1]), ('source_profile', 'study'),
                             ('status', 'preserved_source'), ('sha256', '0' * 64),
                             ('path', '../outside.md'), ('lines', [True, 34])]:
            with self.subTest(field=field, value=value):
                changed = deepcopy(self.review)
                changed['evidence'][0][field] = value
                with self.assertRaises(ValueError):
                    audit.validate(changed)

    def test_no_unverified_policy_or_training_promotion(self):
        for field, value in [('inference_enabled', True), ('probability', .7), ('use_as_training_labels', True)]:
            changed = deepcopy(self.review)
            changed[field] = value
            with self.assertRaises(ValueError):
                audit.validate(changed)
        for field, value in [('blank_means', 'false'), ('count_scope', 'all_eight'),
                             ('adjacency_rule', 'required'), ('fortune_layer_rule', 'same_as_natal')]:
            changed = deepcopy(self.review)
            changed['board'][field] = value
            with self.assertRaises(ValueError):
                audit.validate(changed)

    def test_claim_source_binding_and_output_independence(self):
        changed = deepcopy(self.review)
        changed['claims'][0]['evidence_ids'] = ['study_myo']
        with self.assertRaises(ValueError):
            audit.validate(changed)
        cells = audit.board_cells(self.review)
        cells[0]['header']['text'] = 'changed output'
        self.assertNotEqual(audit.board_cells(self.review)[0]['header']['text'], 'changed output')
        self.assertTrue(all(c['application_status'] == 'withheld' and c['probability'] is None
                            for c in self.review['claims']))

    def test_cli_from_other_cwd_with_non_utf8_stdout(self):
        result = subprocess.run([sys.executable, str(audit.HERE / 'hyeonchim_review.py'), '--check'],
                                cwd=tempfile.gettempdir(), env={**os.environ, 'PYTHONIOENCODING': 'cp1252'},
                                capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        self.assertEqual(json.loads(result.stdout), self.result['summary'])

    def test_reject_other_author_or_irrelevant_same_author_evidence(self):
        other = next(e for e in self.review['evidence'] if e['id'] == 'saram_example')
        changed = deepcopy(self.review)
        for key in ('path', 'lines', 'quote', 'sha256'):
            changed['evidence'][0][key] = deepcopy(other[key])
        with self.assertRaisesRegex(ValueError, 'binding changed'):
            audit.validate(changed)
        changed = deepcopy(self.review)
        evidence = changed['evidence'][0]
        lines = (audit.ROOT / evidence['path']).read_text(encoding='utf-8').splitlines()
        evidence.update(lines=[3, 5], quote='\n'.join(lines[2:5]))
        with self.assertRaisesRegex(ValueError, 'binding changed'):
            audit.validate(changed)

    def test_reject_manifest_substitution_and_rehashed_source(self):
        changed = deepcopy(self.review)
        del changed['frozen_inputs']['app/src/data/useReport.ts']
        changed['frozen_inputs']['CLAUDE.md'] = audit.digest(audit.ROOT / 'CLAUDE.md')
        with self.assertRaisesRegex(ValueError, 'manifest changed'):
            audit.validate(changed)
        changed = deepcopy(self.review)
        changed['frozen_inputs']['app/src/data/useReport.ts'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'manifest changed'):
            audit.validate(changed)
        changed = deepcopy(self.review)
        changed['evidence'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'binding changed'):
            audit.validate(changed)

    def test_json_types_cannot_change_silently(self):
        for key, value in [('schema_version', True), ('inference_enabled', 0), ('use_as_training_labels', 0)]:
            changed = deepcopy(self.result)
            changed[key] = value
            self.assertFalse(audit.same_json(self.result, changed))
        changed = deepcopy(self.result)
        changed['engine']['singlePillars'][0]['observations']['year']['stem'] = 1
        self.assertFalse(audit.same_json(self.result, changed))
        for value in (True, 1.0):
            changed = deepcopy(self.review)
            changed['schema_version'] = value
            with self.assertRaises(ValueError):
                audit.validate(changed)


if __name__ == '__main__':
    unittest.main()
