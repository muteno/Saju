from copy import deepcopy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import month_period_claim_guard as guard


class MonthPeriodClaimGuardTests(unittest.TestCase):
    def test_current_claims_and_historical_measurement(self):
        self.assertEqual(guard.check()['comparison_rows'], 312)
        self.assertEqual(len(guard.load_review()['claims']), 11)

    def test_cross_profile_exchange_that_old_validator_accepts_is_rejected(self):
        r = guard.load_review()
        by_id = {c['id']: c for c in r['claims']}
        a, b = by_id['board_scope'], by_id['solstice_asr']
        a['evidence_ids'], b['evidence_ids'] = b['evidence_ids'], a['evidence_ids']
        guard.historical.validate(r)  # Reproduce PR205's post-merge finding.
        with self.assertRaisesRegex(ValueError, 'provenance changed'):
            guard.validate(r)

    def test_same_author_unrelated_claim_and_unknown_identity_rejected(self):
        r = guard.load_review()
        by_id = {c['id']: c for c in r['claims']}
        a, b = by_id['sagong_example'], by_id['sagong_terms']
        a['evidence_ids'], b['evidence_ids'] = b['evidence_ids'], a['evidence_ids']
        guard.historical.validate(r)
        with self.assertRaisesRegex(ValueError, 'provenance changed'):
            guard.validate(r)
        r = guard.load_review()
        r['claims'][0]['id'] = 'unreviewed_claim'
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            guard.validate(r)

    def test_profile_tamper_rejected(self):
        r = guard.load_review()
        next(e for e in r['evidence'] if e['id'] == 'month_board_scope')['source_profile'] = 'sagong'
        with self.assertRaises(ValueError):
            guard.validate(r)

    def test_source_payload_exchange_rejected_in_validation_and_comparison(self):
        r = guard.load_review()
        evidence = {e['id']: e for e in r['evidence']}
        a, b = evidence['month_board_scope'], evidence['month_mixed_solstice']
        for key in ('path', 'lines', 'quote', 'sha256'):
            a[key], b[key] = b[key], a[key]
        guard.historical.validate(r)  # IDs/profiles alone cannot authenticate source payloads.
        with self.assertRaisesRegex(ValueError, 'source payload changed'):
            guard.validate(r)
        with self.assertRaisesRegex(ValueError, 'source payload changed'):
            guard.compare_offset(r, '午', '19.5')

    def test_every_previous_comparison_keeps_values_and_withholding(self):
        r = guard.load_review()
        original = deepcopy(r)
        for b in guard.historical.BRANCHES:
            for x in (0, 7, 10, 19, 19.5, 20, 30):
                self.assertEqual(guard.compare_offset(r, b, x), guard.historical.compare_offset(r, b, x))
        self.assertEqual(r, original)

    def test_default_cli_encoding_and_no_historical_overwrite_option(self):
        command = [sys.executable, str(Path(guard.__file__).resolve())]
        result = subprocess.run(command + ['--check'], cwd=tempfile.gettempdir(),
                                env={**os.environ, 'PYTHONIOENCODING': 'cp1252'},
                                capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['claims'], 11)
        result = subprocess.run(command + ['--write-measurement'], capture_output=True, timeout=60)
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
