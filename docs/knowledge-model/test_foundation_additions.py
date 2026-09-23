"""F02 acceptance: bounded extension, preserved retrieval, no inferred actors."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unicodedata
import unittest
from unittest.mock import patch

from foundation_additions import CATEGORY, EXPECTED, REPO, REVIEW, validate_and_strip
from foundation_review import TAXONOMY, load_taxonomy, validate as validate_f01, REVIEW as F01_REVIEW


class FoundationAdditionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
        cls.taxonomy = load_taxonomy(REPO / TAXONOMY)
        cls.f01 = json.loads((REPO / F01_REVIEW).read_text(encoding="utf-8"))
        spec = importlib.util.spec_from_file_location("f02_matcher", REPO / "정제/_현황판/build_neuron_map.py")
        cls.matcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.matcher)

    def test_extension_preserves_f01_contract(self):
        result = validate_f01(self.f01)
        self.assertEqual((result["differences"], result["concepts"], result["applied_aliases"],
                          result["evidence_ranges"], result["executable_concepts"]), (76, 271, 4, 176, 277))
        self.assertEqual(result["f02"]["added_concepts"], 6)
        self.assertFalse(result["f02"]["training_labels"])
        self.assertIsNone(result["f02"]["probability"])

    def test_missing_duplicate_or_seventh_decision_fails(self):
        for mode in ("missing", "duplicate", "seventh"):
            review = deepcopy(self.review)
            if mode == "missing":
                review["decisions"].pop()
            elif mode == "duplicate":
                review["decisions"][-1] = deepcopy(review["decisions"][0])
            else:
                review["decisions"].append(deepcopy(review["decisions"][0]))
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                validate_and_strip(review, self.taxonomy)

    def test_new_alias_or_wrong_placement_cannot_escape_f01_fingerprint(self):
        for mode in ("alias", "placement", "seventh", "missing", "move_old"):
            taxonomy = deepcopy(self.taxonomy)
            groups = taxonomy[CATEGORY]
            if mode == "alias":
                groups["십성 공식"]["편인도식"].append("도식")
            elif mode == "placement":
                groups["십성 분류축"]["편인도식"] = groups["십성 공식"].pop("편인도식")
            elif mode == "seventh":
                groups["십성 공식"]["새 공식"] = ["새 공식"]
            elif mode == "missing":
                del groups["십성 공식"]["편인도식"]
            else:
                groups["십성 분류축"]["상관"] = groups["식상"].pop("상관")
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                validate_f01(self.f01, taxonomy=taxonomy)

    def test_manifest_cannot_authorize_broad_alias_even_if_taxonomy_agrees(self):
        review, taxonomy = deepcopy(self.review), deepcopy(self.taxonomy)
        review["decisions"][0]["aliases"].append("도식")
        taxonomy[CATEGORY]["십성 공식"]["편인도식"].append("도식")
        with self.assertRaises(ValueError):
            validate_and_strip(review, taxonomy)

    def test_stale_misquoted_invalid_or_duplicate_evidence_fails(self):
        for key, value in (("sha256", "0" * 64), ("quote", "없는 근거"), ("lines", [False, 1]),
                           ("path", "../../outside.txt")):
            review = deepcopy(self.review)
            review["evidence"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_and_strip(review, self.taxonomy)
        review = deepcopy(self.review)
        review["evidence"].append(deepcopy(review["evidence"][0]))
        with self.assertRaises(ValueError):
            validate_and_strip(review, self.taxonomy)

    def test_claims_require_real_linked_evidence_and_canonical_quote(self):
        for mode in ("empty", "missing", "wrong_alias", "claim_empty"):
            review = deepcopy(self.review)
            row = review["decisions"][0]
            if mode == "empty":
                row["claims"] = []
            elif mode == "missing":
                row["claims"][0]["evidence_ids"] = ["does_not_exist"]
            elif mode == "wrong_alias":
                row["alias_evidence_ids"] = ["ordinary_paein"]
            else:
                row["claims"][0]["evidence_ids"] = []
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                validate_and_strip(review, self.taxonomy)

    def test_inference_probability_and_training_promotion_fail(self):
        for key, value in (("scope", "execute_relations"), ("probability", 0.5),
                           ("apply_relations", True), ("use_as_training_labels", True),
                           ("use_as_training_labels", 0)):
            review = deepcopy(self.review)
            review[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                validate_and_strip(review, self.taxonomy)
        review = deepcopy(self.review)
        review["decisions"][0]["inference_enabled"] = True
        with self.assertRaises(ValueError):
            validate_and_strip(review, self.taxonomy)

    def test_f02_failure_reaches_existing_gate(self):
        review = deepcopy(self.review)
        review["decisions"].pop()
        original = Path.read_text
        def read_text(path, *args, **kwargs):
            if path == REPO / REVIEW:
                return json.dumps(review)
            return original(path, *args, **kwargs)
        with patch.object(Path, "read_text", read_text), self.assertRaises(ValueError):
            validate_f01(self.f01)

    def test_validation_is_pure_and_crlf_safe(self):
        review, taxonomy = deepcopy(self.review), deepcopy(self.taxonomy)
        original = Path.read_bytes
        with patch.object(Path, "read_bytes", lambda p: original(p).replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")):
            stripped, _ = validate_and_strip(review, taxonomy)
        self.assertEqual(review, self.review)
        self.assertEqual(taxonomy, self.taxonomy)
        self.assertEqual(sum(len(cs) for gs in stripped.values() for cs in gs.values()), 271)

    def test_exact_names_preserve_lexical_components_without_inferring_actors(self):
        expected = {name: {name} for name in EXPECTED}
        expected["편인도식"].add("편인")
        expected["상관패인"].add("상관")
        for text, concepts in expected.items():
            with self.subTest(text=text):
                self.assertEqual(self.matcher.concepts_in(text), concepts)
                self.assertEqual(self.matcher.concepts_in(unicodedata.normalize("NFD", text)), concepts)
        self.assertNotIn("편인도식", self.matcher.concepts_in("편인이 식신을 극한다"))

    def test_negation_criticism_and_multiple_mentions_remain_topics(self):
        text = "편인도식이 아니다. 상관패인은 보류한다. 관살혼잡이 적용되기 어렵다. 편인도식."
        self.assertEqual(self.matcher.concepts_in(text) & EXPECTED.keys(), {"편인도식", "상관패인", "관살혼잡"})
        self.assertEqual(self.matcher.concepts_in(" ".join(EXPECTED)) & EXPECTED.keys(), set(EXPECTED))

    def test_held_aliases_and_ordinary_substrings_do_not_enter_topics(self):
        for text in ("도식 탈식 움푹 패인", "상관 폐인", "상관 패인과는",
                     "관살 혼잡 관성혼잡", "재관인식 살상겁효 4길신 4흉신", "도시재생관련 기사", "피부재생관리"):
            with self.subTest(text=text):
                self.assertFalse(self.matcher.concepts_in(text) & EXPECTED.keys())
        self.assertIn("재생관", self.matcher.concepts_in("피부재생관리 뒤에 실제 재생관을 논한다"))

    def test_both_builders_share_suffix_gate_and_preserve_existing_nodes(self):
        spec = importlib.util.spec_from_file_location("f02_cmap", REPO / TAXONOMY)
        cmap = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cmap)
        texts = list(EXPECTED) + ["도시재생관련 기사", "재생관리 뒤 재생관", "관살혼잡이 아니다"]
        rows = [{"q": {"para_id": str(i)}, "post": {}, "text": text} for i, text in enumerate(texts)]
        reader = SimpleNamespace(문단들=lambda **kwargs: iter(rows))
        with patch.dict(sys.modules, {"코퍼스": reader}), patch.object(cmap, "load", return_value=([], [])):
            result, _, count = cmap.build()
        self.assertEqual(count, len(texts))
        for name, group in EXPECTED.items():
            actual = {q["para_id"] for q, _ in result[CATEGORY][group][name]}
            expected = {str(i) for i, text in enumerate(texts) if name in self.matcher.concepts_in(text)}
            self.assertEqual(actual, expected)
        self.assertIn("0", {q["para_id"] for q, _ in result[CATEGORY]["인성"]["편인"]})
        self.assertIn("1", {q["para_id"] for q, _ in result[CATEGORY]["식상"]["상관"]})


if __name__ == "__main__":
    unittest.main()
