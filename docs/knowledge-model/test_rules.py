"""Meaningful structural checks; these do not validate real-world fortune claims."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from rules_engine import ValidationError, analyze_chart, element_relation, ten_god


BASE = {
    "stems": [
        {"id": "Y", "gan": "병", "position": "year"},
        {"id": "M", "gan": "무", "position": "month"},
        {"id": "D", "gan": "갑", "position": "day"},
        {"id": "H", "gan": "임", "position": "hour"},
    ],
    "hour_unknown": False,
}

# Explicit oracle table; no import of the engine's mapping/cycles to derive answers.
STEM_ORDER = "갑을병정무기경신임계"
ORACLE = [
    "비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인",
    "겁재 비견 상관 식신 정재 편재 정관 편관 정인 편인",
    "편인 정인 비견 겁재 식신 상관 편재 정재 편관 정관",
    "정인 편인 겁재 비견 상관 식신 정재 편재 정관 편관",
    "편관 정관 편인 정인 비견 겁재 식신 상관 편재 정재",
    "정관 편관 정인 편인 겁재 비견 상관 식신 정재 편재",
    "편재 정재 편관 정관 편인 정인 비견 겁재 식신 상관",
    "정재 편재 정관 편관 정인 편인 겁재 비견 상관 식신",
    "식신 상관 편재 정재 편관 정관 편인 정인 비견 겁재",
    "상관 식신 정재 편재 정관 편관 정인 편인 겁재 비견",
]


class StructuralRulesTests(unittest.TestCase):
    def chart(self):
        return copy.deepcopy(BASE)

    def test_all_100_stem_pairs_against_explicit_oracle(self):
        checked = 0
        for daymaster, row in zip(STEM_ORDER, ORACLE):
            for target, expected in zip(STEM_ORDER, row.split()):
                with self.subTest(daymaster=daymaster, target=target):
                    self.assertEqual(ten_god(daymaster, target)["ten_god"], expected)
                    checked += 1
        self.assertEqual(checked, 100)

    def test_directed_cycles_do_not_reverse_generating_and_controlling(self):
        expected = {("목", "목"): "same", ("목", "화"): "generates",
                    ("화", "목"): "generated_by", ("목", "토"): "controls",
                    ("토", "목"): "controlled_by"}
        for pair, relation in expected.items():
            with self.subTest(pair=pair):
                self.assertEqual(element_relation(*pair), relation)

    def test_hanja_normalizes_without_changing_classification(self):
        self.assertEqual(ten_god("甲", "丁"), ten_god("갑", "정"))

    def test_trace_explains_structure_polarity_and_rule(self):
        result = ten_god("갑", "정")
        trace = result["trace"]
        self.assertEqual([item["step"] for item in trace],
                         ["stem_properties", "element_relation", "polarity", "ten_god"])
        self.assertEqual(trace[1]["relation"], "generates")
        self.assertEqual(trace[2]["relation"], "opposite")
        self.assertEqual(trace[3]["value"], "상관")
        self.assertTrue(trace[3]["source_ref"])

    def test_daymaster_is_never_counted_as_an_extra_peer(self):
        result = analyze_chart(self.chart())
        self.assertEqual(sum(result["ten_god_counts"].values()), 3)
        self.assertNotIn("비견", result["ten_god_counts"])
        self.assertEqual(result["exclusions"], [{"id": "D", "reason": "daymaster_is_reference_not_additional_peer"}])
        chart = self.chart()
        chart["stems"][0]["gan"] = "갑"
        self.assertEqual(analyze_chart(chart)["ten_god_counts"]["비견"], 1)

    def test_unknown_hour_excludes_a_supplied_guess_from_pattern(self):
        chart = self.chart()
        chart["stems"][1]["gan"] = "경"
        chart["stems"][3]["gan"] = "무"
        self.assertTrue(analyze_chart(chart)["pattern_checks"][0]["structural_candidate"])
        chart["hour_unknown"] = True
        result = analyze_chart(chart)
        self.assertFalse(result["pattern_checks"][0]["structural_candidate"])
        self.assertNotIn("H", [item["id"] for item in result["observations"]])
        self.assertIn({"id": "H", "reason": "hour_unknown"}, result["exclusions"])

    def test_unknown_hour_can_be_omitted_but_still_has_trace(self):
        chart = self.chart()
        chart["hour_unknown"] = True
        chart["stems"].pop()
        result = analyze_chart(chart)
        self.assertEqual(len(result["observations"]), 2)
        self.assertIn({"position": "hour", "reason": "hour_unknown_not_supplied"}, result["exclusions"])
        check = result["pattern_checks"][0]
        self.assertEqual(check["status"], "needs_review")
        self.assertIn("hour", [item["id"] for item in check["interpretation"]["missing_checks"]])

    def test_candidate_has_actual_directed_path_but_interpretation_is_blocked(self):
        check = analyze_chart(self.chart())["pattern_checks"][0]
        self.assertEqual(check["status"], "needs_review")
        self.assertEqual(check["paths"][0]["node_ids"], ["D", "Y", "M"])
        self.assertEqual([edge["relation"] for edge in check["paths"][0]["edges"]], ["generates", "generates"])
        self.assertEqual(check["interpretation"]["status"], "blocked")
        missing = {item["id"] for item in check["interpretation"]["missing_checks"]}
        self.assertTrue({"strength", "season", "root", "interactions"} <= missing)
        self.assertFalse(check["absence_is_chart_wide_conclusion"])

    def test_multiple_wealth_stems_have_separate_paths(self):
        chart = self.chart()
        chart["stems"][3]["gan"] = "기"
        paths = analyze_chart(chart)["pattern_checks"][0]["paths"]
        self.assertEqual([item["node_ids"] for item in paths], [["D", "Y", "M"], ["D", "Y", "H"]])
        self.assertEqual([item["edges"][1]["target_ten_god_relative_to_daymaster"] for item in paths], ["편재", "정재"])

    def test_sanggwan_cooccurrence_does_not_become_siksin_saengjae(self):
        chart = self.chart()
        chart["stems"][0]["gan"] = "정"
        check = analyze_chart(chart)["pattern_checks"][0]
        self.assertEqual(check["status"], "not_observed")
        self.assertEqual(check["missing_observed_roles"], ["식신"])
        self.assertEqual(check["paths"], [])

    def test_missing_wealth_is_explicit_and_not_a_negative_life_prediction(self):
        chart = self.chart()
        chart["stems"][1]["gan"] = "경"
        check = analyze_chart(chart)["pattern_checks"][0]
        self.assertEqual(check["status"], "not_observed")
        self.assertEqual(check["missing_observed_roles"], ["재성(편재 또는 정재)"])
        self.assertEqual(check["interpretation"]["status"], "blocked")

    def test_missing_known_positions_is_validation_error(self):
        for index in range(4):
            with self.subTest(index=index):
                chart = self.chart()
                chart["stems"].pop(index)
                with self.assertRaises(ValidationError):
                    analyze_chart(chart)

    def test_duplicate_id_or_position_is_validation_error(self):
        for field in ("id", "position"):
            with self.subTest(field=field):
                chart = self.chart()
                chart["stems"][1][field] = chart["stems"][0][field]
                with self.assertRaises(ValidationError):
                    analyze_chart(chart)

    def test_invalid_values_and_shapes_never_fabricate_defaults(self):
        invalid_charts = [None, [], {}, {"stems": [], "hour_unknown": "false"},
                          {"stems": {}, "hour_unknown": False}]
        for field, value in [("gan", "자"), ("gan", None), ("gan", []),
                             ("position", "minute"), ("position", []),
                             ("id", ""), ("id", " Y ")]:
            chart = self.chart()
            chart["stems"][0][field] = value
            invalid_charts.append(chart)
        extra = self.chart()
        extra["unrecognized_rule_override"] = True
        invalid_charts.append(extra)
        for chart in invalid_charts:
            with self.subTest(chart=chart), self.assertRaises(ValidationError):
                analyze_chart(chart)
        with self.assertRaises(ValidationError):
            element_relation([], "목")

    def test_cli_returns_machine_readable_validation_error(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "invalid.json"
            path.write_text('{"stems": [], "hour_unknown": false}', encoding="utf-8")
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("rules_engine.py")),
                                     "--input", str(path)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["status"], "validation_error")

    def test_examples_are_valid_and_do_not_mutate_input(self):
        examples = json.loads(Path(__file__).with_name("examples.json").read_text(encoding="utf-8"))
        before = copy.deepcopy(examples)
        for name, chart in examples.items():
            with self.subTest(example=name):
                result = analyze_chart(chart)
                self.assertEqual(result["schema_version"], "1.0-pilot")
        self.assertEqual(examples, before)


if __name__ == "__main__":
    unittest.main()
