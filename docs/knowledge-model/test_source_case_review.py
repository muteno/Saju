"""Actual source transcriptions, missing facts, provenance drift and scope separation."""
import copy
import json
from pathlib import Path
import subprocess
import unittest

from context_query import ROOT, REPO, calculate_context
from source_case_review import audit, bound_pillar, case_request, dependency_components, evidence_index


class SourceCaseReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = json.loads((ROOT / 'data/source_cases.json').read_text(encoding='utf-8'))
        cls.reviews = json.loads((ROOT / 'data/context_reviews.json').read_text(encoding='utf-8'))
        cls.legacy = json.loads((ROOT / 'data/legacy_review.json').read_text(encoding='utf-8'))
        cls.result = audit(cls.bundle, cls.reviews, cls.legacy)
        cls.rows = {c['id']: c for c in cls.result['cases']}
        cls.evidence = {e['id']: e for e in cls.bundle['evidence']}

    def test_literal_corpus_and_column_order(self):
        self.assertEqual((self.result['case_count'], self.result['source_file_count']), (6, 4))
        self.assertEqual(len(self.evidence), 32)
        self.assertEqual(self.rows['clock_four_pillars']['reported_input'],
                         {'year': 36, 'month': 17, 'day': 12, 'hour': 30})
        self.assertEqual(self.rows['root_flower_example']['reported_input'],
                         {'year': 36, 'month': 17, 'day': 13, 'hour': 45})

    def test_surface_absence_does_not_erase_hidden_authority(self):
        # 乙丑 甲申 丙午 乙未: no visible water, but 丑/申 retain 癸/壬.
        row = self.rows['self_four_pillars']
        self.assertEqual(row['reported_input'], {'year': 1, 'month': 20, 'day': 42, 'hour': 31})
        values = {r['id']: r['condition_value'] for r in row['conditions']}
        self.assertEqual(values['authority_surface_absence'], 1)
        self.assertEqual(values['authority_surface_and_hidden_absence'], 0)
        self.assertIsNone(row['prediction']['probability'])

    def test_same_subject_does_not_fill_missing_pillars_or_create_two_votes(self):
        row = self.rows['same_subject_day_hour']
        self.assertEqual(row['reported_input'], {'year': None, 'month': None, 'day': 42, 'hour': 31})
        self.assertIsNone(row['observations']['natal.surface_role.authority.present'])
        self.assertIn(['self_four_pillars', 'same_subject_day_hour'], self.result['dependency_components'])

    def test_reported_transits_are_not_a_dated_natal_union(self):
        row = self.rows['three_pillars_transits']
        self.assertEqual(row['reported_input'], {'year': 6, 'month': 20, 'day': 9, 'hour': None})
        self.assertEqual(row['time_context']['daewoon']['pillar'], 17)  # 辛巳
        self.assertEqual(row['time_context']['yearly']['pillar'], 37)  # 辛丑
        self.assertIsNone(row['time_context']['monthly']['pillar'])
        self.assertIsNone(row['evaluated_at'])
        self.assertIsNone(row['time_context']['daewoon']['start'])
        for c in row['conditions']:
            if 'samhap' in c['id']:
                self.assertIsNone(c['condition_value'])
        self.assertFalse(row['provenance']['calendar_calculation_performed'])

    def test_conflicting_years_remain_reported_symbols_only(self):
        row = self.rows['conflicting_calendar_example']
        self.assertIn('conflicting_birth_year', {x['code'] for x in row['issues']})
        self.assertEqual(row['reported_input'], {'year': 11, 'month': 20, 'day': 24, 'hour': 56})
        self.assertNotIn('birth', row)
        self.assertFalse(row['training_eligible'])

    def test_no_labels_or_accuracy_claim_from_source_coverage(self):
        self.assertEqual(self.result['training_eligible_count'], 0)
        self.assertFalse(self.result['training_labels_created'])
        self.assertFalse(self.result['position_mapping_expert_verified'])
        self.assertEqual(self.result['condition_coverage']['eul_wood_fire_context'], {'not_matched': 6})
        for row in self.result['cases']:
            self.assertFalse(row['training_eligible'])
            self.assertIsNone(row['training_label'])

    def test_source_quote_hash_offset_and_path_drift_rejected(self):
        mutations = [('quote', 'altered'), ('sha256', '0' * 64), ('paragraph_sha256', '0' * 64),
                     ('start', -1), ('end', 100000), ('paragraph', 'XML-P999999'),
                     ('path', '../outside.docx')]
        for key, value in mutations:
            with self.subTest(key=key):
                bundle = copy.deepcopy(self.bundle)
                bundle['evidence'][0][key] = value
                with self.assertRaises(ValueError):
                    evidence_index(bundle, REPO)

    def test_symbol_changes_offsets_and_impossible_pairs_rejected(self):
        original = self.bundle['cases'][0]['bindings'][0]
        for field, value in [('value', '甲子'), ('value', '庚丑')]:
            binding = copy.deepcopy(original); binding[field] = value
            with self.assertRaises(ValueError):
                bound_pillar(binding, self.evidence, self.bundle['cases'][0]['evidence_ids'])
        for offset in (True, -1, 1000):
            binding = copy.deepcopy(original); binding['symbols'][0]['offset'] = offset
            with self.assertRaises(ValueError):
                bound_pillar(binding, self.evidence, self.bundle['cases'][0]['evidence_ids'])

    def test_case_evidence_and_position_bindings_required(self):
        for mutate in ('unbound', 'duplicate', 'position'):
            case = copy.deepcopy(self.bundle['cases'][0])
            if mutate == 'unbound':
                case['evidence_ids'].remove('clock_stems')
            elif mutate == 'duplicate':
                case['bindings'].append(case['bindings'][0])
            else:
                case['bindings'][0]['position_evidence'] = []
            with self.assertRaises(ValueError):
                case_request(case, self.evidence)

    def test_source_assertions_cannot_be_promoted_to_labels_or_supplied_features(self):
        for key, value in [('training_label', 1), ('features', {}), ('labels', {}),
                           ('birth', {}), ('evaluated_at', '2026-09-22T00:00:00Z')]:
            case = copy.deepcopy(self.bundle['cases'][0]); case[key] = value
            with self.assertRaises(ValueError):
                case_request(case, self.evidence)
        bundle = copy.deepcopy(self.bundle); bundle['use_as_training_labels'] = True
        with self.assertRaises(ValueError):
            audit(bundle, self.reviews, self.legacy)

    def test_same_file_dependency_survives_renamed_groups(self):
        cases = copy.deepcopy(self.bundle['cases'])
        for i, c in enumerate(cases):
            c['source_group'] = f'source_{i}'; c['subject_group'] = f'subject_{i}'
            c['dependency_groups'] = [f'dependency_{i}']
        groups = dependency_components(cases, self.evidence)
        self.assertIn(['clock_four_pillars', 'root_flower_example', 'three_pillars_transits'], groups)

    def test_reported_adapter_rejects_calendar_or_model_payloads(self):
        good = case_request(self.bundle['cases'][0], self.evidence)
        for extra in ({'evaluated_at': None}, {'features': {}}, {'birth': {}}):
            run = subprocess.run(['node', str(ROOT / 'reported_context.mjs'), '-'],
                                 input=json.dumps([{**good, **extra}]), capture_output=True, text=True)
            self.assertEqual(run.returncode, 2)
        with self.assertRaises(ValueError):
            calculate_context(good)


if __name__ == '__main__':
    unittest.main()
