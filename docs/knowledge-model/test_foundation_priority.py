"""Priority review: preserved old matches and rejection of unreviewed changes."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unicodedata
import unittest
from unittest.mock import patch

from foundation_partial import load_and_strip as strip_partial
from foundation_priority import REPO, REVIEW, TOPICS, validate_and_strip
from foundation_review import TAXONOMY, REVIEW as F01, load_taxonomy, validate


class PriorityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads((REPO / REVIEW).read_text())
        cls.f01 = json.loads((REPO / F01).read_text())
        cls.taxonomy = load_taxonomy(REPO / TAXONOMY)
        cls.prior_taxonomy, _ = strip_partial(cls.taxonomy)
        spec = importlib.util.spec_from_file_location("priority_matcher", REPO / "정제/_현황판/build_neuron_map.py")
        cls.matcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.matcher)

    def test_explicit_extension_reaches_frozen_gate(self):
        result = validate(self.f01, taxonomy=self.taxonomy)
        self.assertEqual((result["differences"], result["concepts"], result["applied_aliases"],
                          result["evidence_ranges"], result["executable_concepts"]), (76, 271, 4, 176, 282))
        self.assertEqual(result["f02"]["added_concepts"], 6)
        self.assertEqual(result["f02"]["evidence_ranges"], 24)
        self.assertEqual(result["f02_priority"]["added_concepts"], 4)
        self.assertEqual(result["f02_priority"]["added_existing_aliases"], 2)
        self.assertFalse(result["training_labels"])
        self.assertIsNone(result["probability"])

    def test_manifest_cannot_widen_aliases_or_activate_held_node(self):
        mutations = [lambda t: t["S15 발현·결과"]["업"]["활인업"].append("활인"),
                     lambda t: t["S06 신살"]["길신"].pop("재고귀인"),
                     lambda t: t["S06 신살"]["흉신"]["공망"].remove("天中殺"),
                     lambda t: t["S06 신살"]["흉신"]["공망"].append("천중"),
                     lambda t: t["S04 합충형파해"]["형·파·해·원진"].update(부분삼형=["상형"]),
                     lambda t: t["S06 신살"]["흉신"].update(진도화=["진도화"]),
                     lambda t: t["S06 신살"]["도화·역마·화개"]["도화"].append("도하")]
        # Every negative starts with a known valid full executable taxonomy.
        validate(self.f01, taxonomy=self.taxonomy)
        for i, mutate in enumerate(mutations):
            taxonomy = deepcopy(self.taxonomy)
            mutate(taxonomy)
            with self.subTest(i=i), self.assertRaises(ValueError):
                validate(self.f01, taxonomy=taxonomy)
        review, taxonomy = deepcopy(self.review), deepcopy(self.taxonomy)
        review["decisions"][0]["aliases"].append("활인")
        taxonomy["S15 발현·결과"]["업"]["활인업"].append("활인")
        with self.assertRaises(ValueError):
            validate_and_strip(review, taxonomy)

    def test_missing_duplicated_or_inference_enabled_review_fails(self):
        mutations = [lambda d: d["decisions"].pop(),
                     lambda d: d["decisions"].append(deepcopy(d["decisions"][0])),
                     lambda d: d.update(probability=0.4),
                     lambda d: d.update(use_as_training_labels=0),
                     lambda d: d.update(apply_relations=True),
                     lambda d: d["decisions"][0].update(inference_enabled=True),
                     lambda d: d["decisions"][0].update(claims=[])]
        for i, mutate in enumerate(mutations):
            review = deepcopy(self.review)
            mutate(review)
            with self.subTest(i=i), self.assertRaises(ValueError):
                validate_and_strip(review, self.prior_taxonomy)

    def test_broken_source_links_quotes_and_ranges_fail(self):
        mutations = [lambda d: d["evidence"][0].update(sha256="0" * 64),
                     lambda d: d["evidence"][0].update(quote="없는 인용"),
                     lambda d: d["evidence"][0].update(lines=[False, 3]),
                     lambda d: d["evidence"][0].update(path="../../outside"),
                     lambda d: d["evidence"].append(deepcopy(d["evidence"][0])),
                     lambda d: d["decisions"][0]["claims"][0].update(evidence_ids=["missing"]),
                     lambda d: d["decisions"][0].update(alias_evidence_ids=["ordinary_live"]),
                     lambda d: d["decisions"][2].update(alias_evidence_ids=["void_sagong"])]
        for i, mutate in enumerate(mutations):
            review = deepcopy(self.review)
            mutate(review)
            with self.subTest(i=i), self.assertRaises(ValueError):
                validate_and_strip(review, self.prior_taxonomy)

    def test_new_review_failure_is_not_bypassed_by_f01_gate(self):
        broken = deepcopy(self.review)
        broken["decisions"].pop()
        original = Path.read_text
        def read(path, *args, **kwargs):
            return json.dumps(broken) if path == REPO / REVIEW else original(path, *args, **kwargs)
        with patch.object(Path, "read_text", read), self.assertRaises(ValueError):
            validate(self.f01)

    def test_detached_copy_and_crlf_source_hashes(self):
        taxonomy, review = deepcopy(self.prior_taxonomy), deepcopy(self.review)
        original = Path.read_bytes
        with patch.object(Path, "read_bytes", lambda p: original(p).replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")):
            stripped, _ = validate_and_strip(review, taxonomy)
        self.assertEqual(taxonomy, self.prior_taxonomy)
        self.assertEqual(review, self.review)
        self.assertEqual(sum(len(cs) for gs in stripped.values() for cs in gs.values()), 277)
        self.assertEqual(stripped["S06 신살"]["흉신"]["공망"], ["공망", "空亡", "天中殺"])

    def test_old_components_and_synthetic_join_boundaries_survive(self):
        expected = {"진도화": {"진도화", "도화"}, "가도화": {"가도화", "도화"},
                    "활인업": {"활인업"}, "재고귀인": {"재고귀인"},
                    "천중살": {"공망"}, "天中煞": {"공망"},
                    "천중살인상생": {"공망", "살인상생"}}
        for term, names in expected.items():
            with self.subTest(term=term):
                self.assertEqual(self.matcher.concepts_in(term), names)
                self.assertEqual(self.matcher.concepts_in(unicodedata.normalize("NFD", term)), names)
        self.assertIn("적천수 천간론", self.matcher.concepts_in("갑목참천중살"))
        self.assertIn("공망", self.matcher.concepts_in("갑목참천중살"))

    def test_held_aliases_negation_and_foreign_system_are_not_inference(self):
        for term in ("역활인", "생활인", "재고정리", "목표를 재고한다", "재성입묘", "진도와", "육형 반형"):
            self.assertFalse(self.matcher.concepts_in(term) & TOPICS.keys(), term)
        self.assertEqual(self.matcher.concepts_in("재고귀인이 아니다") & TOPICS.keys(), {"재고귀인"})
        self.assertIn("진도화", self.matcher.concepts_in("자미두수 탐랑을 진도화로 본다"))
        by_name = {r["concept"]: r for r in self.review["decisions"]}
        for name in ("진도화", "가도화"):
            statements = " ".join(c["statement"] for c in by_name[name]["claims"])
            for text in ("자미두수", "사용하지 않", "원국", "운", "모순", "충/형"):
                self.assertIn(text, statements)
        self.assertEqual(by_name["부분삼형"]["decision"], "review_relation_only")
        self.assertEqual(by_name["부분삼형"]["aliases"], [])
        self.assertTrue(any(a["alias"] == "재성입묘" for a in by_name["재고귀인"]["held_aliases"]))

    def test_cli_review_keeps_sources_separate_from_research_graph(self):
        output = json.loads(subprocess.check_output([sys.executable, str(REPO / "docs/knowledge-model/foundation_priority.py"),
                                                    "--concept", "재고귀인"], cwd="/tmp", text=True))
        self.assertEqual(output["decision"]["concept"], "재고귀인")
        self.assertFalse(output["inference_enabled"])
        self.assertIsNone(output["probability"])
        self.assertTrue(output["evidence"])


if __name__ == "__main__":
    unittest.main()
