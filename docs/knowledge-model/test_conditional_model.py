"""Structural model tests, never evidence for accuracy of Saju interpretation."""
import copy
import json
import math
from pathlib import Path
import unittest
from conditional_model import ValidationError, fit, predict

BUNDLE = json.loads(Path(__file__).with_name('context_demo.json').read_text(encoding='utf-8'))


class ConditionalModelTests(unittest.TestCase):
    def test_context_and_arbitrary_interaction_change_same_pair_continuously(self):
        model = BUNDLE['synthetic_model']
        probabilities = []
        for a in (0., 0.4, 1.):
            context = {'features': {'키워드_X': 1, '키워드_Y': 1, '설명용조건_A': a, '설명용조건_B': 0}}
            probabilities.append(predict(model, context, allow_synthetic=True)['claims'][0]['probability'])
        self.assertLess(probabilities[0], probabilities[1])
        self.assertLess(probabilities[1], probabilities[2])
        # Four-way interaction can change direction; independent pair weights cannot express this.
        context = {'features': {'키워드_X': 1, '키워드_Y': 1, '설명용조건_A': 1, '설명용조건_B': 1}}
        result = predict(model, context, allow_synthetic=True)['claims'][0]
        self.assertAlmostEqual(result['probability'], 1 / (1 + math.exp(1.5)))
        self.assertLess(result['probability'], probabilities[0])

    def test_unknown_is_not_observed_absence(self):
        context = {'features': {'키워드_X': 1, '키워드_Y': 1, '설명용조건_A': 1, '설명용조건_B': None}}
        result = predict(BUNDLE['synthetic_model'], context, allow_synthetic=True)['claims'][0]
        self.assertEqual(result['status'], 'needs_context')
        self.assertIsNone(result['probability'])
        context['features']['설명용조건_B'] = 0
        self.assertIsNotNone(predict(BUNDLE['synthetic_model'], context, allow_synthetic=True)['claims'][0]['probability'])

    def test_null_model_and_synthetic_default_never_produce_probability(self):
        context = BUNDLE['scenarios'][0]['context']
        default = predict(BUNDLE['untrained_model'], context)['claims'][0]
        self.assertEqual(default['status'], 'needs_training')
        self.assertIsNone(default['probability'])
        synthetic = predict(BUNDLE['synthetic_model'], context)['claims'][0]
        self.assertEqual(synthetic['status'], 'synthetic_excluded')
        self.assertIsNone(synthetic['probability'])

    def test_repeated_terms_deduplicate_and_contradictory_states_reject(self):
        context = copy.deepcopy(BUNDLE['scenarios'][0]['context'])
        first = predict(BUNDLE['synthetic_model'], context, allow_synthetic=True)
        context['present'] += ['키워드_X', '키워드_X', '키워드_Y']
        self.assertEqual(first, predict(BUNDLE['synthetic_model'], context, allow_synthetic=True))
        context['absent'].append('키워드_X')
        with self.assertRaises(ValidationError):
            predict(BUNDLE['synthetic_model'], context, allow_synthetic=True)

    def test_nonexclusive_claims_can_both_be_high_and_competing_uses_softmax(self):
        model = copy.deepcopy(BUNDLE['synthetic_model'])
        model['claims'][0]['bias'] = 4.
        other = copy.deepcopy(model['claims'][0]);other['id'] = 'another_claim'
        model['claims'].append(other)
        context = BUNDLE['scenarios'][0]['context']
        result = predict(model, context, allow_synthetic=True)
        self.assertTrue(all(c['probability'] > 0.99 for c in result['claims']))
        model['hypothesis_mode'] = 'competing'
        result = predict(model, context, allow_synthetic=True)
        self.assertEqual([x['probability'] for x in result['claims']], [0.5, 0.5])
        with self.assertRaisesRegex(ValidationError, 'unsupported'):
            fit(model, [], 'group')

    def test_invalid_labels_activations_and_unapproved_synthetic_reject(self):
        dataset = copy.deepcopy(BUNDLE['synthetic_training_cases'])
        model = BUNDLE['untrained_model']
        with self.assertRaises(ValidationError):
            fit(model, dataset, 'synthetic_group_C')
        for value in (-0.2, 1.2, float('nan'), True, '0.5'):
            broken = copy.deepcopy(dataset);broken[0]['labels']['demo_hypothesis'] = value
            with self.subTest(label=value), self.assertRaises(ValidationError):
                fit(model, broken, 'synthetic_group_C', allow_synthetic=True)
            context = {'features': {'키워드_X': value}}
            with self.subTest(activation=value), self.assertRaises(ValidationError):
                predict(BUNDLE['synthetic_model'], context, allow_synthetic=True)
        broken = copy.deepcopy(dataset);broken[0]['label_origin'] = 'corpus_frequency'
        with self.assertRaises(ValidationError):
            fit(model, broken, 'synthetic_group_C', allow_synthetic=True)
        broken = copy.deepcopy(dataset);broken[0].pop('label_type')
        with self.assertRaises(ValidationError):
            fit(model, broken, 'synthetic_group_C', allow_synthetic=True)

    def test_group_holdout_is_disjoint_and_holdout_labels_never_fit_parameters(self):
        dataset = copy.deepcopy(BUNDLE['synthetic_training_cases'])
        model = BUNDLE['untrained_model']
        fitted = fit(model, dataset, 'synthetic_group_C', epochs=100, allow_synthetic=True)
        report = fitted['training_report']
        self.assertEqual(report['training_groups'], ['synthetic_group_A', 'synthetic_group_B'])
        self.assertFalse(set(report['training_case_ids']) & set(report['holdout_case_ids']))
        self.assertFalse(report['calibrated'])
        for row in dataset:
            if row['source_group'] == 'synthetic_group_C':
                row['labels']['demo_hypothesis'] = 1 - row['labels']['demo_hypothesis']
        changed = fit(model, dataset, 'synthetic_group_C', epochs=100, allow_synthetic=True)
        self.assertEqual(fitted['claims'], changed['claims'])
        too_few = [x for x in dataset if x['source_group'] != 'synthetic_group_B']
        with self.assertRaises(ValidationError):
            fit(model, too_few, 'synthetic_group_C', allow_synthetic=True)

    def test_soft_label_fit_learns_direction_and_keeps_default_untrained(self):
        model = copy.deepcopy(BUNDLE['untrained_model'])
        trained = fit(model, BUNDLE['synthetic_training_cases'], 'synthetic_group_C', allow_synthetic=True)
        low = predict(trained, BUNDLE['scenarios'][0]['context'], allow_synthetic=True)['claims'][0]['probability']
        high = predict(trained, BUNDLE['scenarios'][1]['context'], allow_synthetic=True)['claims'][0]['probability']
        self.assertGreater(high, low)
        self.assertIsNone(model['claims'][0]['bias'])
        self.assertEqual(trained['parameter_origin'], 'synthetic_illustration')


if __name__ == '__main__':
    unittest.main()
