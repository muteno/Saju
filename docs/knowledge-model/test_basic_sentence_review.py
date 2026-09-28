"""Original nine source-review tests, unchanged and executed on their pinned consumers."""
import subprocess
import hashlib
from pathlib import Path
import unittest
class FrozenBasicSentenceReviewTests(unittest.TestCase):
    def test_original_nine_source_checks(self):
        root = Path(__file__).resolve().parents[2]
        source = root / 'docs/knowledge-model/fixtures/basic-sentences-v1/docs/knowledge-model/test_basic_sentence_review.py'
        self.assertEqual(hashlib.sha256(source.read_bytes().replace(b'\r\n', b'\n')).hexdigest(),
                         'd20db71aa8499b0950d27364e3c61e51f41597a0abe3399a79cc8a32c22d6981')
        result = subprocess.run(['node', 'docs/knowledge-model/frozen_basic_sentence_audit.mjs',
            '--python', '-c', 'import sys,unittest; '
            'suite=unittest.defaultTestLoader.discover("docs/knowledge-model",pattern="test_basic_sentence_review.py"); '
            'result=unittest.TextTestRunner(stream=sys.stdout,verbosity=2).run(suite); '
            'sys.exit(not result.wasSuccessful() or result.testsRun != 9 or bool(result.skipped))'], cwd=root, capture_output=True, text=True, timeout=110)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        # unittest's summary is stderr; the frozen runner must relay it too.
        self.assertIn('Ran 9 tests', result.stdout)
        self.assertIn('OK', result.stdout)
        self.assertNotIn('skipped', result.stdout.lower())
