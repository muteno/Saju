"""Run the F03 reproduction and boundary contracts in the required Python gate."""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


class CalculationAuditTests(unittest.TestCase):
    def run_node(self, *args):
        relative = [str(a.relative_to(ROOT)) if isinstance(a, Path) else str(a) for a in args]
        result = subprocess.run(['node', str(HERE / 'frozen_app_audit.mjs'), *relative], cwd=ROOT,
                                capture_output=True, text=True, timeout=180)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_reproduction_and_preserved_evidence(self):
        self.run_node(HERE / 'measure_calculation_policies.mjs', '--check')

    def test_policy_boundaries_and_mutation_guards(self):
        self.run_node('--test', HERE / 'test_calculation_policies.mjs')


if __name__ == '__main__':
    unittest.main()
