"""Prevent scope loss, unknown-as-absence and unearned predictions at the L1 bridge."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

from context_query import POLICY, assess, evaluate_expression, signature, validate_reviews

ROOT = Path(__file__).resolve().parent


class ContextQueryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviews = json.loads((ROOT / "data/context_reviews.json").read_text(encoding="utf-8"))
        cls.legacy = json.loads((ROOT / "data/legacy_review.json").read_text(encoding="utf-8"))
        run = subprocess.run(["node", str(ROOT / "chart_context.mjs"), str(ROOT / "data/context_example.json")],
                             capture_output=True, text=True, check=True)
        cls.context = json.loads(run.stdout)

    def results(self, **features):
        context = copy.deepcopy(self.context)
        context["features"].update(features)
        return {r["id"]: r for r in assess(context, self.reviews)["conditions"]}

    def model(self):
        return {"feature_policy": POLICY, "review_sha256": signature(self.reviews),
                **{k: self.context["provenance"][k] for k in ("calculator_files", "adapter_sha256")},
                "hypothesis_mode": "nonexclusive", "parameter_origin": "untrained",
                "claims": [{"id": "untrained_test_target", "bias": None,
                            "required_features": ["condition.wealth_surface_absence", "natal.stem.丙.fraction"],
                            "feature_weights": {"condition.wealth_surface_absence": None,
                                                "natal.stem.丙.fraction": None}, "interactions": []}]}

    def test_checked_in_reviews_match_literal_sources_and_current_concepts(self):
        validate_reviews(self.reviews, self.legacy)
        graph = json.loads((ROOT / "knowledge_graph.json").read_text(encoding="utf-8"))
        concept_ids = {n["id"] for n in graph["nodes"]}
        for review in self.reviews["reviews"]:
            self.assertTrue(set(review["concept_ids"]) <= concept_ids)
            self.assertEqual(review["reviewer_kind"], "implementation_source_reading_not_expert_validation")

    def test_three_valued_truth_tables_preserve_decisive_observations(self):
        # Rows/columns: absent, present, unknown. No missing value is coerced to zero.
        expected_all = [[0, 0, 0], [0, 1, None], [0, None, None]]
        expected_any = [[0, 1, None], [1, 1, 1], [None, 1, None]]
        for i, a in enumerate([0, 1, None]):
            for j, b in enumerate([0, 1, None]):
                for operator, expected in [("all", expected_all), ("any", expected_any)]:
                    with self.subTest(a=a, b=b, operator=operator):
                        result = evaluate_expression({operator: [{"feature": "a"}, {"feature": "b"}]}, {"a": a, "b": b})
                        self.assertEqual(result["value"], expected[i][j])
        self.assertIsNone(evaluate_expression({"not": {"feature": "missing"}}, {})["value"])

    def test_exact_conditions_do_not_treat_fractional_measurements_as_boolean(self):
        for value in (0.5, True, "1", float("nan")):
            with self.subTest(value=value), self.assertRaises(ValueError):
                evaluate_expression({"feature": "degree"}, {"degree": value})
        for expression in ({"all": []}, {"any": []}, {"unsupported": 1}, {"feature": "x", "not": {}}):
            with self.subTest(expression=expression), self.assertRaises(ValueError):
                evaluate_expression(expression, {})

    def test_actual_chart_distinguishes_visible_and_hidden_wealth(self):
        result = self.results()
        self.assertEqual(result["wealth_surface_absence"]["status"], "matched")
        self.assertEqual(result["wealth_surface_and_hidden_absence"]["status"], "not_matched")
        self.assertIn("natal.hidden_role.wealth.present", json.dumps(result["wealth_surface_and_hidden_absence"]["trace"]))

    def test_hidden_absence_requires_restored_surface_antecedent(self):
        for role, condition in [("wealth", "wealth_surface_and_hidden_absence"),
                                ("authority", "authority_surface_and_hidden_absence")]:
            for surface, expected in [(1, "not_matched"), (None, "needs_context"), (0, "matched")]:
                with self.subTest(role=role, surface=surface):
                    result = self.results(**{f"natal.surface_role.{role}.present": surface,
                                             f"natal.hidden_role.{role}.present": 0})
                    self.assertEqual(result[condition]["status"], expected)

    def test_eul_wood_fire_clause_retains_day_master_and_season_scope(self):
        features = {"natal.day.stem.乙": 1, "natal.month.branch.申": 0, "natal.month.branch.酉": 0,
                    "natal.day.branch.酉": 0, "natal.stem.丙.present": 1, "natal.stem.丁.present": 0}
        condition = "eul_wood_fire_context"
        self.assertEqual(self.results(**features)[condition]["status"], "not_matched")
        features["natal.month.branch.申"] = 1
        self.assertEqual(self.results(**features)[condition]["status"], "matched")
        features["natal.day.stem.乙"] = 0
        self.assertEqual(self.results(**features)[condition]["status"], "not_matched")

    def test_inhae_clause_is_scoped_to_pair_and_heavenly_stem_fire(self):
        features = {"natal.branch.寅.present": 1, "natal.branch.亥.present": 1,
                    "natal.stem_element.화.present": 0, "natal.surface_element.화.present": 1}
        condition = "inhae_without_stem_fire"
        self.assertEqual(self.results(**features)[condition]["status"], "matched")
        features["natal.branch.亥.present"] = 0
        self.assertEqual(self.results(**features)[condition]["status"], "not_matched")

    def test_missing_daewoon_remains_unknown_and_never_creates_labels(self):
        result = assess(self.context, self.reviews)
        conditions = {r["id"]: r for r in result["conditions"]}
        self.assertEqual(conditions["daewoon_centered_samhap_completion"]["status"], "needs_context")
        self.assertFalse(result["training_labels_created"])
        self.assertIsNone(result["prediction"]["probability"])
        for condition in result["conditions"]:
            self.assertFalse(condition["prediction_enabled"])
            self.assertIsNone(condition["probability"])
        self.assertEqual(result["provenance"]["review_sha256"], signature(self.reviews))

    def test_stale_candidate_or_changed_source_quote_is_rejected(self):
        changed = copy.deepcopy(self.reviews)
        candidate_id = next(iter(changed["reviews"][0]["candidate_signatures"]))
        changed["reviews"][0]["candidate_signatures"][candidate_id] = "stale"
        with self.assertRaisesRegex(ValueError, "changed legacy candidate"):
            validate_reviews(changed, self.legacy)
        changed = copy.deepcopy(self.reviews)
        changed["reviews"][0]["source_context"][0]["quote"] += " invented addition"
        with self.assertRaisesRegex(ValueError, "source context has changed"):
            validate_reviews(changed, self.legacy)

    def test_review_flags_cannot_promote_antecedents_to_predictions_or_labels(self):
        changed = copy.deepcopy(self.reviews)
        changed["reviews"][0]["prediction_enabled"] = True
        with self.assertRaisesRegex(ValueError, "personal predictions"):
            validate_reviews(changed, self.legacy)
        changed = copy.deepcopy(self.reviews)
        changed["use_as_training_labels"] = True
        with self.assertRaisesRegex(ValueError, "review policy"):
            validate_reviews(changed, self.legacy)

    def test_model_rejects_stale_measurement_or_review_definitions(self):
        for field in ("feature_policy", "calculator_files", "adapter_sha256", "review_sha256"):
            with self.subTest(field=field):
                model = self.model()
                model[field] = "stale"
                with self.assertRaisesRegex(ValueError, "matching"):
                    assess(self.context, self.reviews, model)
        changed = copy.deepcopy(self.reviews)
        changed["reviews"][0]["expression"] = {"feature": "natal.day.stem.甲"}
        with self.assertRaisesRegex(ValueError, "matching"):
            assess(self.context, changed, self.model())

    def test_untrained_and_synthetic_models_do_not_emit_numeric_predictions(self):
        result = assess(self.context, self.reviews, self.model())
        self.assertEqual(result["model_input"]["features"]["natal.stem.丙.fraction"], 0.5)
        self.assertEqual(result["model_input"]["features"]["condition.wealth_surface_absence"], 1)
        self.assertEqual(result["prediction"]["claims"][0]["status"], "needs_training")
        self.assertIsNone(result["prediction"]["claims"][0]["probability"])
        model = self.model()
        model["parameter_origin"] = "synthetic_illustration"
        model["claims"][0]["bias"] = 0
        model["claims"][0]["feature_weights"] = {f: 1 for f in model["claims"][0]["required_features"]}
        result = assess(self.context, self.reviews, model)
        self.assertEqual(result["prediction"]["claims"][0]["status"], "synthetic_excluded")
        self.assertIsNone(result["prediction"]["claims"][0]["probability"])

    def test_misspelled_feature_is_not_silently_accepted_as_missing_input(self):
        changed = copy.deepcopy(self.reviews)
        changed["reviews"][0]["expression"] = {"feature": "natal.stem.typo.present"}
        with self.assertRaisesRegex(ValueError, "outside the observation policy"):
            assess(self.context, changed)

    def test_cli_returns_only_directly_bound_conditions_for_concept(self):
        run = subprocess.run([sys.executable, str(ROOT / "context_query.py"), "--input",
                              str(ROOT / "data/context_example.json"), "--term", "재성"],
                             capture_output=True, text=True, check=True)
        result = json.loads(run.stdout)
        self.assertEqual({r["id"] for r in result["knowledge"]["context_assessment"]},
                         {"wealth_surface_absence", "wealth_surface_and_hidden_absence"})
        self.assertFalse(result["training_labels_created"])


if __name__ == "__main__":
    unittest.main()
