"""F01 acceptance: review coverage, literal evidence, limited alias application."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from foundation_review import REPO, REVIEW, TAXONOMY, load_taxonomy, validate


class FoundationReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
        cls.taxonomy = load_taxonomy(REPO / TAXONOMY)
        spec = importlib.util.spec_from_file_location("f01_matcher", REPO / "정제/_현황판/build_neuron_map.py")
        cls.matcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.matcher)

    def test_review_covers_both_editions_and_remains_untrained(self):
        result = validate(self.review)
        self.assertEqual((result["differences"], result["concepts"], result["name_union"]), (76, 271, 273))
        self.assertEqual(result["applied_aliases"], 4)
        self.assertIsNone(result["probability"])
        self.assertFalse(result["training_labels"])

    def test_missing_and_duplicate_decisions_fail(self):
        for duplicate in (False, True):
            review = deepcopy(self.review)
            review["decisions"].pop()
            if duplicate:
                review["decisions"].append(review["decisions"][0])
            with self.subTest(duplicate=duplicate), self.assertRaises(ValueError):
                validate(review)

    def test_unrecorded_alias_or_concept_changes_fail(self):
        for name, alias in (("통근", "뿌리가"), ("배우자", "부부가"), ("음양", "새표기")):
            taxonomy = deepcopy(self.taxonomy)
            for groups in taxonomy.values():
                for concepts in groups.values():
                    if name in concepts:
                        concepts[name].append(alias)
            with self.subTest(alias=alias), self.assertRaises(ValueError):
                validate(self.review, taxonomy=taxonomy)
        taxonomy = deepcopy(self.taxonomy)
        taxonomy["S04 합충형파해"]["합"]["합(총칭)"] = ["합을 해"]
        with self.assertRaises(ValueError):
            validate(self.review, taxonomy=taxonomy)

    def test_pending_decision_cannot_claim_application(self):
        review = deepcopy(self.review)
        row = next(r for r in review["decisions"] if r["concept"] == "배우자")
        row["decision"] = "보류"
        with self.assertRaises(ValueError):
            validate(review)

    def test_stale_or_misquoted_evidence_fails(self):
        for key, value in (("sha256", "0" * 64), ("quote", "원문에 없는 새 설명"), ("lines", [0, 1])):
            review = deepcopy(self.review)
            review["evidence"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate(review)

    def test_validation_does_not_mutate_caller_data(self):
        review, taxonomy = deepcopy(self.review), deepcopy(self.taxonomy)
        validate(review, taxonomy=taxonomy)
        self.assertEqual(review, self.review)
        self.assertEqual(taxonomy, self.taxonomy)

    def test_crlf_checkout_preserves_evidence_but_content_change_fails(self):
        read_bytes = Path.read_bytes
        with patch.object(Path, "read_bytes", lambda p: read_bytes(p).replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")):
            self.assertEqual(validate(self.review)["evidence_ranges"], len(self.review["evidence"]))
        with patch.object(Path, "read_bytes", lambda p: read_bytes(p) + b" changed"):
            with self.assertRaises((ValueError, json.JSONDecodeError)):
                validate(self.review)

    def test_source_level_taxonomy_mutations_fail(self):
        source = (REPO / TAXONOMY).read_text(encoding="utf-8")
        statements = [
            'TAXONOMY["S05 십성·육친"]["육친"]["배우자"].append("미검수표현")',
            'TAXONOMY["추가"] = {}',
            'del TAXONOMY["S05 십성·육친"]',
            'other = TAXONOMY',
            'mutate(TAXONOMY)',
        ]
        for statement in statements:
            with self.subTest(statement=statement), patch.object(Path, "read_text", return_value=source + "\n" + statement):
                with self.assertRaises(ValueError):
                    load_taxonomy(REPO / TAXONOMY)

    def test_edition_delta_and_training_promotion_fail(self):
        review = deepcopy(self.review)
        review["decisions"][0]["local_only_aliases"] = []
        with self.assertRaises(ValueError):
            validate(review)
        review = deepcopy(self.review)
        review["use_as_training_labels"] = True
        with self.assertRaises(ValueError):
            validate(review)

    def test_reviewed_spouse_phrases_work_in_existing_matcher(self):
        by_id = {e["id"]: e for e in self.review["evidence"]}
        row = next(r for r in self.review["decisions"] if r["concept"] == "배우자")
        for addition in row["applied_aliases"]:
            alias = addition["alias"]
            with self.subTest(alias=alias):
                self.assertIn(alias, by_id[addition["evidence_id"]]["quote"])
                self.assertIn("배우자", self.matcher.concepts_in(alias))
                self.assertIn("배우자", self.matcher.concepts_in(by_id[addition["evidence_id"]]["quote"]))

    def test_held_general_words_and_component_names_stay_separate(self):
        cases = [
            ("그림세계의 뿌리를 찾아야겠소이다.", "통근"),
            ("그리고 더 크게 보호본능을 자극합니다", "상극"),
            ("실제 날씨는 소한이 더 춥다는 속담입니다.", "조후 균형"),
            ("부부가 둘 다 놀고 있습니다 라는 책", "배우자"),
            ("청간합은 실제로 부부라는 뜻은 아니고요 감목은 기토와 부부관계라는 거예요", "배우자"),
        ]
        for text, absent in cases:
            with self.subTest(text=text):
                self.assertNotIn(absent, self.matcher.concepts_in(text))
        self.assertNotIn("합(총칭)", self.matcher.concepts_in("결합을 해야지"))
        self.assertNotIn("충(총칭)", self.matcher.concepts_in("보충을 해줘야겠죠"))
        # A future longer alias must not silently consume the underlying node.
        self.assertIn("오행(총칭)", self.matcher.concepts_in("극하는 오행"))
        self.assertIn("일지", self.matcher.concepts_in("일지의 뿌리가"))

    def test_withheld_marital_metaphors_do_not_add_spouse(self):
        evidence = {e["id"]: e for e in self.review["evidence"]}
        for eid in ("spouse_metaphor", "spouse_among_analogy"):
            e = evidence[eid]
            lines = (REPO / e["path"]).read_text(encoding="utf-8-sig").splitlines()
            text = "\n".join(lines[e["lines"][0] - 1:e["lines"][1]])
            with self.subTest(evidence=eid):
                self.assertNotIn("배우자", self.matcher.concepts_in(text))

    def test_supplement_source_does_not_become_branch_clash(self):
        evidence = {e["id"]: e for e in self.review["evidence"]}
        for text in (evidence["clash_substring"]["quote"],
                     "목 기운의 보충이 일어납니다.", "보충을 하고 보충을 해요."):
            with self.subTest(text=text):
                self.assertNotIn("지지충", self.matcher.concepts_in(text))
        # Preserve the old retrieval behavior; this is not subtype certification.
        self.assertIn("지지충", self.matcher.concepts_in(evidence["clash_positive"]["quote"]))

    def test_supplement_exclusion_keeps_real_mentions_and_component_nodes(self):
        import unicodedata
        for text in ("자오충을 봅니다.", "보충을 하고, 충을 살핍니다.",
                     "보충이 일어나도 충이 일어나는지는 따로 봅니다.",
                     "보충을 논한 뒤 묘유충을 봅니다."):
            with self.subTest(text=text):
                self.assertIn("지지충", self.matcher.concepts_in(text))
        text = "보충을 하며 일지의 오행을 봅니다."
        self.assertTrue({"일지", "오행(총칭)"} <= self.matcher.concepts_in(text))
        self.assertNotIn("지지충", self.matcher.concepts_in(unicodedata.normalize("NFD", text)))

    def test_concept_map_uses_the_same_occurrence_exclusion(self):
        import sys
        from types import SimpleNamespace
        spec = importlib.util.spec_from_file_location("f01_cmap", REPO / TAXONOMY)
        cmap = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cmap)
        texts = ["목 기운을 보충을 해줘야겠죠", "보충이 일어납니다", "보충을 한 뒤 자오충을 봅니다",
                 "보충을 한 뒤 충을 봅니다", "자오충을 봅니다"]
        corpus = [{"q": {"para_id": str(i)}, "post": {}, "text": text} for i, text in enumerate(texts)]
        with patch.object(cmap, "load", return_value=({}, [])), patch.dict(
                sys.modules, {"코퍼스": SimpleNamespace(문단들=lambda **kw: corpus)}):
            result, _, n = cmap.build()
        self.assertEqual(n, 5)
        self.assertEqual([q["para_id"] for q, _ in result["S04 합충형파해"]["충"]["지지충"]], ["2", "3", "4"])

    def test_control_phrases_reject_stimulation_and_theater(self):
        for text in ("보호본능을 자극합니다", "관성을 자극하니까요", "사주로 연극을 하는 배우",
                     "일간의 북극을 하루 만에 찾는다", "사주의 자극을 하니까", "abc극합니다", "_극하니까"):
            with self.subTest(text=text):
                self.assertNotIn("상극", self.matcher.concepts_in(text))
        for text in ("금은 목을 극합니다.", "금이 목을 극하니까요", "천간은 서로 극을 하기도 합니다.",
                     "자극합니다. 그런데 편인은 식신을 극합니다.", "연극을 하는 중, 목이 토를 극하니까요"):
            with self.subTest(text=text):
                self.assertIn("상극", self.matcher.concepts_in(text))

    def test_control_search_preserves_components_and_negation(self):
        import unicodedata
        text = "일간이 오행을 극을 하지 못합니다."
        self.assertTrue({"일간", "오행(총칭)", "상극"} <= self.matcher.concepts_in(text))
        self.assertIn("상극", self.matcher.concepts_in(unicodedata.normalize("NFD", "금은 목을 극합니다")))
        # The longer phrase remains withheld: the old component is still found.
        self.assertIn("오행(총칭)", self.matcher.concepts_in("극하는 오행"))
        self.assertNotIn("상극", self.matcher.concepts_in("극하는 오행"))

    def test_control_boundary_is_shared_by_the_concept_map(self):
        import sys
        from types import SimpleNamespace
        spec = importlib.util.spec_from_file_location("control_cmap", REPO / TAXONOMY)
        cmap = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cmap)
        texts = ["보호본능을 자극합니다", "관성을 자극하니까요", "사주로 연극을 하는 배우",
                 "금은 목을 극합니다", "금이 목을 극하니까요", "일간이 오행을 극을 하지 못합니다",
                 "자극합니다. 그런데 편인은 식신을 극합니다."]
        rows = [{"q": {"para_id": str(i)}, "post": {}, "text": t} for i, t in enumerate(texts)]
        with patch.object(cmap, "load", return_value=({}, [])), patch.dict(
                sys.modules, {"코퍼스": SimpleNamespace(문단들=lambda **kw: rows)}):
            result, _, n = cmap.build()
        hits = {name: {q["para_id"] for q, _ in matches}
                for groups in result.values() for concepts in groups.values() for name, matches in concepts.items()}
        self.assertEqual(n, len(rows))
        self.assertEqual(hits["상극"], {"3", "4", "5", "6"})
        self.assertIn("5", hits["일간"])
        self.assertIn("5", hits["오행(총칭)"])

    def test_temperature_and_hannanjoseup_do_not_establish_balance(self):
        self.assertNotIn("조후 균형", self.matcher.concepts_in("날씨가 덥습니다. 추위와 더위를 봅니다."))
        concepts = self.matcher.concepts_in("한난조습")
        self.assertIn("한난조습", concepts)
        self.assertNotIn("조후 균형", concepts)
        # Existing 조후 is a topic label, including negated balance discussions.
        self.assertIn("조후 균형", self.matcher.concepts_in("조후가 균형을 이루지 못했다."))


if __name__ == "__main__":
    unittest.main()
