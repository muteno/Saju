"""Synthetic algebra and provenance regression tests, never Saju labels."""
import copy
import json
import subprocess
import sys
import unittest
from unittest.mock import patch

from case_review import prepare, validate_split
from compare_models import compare
from context_query import ROOT, calculate_context, signature

F = "natal.stem.丙.present"
G = "natal.month.branch.申"


class CaseReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pilot = json.loads((ROOT / "data/case_review_pilot.json").read_text(encoding="utf-8"))
        cls.reviews = json.loads((ROOT / "data/context_reviews.json").read_text(encoding="utf-8"))
        cls.base_context = calculate_context(cls.pilot["cases"][0]["request"])

    def signed(self, at="2020-12-30T00:00:00Z"):
        return {"status": "reviewed", "reviewer_id": "synthetic_test_fixture",
                "reviewed_at": at, "rationale": "Synthetic pipeline assertion, not an expert annotation."}

    def bundle(self):
        result = copy.deepcopy(self.pilot)
        target = result["spec"]["targets"][0]
        target.update(hypothesis="Synthetic XOR algebra; no interpretation of a person or Saju claim.",
                      label_type="binary", base_features=[F, G], review=self.signed("2018-01-01T00:00:00Z"),
                      interactions=[{"id": "synthetic_product", "when": {F: "present", G: "present"},
                                     "source_review_ids": target["source_review_ids"]}])
        result["cases"] = []
        for group in range(3):
            for position in range(4):
                i = group*4 + position
                reference = "synthetic-record:" + str(i)
                result["cases"].append({
                    "case_id": "case"+str(i), "case_origin": "synthetic",
                    "request": {"birth": {"year": 1980, "month": 1, "day": i+1, "hour": 12, "minute": 0, "gender": "F"},
                                "evaluated_at": str([2019, 2020, 2022][group])+"-01-01T00:00:00Z"},
                    "provenance": {"source_group": "source"+str(group), "subject_group": "subject"+str(i),
                                   "dependency_groups": ["source-root"+str(group)], "review": self.signed("2018-01-01T00:00:00Z"),
                                   "input_evidence": [{"reference": reference, "sha256": signature(reference), "available_at": "2018-01-01T00:00:00Z"}]},
                    "labels": {target["id"]: {**self.signed("2022-02-01T00:00:00Z" if group == 2 else "2020-12-30T00:00:00Z"),
                                               "value": int(position in (1, 2)), "label_origin": "synthetic",
                                               "evidence_refs": [reference, "source-review:"+target["source_review_ids"][0]]}}})
        result["split"] = {"protocol": "source_subject_holdout", "train_case_ids": ["case"+str(i) for i in range(8)],
                           "holdout_case_ids": ["case"+str(i) for i in range(8, 12)]}
        return result

    def context(self, request):
        # Only used under explicitly synthetic test mode; CLI always runs the real calculator.
        result = copy.deepcopy(self.base_context)
        position = (request["birth"]["day"] - 1) % 4
        result["features"][F] = position // 2
        result["features"][G] = position % 2
        result["evaluated_at"] = request["evaluated_at"]
        result["provenance"]["request_sha256"] = signature(request)
        return result

    def run_prepare(self, bundle, allow=True):
        with patch("case_review.calculate_context", side_effect=self.context):
            return prepare(bundle, self.reviews, allow_synthetic=allow)

    def run_compare(self, bundle):
        with patch("case_review.calculate_context", side_effect=self.context):
            return compare(bundle, self.reviews, allow_synthetic=True, epochs=1500, learning_rate=0.5)

    def test_pilot_cli_stays_unlabelled_despite_known_condition_matches(self):
        run = subprocess.run([sys.executable, str(ROOT / "case_review.py"), "--compare"], capture_output=True, text=True, check=True)
        result = json.loads(run.stdout)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["audit"]["case_count"], 6)
        self.assertEqual(result["audit"]["eligible_count"], 0)
        self.assertFalse(result["audit"]["labels_created"])
        self.assertIsNone(result["models"])
        cases = {c["case_id"]: c for c in result["audit"]["cases"]}
        fire = {c["id"]: c["status"] for c in cases["eul_fire_fixture"]["condition_audit"]}
        no_fire = {c["id"]: c["status"] for c in cases["eul_no_stem_fire_fixture"]["condition_audit"]}
        self.assertEqual(fire["eul_wood_fire_context"], "matched")
        self.assertEqual(no_fire["eul_wood_fire_context"], "not_matched")

    def test_synthetic_opt_in_does_not_make_calculator_fixtures_trainable(self):
        bundle = self.bundle()
        audit, rows = self.run_prepare(bundle, allow=False)
        self.assertEqual(len(rows), 0)
        self.assertEqual(audit["exclusion_counts"]["synthetic_requires_explicit_opt_in"], 12)
        bundle["cases"][0]["case_origin"] = "calculator_fixture"
        next(iter(bundle["cases"][0]["labels"].values()))["label_origin"] = "expert"
        audit, rows = self.run_prepare(bundle)
        self.assertNotIn("case0", {r["case_id"] for r in rows})
        self.assertIn("calculator_fixture_not_training_data", audit["cases"][0]["exclusion_reasons"])

    def test_pending_unknown_disputed_and_pseudo_labels_are_excluded(self):
        for status in ("pending", "unknown", "disputed"):
            bundle = self.bundle()
            label = next(iter(bundle["cases"][0]["labels"].values()))
            label.update(status=status, value=None)
            audit, rows = self.run_prepare(bundle)
            self.assertEqual(len(rows), 11)
            self.assertTrue(any(x.startswith("label_"+status) for x in audit["cases"][0]["exclusion_reasons"]))
            label["value"] = 0
            with self.assertRaisesRegex(ValueError, "must keep value null"):
                self.run_prepare(bundle)
        bundle = self.bundle()
        next(iter(bundle["cases"][0]["labels"].values()))["label_origin"] = "condition_output"
        self.assertEqual(len(self.run_prepare(bundle)[1]), 11)

    def test_review_signatures_and_evidence_refs_are_required(self):
        for field, value in [("rationale", ""), ("reviewer_id", None), ("evidence_refs", ["invented-reference"])]:
            bundle = self.bundle()
            next(iter(bundle["cases"][0]["labels"].values()))[field] = value
            self.assertEqual(len(self.run_prepare(bundle)[1]), 11)
        bundle = self.bundle()
        bundle["spec"]["targets"][0]["review"]["status"] = "pending"
        self.assertEqual(self.run_compare(bundle)["status"], "blocked")

    def test_unknown_observation_is_not_filled_with_zero(self):
        bundle = self.bundle()
        def missing(request):
            result = self.context(request)
            if request["birth"]["day"] == 1:
                result["features"][F] = None
            return result
        with patch("case_review.calculate_context", side_effect=missing):
            audit, rows = prepare(bundle, self.reviews, allow_synthetic=True)
        self.assertEqual(len(rows), 11)
        self.assertIsNone(audit["cases"][0]["features"][F])
        self.assertIn("unknown_required_observations", audit["cases"][0]["exclusion_reasons"])

    def test_target_type_versions_and_composite_feature_leakage_are_rejected(self):
        for field, value in [("target_kind", "empirical_outcome"), ("feature_policy", "old"), ("review_sha256", "old")]:
            bundle = self.bundle()
            bundle["spec"][field] = value
            with self.assertRaises(ValueError):
                self.run_prepare(bundle)
        for feature in ("condition.eul_wood_fire_context", "time.yearly.completes_centered_samhap"):
            bundle = self.bundle()
            bundle["spec"]["targets"][0]["base_features"].append(feature)
            with self.assertRaisesRegex(ValueError, "raw observation"):
                self.run_prepare(bundle)
        bundle = self.bundle()
        bundle["cases"][0]["features"] = {F: 1}
        with self.assertRaisesRegex(ValueError, "recomputed"):
            self.run_prepare(bundle)

    def test_source_subject_dependency_and_file_overlap_each_block_holdout(self):
        for kind in ("source_group", "subject_group", "dependency_groups", "input_evidence"):
            with self.subTest(kind=kind):
                bundle = self.bundle()
                if kind == "input_evidence":
                    bundle["cases"][8]["provenance"][kind][0]["sha256"] = bundle["cases"][0]["provenance"][kind][0]["sha256"]
                else:
                    bundle["cases"][8]["provenance"][kind] = copy.deepcopy(bundle["cases"][0]["provenance"][kind])
                audit, rows = self.run_prepare(bundle)
                with self.assertRaisesRegex(ValueError, "share a source"):
                    validate_split(bundle, audit, rows)

    def test_excluded_case_still_connects_transitive_source_dependencies(self):
        bundle = self.bundle()
        bridge = copy.deepcopy(bundle["cases"][0])
        bridge.update(case_id="excluded_bridge", case_origin="calculator_fixture")
        bridge["request"]["birth"]["day"] = 13
        bridge["provenance"].update(source_group="bridge", subject_group="bridge",
                                    dependency_groups=["source-root0", "source-root2"])
        bridge["provenance"]["input_evidence"] = []
        bundle["cases"].append(bridge)
        audit, rows = self.run_prepare(bundle)
        self.assertEqual(len(rows), 12)
        with self.assertRaisesRegex(ValueError, "share a source"):
            validate_split(bundle, audit, rows)

    def test_two_training_names_cannot_disguise_a_single_dependency_family(self):
        bundle = self.bundle()
        bundle["cases"][4]["provenance"]["dependency_groups"].append("source-root0")
        audit, rows = self.run_prepare(bundle)
        with self.assertRaisesRegex(ValueError, "fewer than two dependency components"):
            validate_split(bundle, audit, rows)

    def test_copied_input_normalizes_defaults_key_order_and_utc_offset(self):
        bundle = self.bundle()
        q = copy.deepcopy(bundle["cases"][0]["request"])
        q["birth"].update(timeZone="Asia/Seoul", longitude=126.978, solarTimeCorrection=True, lateZiRule="midnight23")
        q["evaluated_at"] = "2019-01-01T09:00:00+09:00"
        bundle["cases"][8]["request"] = q
        audit, rows = self.run_prepare(bundle)
        with self.assertRaisesRegex(ValueError, "copied input"):
            validate_split(bundle, audit, rows)

    def test_future_evidence_and_label_before_evidence_are_excluded(self):
        bundle = self.bundle()
        bundle["cases"][0]["provenance"]["input_evidence"][0]["available_at"] = "2021-01-01T00:00:00Z"
        audit, _ = self.run_prepare(bundle)
        reasons = audit["cases"][0]["exclusion_reasons"]
        self.assertIn("future_input_evidence", reasons)
        self.assertTrue(any(x.startswith("label_predates_input_evidence") for x in reasons))
        bundle["cases"][0]["provenance"]["input_evidence"][0]["available_at"] = "2018-01-01T00:00:00"
        with self.assertRaisesRegex(ValueError, "UTC offset"):
            self.run_prepare(bundle)

    def test_forward_split_checks_training_label_and_target_availability(self):
        bundle = self.bundle()
        bundle["split"].update(protocol="source_subject_forward", train_until="2021-01-01T00:00:00Z")
        audit, rows = self.run_prepare(bundle)
        self.assertTrue(validate_split(bundle, audit, rows)["forward_time_constraints_checked"])
        next(iter(bundle["cases"][0]["labels"].values()))["reviewed_at"] = "2022-01-01T00:00:00Z"
        audit, rows = self.run_prepare(bundle)
        with self.assertRaisesRegex(ValueError, "training cutoff"):
            validate_split(bundle, audit, rows)
        bundle = self.bundle()
        bundle["split"].update(protocol="source_subject_forward", train_until="2021-01-01T00:00:00Z")
        bundle["spec"]["targets"][0]["review"]["reviewed_at"] = "2022-01-01T00:00:00Z"
        audit, rows = self.run_prepare(bundle)
        with self.assertRaisesRegex(ValueError, "Target definition"):
            validate_split(bundle, audit, rows)

    def test_split_cannot_reuse_overlap_omit_eligible_or_include_excluded_cases(self):
        for mutation in ("overlap", "omit", "duplicate", "unknown"):
            bundle = self.bundle()
            if mutation == "overlap": bundle["split"]["holdout_case_ids"].append("case0")
            if mutation == "omit": bundle["split"]["train_case_ids"].remove("case0")
            if mutation == "duplicate": bundle["split"]["train_case_ids"].append("case0")
            if mutation == "unknown": bundle["split"]["train_case_ids"].append("missing")
            audit, rows = self.run_prepare(bundle)
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_split(bundle, audit, rows)

    def test_comparison_uses_same_cases_and_demonstrates_only_synthetic_interaction(self):
        result = self.run_compare(self.bundle())
        self.assertEqual(result["status"], "synthetic_comparison")
        self.assertIsNone(result["empirical_outcome_accuracy"])
        self.assertIsNone(result["automatic_winner"])
        self.assertFalse(result["calibrated"])
        a, b = result["models"]["additive"], result["models"]["with_interactions"]
        self.assertEqual(a["training_report"]["training_case_ids"], b["training_report"]["training_case_ids"])
        self.assertEqual(a["claims"][0]["required_features"], b["claims"][0]["required_features"])
        self.assertEqual(a["claims"][0]["interactions"], [])
        target_id = a["claims"][0]["id"]
        self.assertGreater(result["bce_reduction_with_interactions"][target_id], 0.1)
        self.assertFalse(result["audit"]["expert_identity_and_source_independence_verified"])

    def test_held_out_labels_never_change_fitted_parameters(self):
        bundle = self.bundle()
        before = self.run_compare(bundle)
        for case in bundle["cases"][8:]:
            label = next(iter(case["labels"].values()))
            label["value"] = 1-label["value"]
        after = self.run_compare(bundle)
        for name in ("additive", "with_interactions"):
            self.assertEqual(before["models"][name]["claims"], after["models"][name]["claims"])
        self.assertNotEqual(before["holdout"]["with_interactions"], after["holdout"]["with_interactions"])

    def test_soft_degree_supported_but_unknown_and_bool_are_not_numeric_labels(self):
        bundle = self.bundle()
        label = next(iter(bundle["cases"][0]["labels"].values()))
        label["value"] = 0.3
        with self.assertRaisesRegex(ValueError, "binary/soft"):
            self.run_prepare(bundle)
        bundle["spec"]["targets"][0]["label_type"] = "soft"
        self.assertEqual(len(self.run_prepare(bundle)[1]), 12)
        label["value"] = True
        with self.assertRaisesRegex(ValueError, "binary/soft"):
            self.run_prepare(bundle)

    def test_malformed_records_and_huge_labels_fail_validation(self):
        for field in ("provenance", "labels"):
            bundle = self.bundle()
            bundle["cases"][0][field] = None
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_prepare(bundle)
        bundle = self.bundle()
        next(iter(bundle["cases"][0]["labels"].values()))["value"] = 10**1000
        with self.assertRaisesRegex(ValueError, "binary/soft"):
            self.run_prepare(bundle)


if __name__ == "__main__":
    unittest.main()
