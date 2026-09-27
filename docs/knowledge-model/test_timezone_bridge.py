"""Require v2 calendar resolution, preservation and consumer compatibility."""
import json
import subprocess
import unittest

from context_query import ROOT, calculate_context, assess, signature


class TimezoneBridgeTests(unittest.TestCase):
    def test_calendar_inverse_and_canonical_engine(self):
        result = subprocess.run(['node', '--test', str(ROOT / 'test_timezone_resolution.mjs')],
                                capture_output=True, text=True, timeout=180)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_successor_snapshot(self):
        result = subprocess.run(['node', str(ROOT / 'measure_timezone_resolution.mjs'), '--check'],
                                capture_output=True, text=True, timeout=180)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_default_consumer_and_old_model_rejection(self):
        request = json.loads((ROOT / 'data/context_example.json').read_text())
        context = calculate_context(request)
        self.assertEqual(context['resolution_policy'], 'civil-minute-inverse-v2')
        reviews = json.loads((ROOT / 'data/context_reviews.json').read_text())
        result = assess(context, reviews)
        self.assertEqual(result['resolution_policy'], context['resolution_policy'])
        self.assertEqual(result['provenance']['adapter_files'], context['provenance']['adapter_files'])
        old = json.loads(subprocess.check_output(['node', str(ROOT / 'chart_context.mjs'), '-'],
                                                input=json.dumps(request), text=True))
        model = {'feature_policy': context['feature_policy'], 'review_sha256': signature(reviews),
                 'calculator_files': old['provenance']['calculator_files'],
                 'adapter_sha256': old['provenance']['adapter_sha256']}
        with self.assertRaisesRegex(ValueError, 'matching feature policy'):
            assess(context, reviews, model)
        self.assertFalse(result['training_labels_created'])
        self.assertIsNone(result['prediction']['probability'])


if __name__ == '__main__':
    unittest.main()
