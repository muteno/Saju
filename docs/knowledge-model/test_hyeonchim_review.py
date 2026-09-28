"""Run all thirteen original PR206 checks against their preserved source tree."""
import subprocess
import unittest
import hashlib
from pathlib import Path


class HistoricalHyeonchimReviewTests(unittest.TestCase):
    def test_original_thirteen_source_and_marker_regressions(self):
        root = Path(__file__).resolve().parents[2]
        source = root / 'docs/knowledge-model/fixtures/hyeonchim-consumers-v1/docs/knowledge-model/test_hyeonchim_review.py'
        self.assertEqual(hashlib.sha256(source.read_bytes().replace(b'\r\n', b'\n')).hexdigest(),
                         '734385e0390d5434f1f84a45b4b437de63aeb75a668d2d9fa624eecf759f0380')
        result = subprocess.run([
            'node', 'docs/knowledge-model/frozen_hyeonchim_audit.mjs', '--python',
            '-c', 'import sys,unittest; suite=unittest.defaultTestLoader.discover("docs/knowledge-model",pattern="test_hyeonchim_review.py"); '
            'result=unittest.TextTestRunner(stream=sys.stdout,verbosity=2).run(suite); '
            'sys.exit(not result.wasSuccessful() or result.testsRun != 13 or bool(result.skipped))',
        ], cwd=root, capture_output=True, text=True, timeout=110)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Ran 13 tests', result.stdout)
        self.assertNotIn('skipped', result.stdout)
