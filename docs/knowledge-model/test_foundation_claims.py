"""Check actual query behavior, attribution, stale inputs, and non-inference."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import shutil
import tempfile
import unittest

from foundation_claims import ClaimIndex, CATALOG, REPO, REVIEW, load_index, validate
from knowledge_query import diagram_context, query

ROOT = Path(__file__).resolve().parent


class ClaimRetrievalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = json.loads((ROOT / "knowledge_graph.json").read_text())
        cls.review = json.loads((REPO / REVIEW).read_text())
        cls.catalog = json.loads((REPO / CATALOG).read_text())
        cls.index = load_index(cls.graph)
        cls.legacy = json.loads((ROOT / "data/legacy_review.json").read_text())

    def test_all_topics_return_conditions_exceptions_and_sources(self):
        for term in ("편인도식", "상관패인", "재생관", "관살혼잡"):
            with self.subTest(term=term):
                result = query(term, self.graph, claim_index=self.index)
                self.assertEqual(result["status"], "found")
                review = result["source_claim_review"]
                self.assertTrue(any(c["conditions"] for c in review["claims"]))
                self.assertTrue(any(c["exceptions"] for c in review["claims"]))
                self.assertTrue(any(c["type"] == "disagreement" for c in review["claims"]))
                evidence = {e["id"]: e for e in review["evidence"]}
                for c in review["claims"]:
                    self.assertTrue(c["unresolved"])
                    for eid in c["evidence_ids"]:
                        self.assertEqual(evidence[eid]["source_profile"], c["source_profile"])
                        source = (REPO / evidence[eid]["path"]).read_text(encoding="utf-8-sig")
                        self.assertIn(evidence[eid]["quote"], source)
                    self.assertEqual(c["application_status"], "not_evaluated")
                    self.assertFalse(c["inference_enabled"])
                    self.assertIsNone(c["probability"])
                self.assertFalse(review["use_as_training_labels"])
                self.assertEqual(result["relations"], [])
                self.assertEqual(result["context_factors"], [])
                self.assertIsNone(result["probability"])

    def test_all_base_queries_and_legacy_results_are_preserved(self):
        before = deepcopy(self.graph)
        changed = set()
        for node in self.graph["nodes"]:
            original = query(node["id"], self.graph, self.legacy)
            actual = query(node["id"], self.graph, self.legacy, self.index)
            if "source_claim_review" in actual:
                changed.add(node["id"])
                actual.pop("source_claim_review")
            self.assertEqual(actual, original)
        self.assertEqual(changed, {"ten_god_편인", "ten_god_식신", "resource", "output",
                                  "ten_god_상관", "ten_god_정인", "ten_god_정관",
                                  "wealth", "authority", "ten_god_정재", "ten_god_편관", "day_master"})
        self.assertEqual(self.graph, before)

    def test_navigation_keeps_full_topic_context_without_cross_topic_leakage(self):
        for anchor, topic in (("편인", "편인도식"), ("식신", "편인도식"),
                              ("상관", "상관패인"), ("정인", "상관패인"),
                              ("재성", "재생관"), ("정재", "재생관"), ("일간", "관살혼잡")):
            from_anchor = query(anchor, self.graph, claim_index=self.index)["source_claim_review"]
            direct = query(topic, self.graph, claim_index=self.index)["source_claim_review"]
            self.assertEqual(from_anchor, direct)
        paein = query("상관패인", self.graph, claim_index=self.index)["source_claim_review"]
        by_id = {c["id"]: c for c in paein["claims"]}
        self.assertEqual(by_id["paein_board"]["relations"], [])
        edges = by_id["paein_sagong"]["relations"]
        self.assertEqual((edges[0]["source"], edges[0]["target"]), ("ten_god_정인", "ten_god_상관"))
        self.assertIn("극할 수 없", edges[1]["predicate"])
        self.assertEqual(by_id["paein_ordinary"]["relations"], [])
        self.assertNotIn("dosik_sequence", by_id)

    def test_dosik_directions_keep_specific_and_generic_participants(self):
        # Independently reviewed against board line994, 사주공부4714,
        # 초코18-19 and 산책처럼123/158-169. These are source assertions.
        claims = query("편인도식", self.graph, claim_index=self.index)["source_claim_review"]["claims"]
        actual = {c["id"]: [(r["source"], r["target"]) for r in c["relations"]] for c in claims}
        self.assertEqual(actual, {
            "dosik_board": [("ten_god_편인", "ten_god_식신")],
            "dosik_sagong": [("resource", "output")],
            "dosik_choco": [("ten_god_편인", "ten_god_식신")],
            "dosik_sequence": [("ten_god_편인", "ten_god_식신")],
            "dosik_naming": [("ten_god_편인", "output")],
            "dosik_determinism": [],
        })

    def test_original_caveats_and_held_aliases_remain_complete(self):
        for decision in self.review["decisions"][:4]:
            result = query(decision["concept"], self.graph, claim_index=self.index)["source_claim_review"]
            self.assertEqual(result["lexical_reviews"], [decision])
            refs = {e["id"] for e in result["evidence"]}
            self.assertTrue({eid for c in decision["claims"] for eid in c["evidence_ids"]} <= refs)
            for alias in decision["held_aliases"]:
                self.assertEqual(query(alias["alias"], self.graph, claim_index=self.index)["status"], "not_found")

    def test_unknown_and_ambiguous_terms_keep_contract(self):
        for term in ("없는개념", "신", "인", "사길신", "사흉신"):
            self.assertEqual(query(term, self.graph, claim_index=self.index), query(term, self.graph))

    def test_shared_anchors_return_complete_topics_without_transitive_expansion(self):
        expected = {"정관": {"상관패인", "관살혼잡"},
                    "관성": {"재생관", "관살혼잡"}, "편관": {"재생관", "관살혼잡"}}
        for anchor, titles in expected.items():
            result = query(anchor, self.graph, claim_index=self.index)["source_claim_review"]
            self.assertEqual({t["title"] for t in result["topics"]}, titles)
            direct_claims, direct_evidence = {}, {}
            for title in titles:
                direct = query(title, self.graph, claim_index=self.index)["source_claim_review"]
                direct_claims.update({c["id"]: c for c in direct["claims"]})
                direct_evidence.update({e["id"]: e for e in direct["evidence"]})
            self.assertEqual({c["id"]: c for c in result["claims"]}, direct_claims)
            self.assertEqual({e["id"]: e for e in result["evidence"]}, direct_evidence)
            self.assertFalse(any(c["id"].startswith("dosik_") for c in result["claims"]))

    def test_generation_preserves_generic_specific_place_time_and_exceptions(self):
        result = query("재생관", self.graph, claim_index=self.index)["source_claim_review"]
        claims = {c["id"]: c for c in result["claims"]}
        generic = claims["generation_definition"]["relations"][0]
        specific = claims["generation_year"]["relations"][0]
        self.assertEqual((generic["source"], generic["target"]), ("wealth", "authority"))
        self.assertEqual((specific["source"], specific["target"]), ("ten_god_정재", "ten_god_편관"))
        year = claims["generation_year"]
        self.assertIn("정묘일주", year["chart_scope"])
        self.assertIn("2020년 경자년 세운", year["time_scope"])
        self.assertIn("천간 庚(정재)→지지 子(편관)", year["chart_scope"])
        self.assertTrue(any("인성" in c for c in year["conditions"]))
        self.assertTrue(any("부정" in e and "긍정" in e for e in year["exceptions"]))
        self.assertEqual(claims["generation_hidden"]["relations"], [])
        self.assertIn("기해일주 지장간", claims["generation_hidden"]["chart_scope"])
        self.assertTrue(any("지지 전체 금지가 아님" in e for e in claims["generation_planes"]["exceptions"]))
        self.assertEqual(claims["generation_transcription"]["relations"], [])
        self.assertEqual({e["id"] for e in result["evidence"]}, {
            "sagong_generation", "sagong_planes", "sagong_generation_examples",
            "hyeonmyo_branch_generation", "hyeonmyo_generation_variant",
            "hyeonmyo_generation_exception", "generation_suffix"})

    def test_mixed_keeps_coexistence_distinct_from_causation_and_reconciled_rules(self):
        result = query("관살혼잡", self.graph, claim_index=self.index)["source_claim_review"]
        claims = {c["id"]: c for c in result["claims"]}
        board = claims["mixed_board"]
        mixed = claims["mixed_hyeonmyo"]
        for edge in (board["relations"][0], mixed["relations"][0]):
            self.assertIn("방향 없는 공존", edge["predicate"])
            self.assertEqual((edge["source"], edge["target"]), ("ten_god_정관", "ten_god_편관"))
        strength = board["relations"][1]
        self.assertEqual((strength["source"], strength["target"]), ("authority", "day_master"))
        self.assertIn("과강", strength["predicate"])
        self.assertIn("기묘일주·지장간", mixed["chart_scope"])
        self.assertTrue(any("길하게" in e for e in mixed["exceptions"]))
        self.assertTrue(any("적용이 어렵" in e for e in mixed["exceptions"]))
        self.assertTrue(any("합화 성립 계산은 미수행" in e for e in mixed["unresolved"]))
        self.assertEqual(claims["mixed_determinism"]["relations"], [])
        self.assertEqual({e["id"] for e in result["evidence"]}, {"board_mixed", "hyeonmyo_mixed", "choco_determinism"})

    def test_supplemental_context_rejects_omission_misattribution_and_fabrication(self):
        mutations = [
            lambda c: c["supplemental_evidence"].pop(),
            lambda c: c["supplemental_evidence"][0].update(quote="fabricated"),
            lambda c: c["supplemental_evidence"][0].update(lines=[1021, 1030]),
            lambda c: c["supplemental_evidence"][0].update(path="../outside"),
            lambda c: c["supplemental_evidence"][0].update(source_profile="other"),
            lambda c: c["supplemental_evidence"][0].update(sha256="0" * 64),
            lambda c: next(x for x in c["claims"] if x["id"] == "generation_year")["evidence_ids"].pop(),
            lambda c: next(x for x in c["claims"] if x["id"] == "generation_planes")["evidence_ids"].append("hyeonmyo_generation_exception"),
        ]
        for mutate in mutations:
            catalog = deepcopy(self.catalog)
            mutate(catalog)
            with self.subTest(mutation=mutations.index(mutate)), self.assertRaises(ValueError):
                validate(catalog, self.graph, self.review)

    def test_new_topics_cli_and_base_only_are_explicit(self):
        for term in ("재생관", "관살혼잡"):
            cmd = [sys.executable, str(ROOT / "knowledge_query.py"), term]
            result = json.loads(subprocess.check_output(cmd + ["--diagram-context"], cwd=ROOT.parent, text=True))
            self.assertEqual(result["status"], "found")
            self.assertEqual(result["diagram_context"]["status"], "no_live_board_binding")
            self.assertFalse(result["diagram_context"]["use_in_inference"])
            base = json.loads(subprocess.check_output(cmd + ["--base-only"], text=True))
            self.assertEqual(base["status"], "not_found")
            self.assertEqual(base["claim_review_status"], "disabled_by_base_only_option")

    def test_catalog_and_returned_records_cannot_mutate_index(self):
        catalog = deepcopy(self.catalog)
        index = ClaimIndex(catalog, self.graph, self.review)
        expected = index.retrieve("review_편인도식")
        catalog["claims"][0]["statement"] = "changed"
        first = index.retrieve("review_편인도식")
        first["claims"][0]["statement"] = "changed"
        first["evidence"][0]["quote"] = "changed"
        self.assertEqual(index.retrieve("review_편인도식"), expected)

    def test_cli_from_another_directory_and_diagram_flag(self):
        command = [sys.executable, str(ROOT / "knowledge_query.py"), "상관패인", "--diagram-context"]
        result = json.loads(subprocess.check_output(command, cwd=ROOT.parent, text=True))
        self.assertEqual(result["status"], "found")
        self.assertEqual(result["diagram_context"]["status"], "no_live_board_binding")
        self.assertFalse(result["diagram_context"]["use_in_inference"])
        direct = query("상관패인", self.graph, claim_index=self.index)
        self.assertEqual(diagram_context(direct, None), result["diagram_context"])

    def test_standalone_base_only_cli_without_taxonomy_or_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "docs/knowledge-model"
            root.mkdir(parents=True)
            (root / "data").mkdir()
            for path in ROOT.glob("*.py"):
                shutil.copyfile(path, root / path.name)
            shutil.copyfile(ROOT / "knowledge_graph.json", root / "knowledge_graph.json")
            for name in ("legacy_review.json", "foundation_claim_links.json", "foundation_f02_review.json"):
                shutil.copyfile(ROOT / "data" / name, root / "data" / name)
            cmd = [sys.executable, str(root / "knowledge_query.py"), "일간"]
            result = json.loads(subprocess.check_output(cmd + ["--base-only"], text=True, cwd=root))
            self.assertEqual(result.pop("claim_review_status"), "disabled_by_base_only_option")
            self.assertEqual(result, query("일간", self.graph, self.legacy))
            strict = subprocess.run(cmd, capture_output=True, text=True, cwd=root)
            self.assertNotEqual(strict.returncode, 0)
            self.assertIn("build_concept_map.py", strict.stderr)

    def test_stale_graph_and_source_review_are_rejected(self):
        graph = deepcopy(self.graph)
        graph["nodes"][0]["definition"] += " changed"
        with self.assertRaisesRegex(ValueError, "Stale"):
            query("편인도식", graph, claim_index=self.index)
        review = deepcopy(self.review)
        review["evidence"][0]["quote"] = "fabricated"
        with self.assertRaisesRegex(ValueError, "Stale"):
            validate(self.catalog, self.graph, review)

    def test_inference_schema_and_cross_source_corruption_are_rejected(self):
        mutations = [
            lambda c: c.update(inference_enabled=True),
            lambda c: c.update(use_as_training_labels=True),
            lambda c: c.update(probability=0.9),
            lambda c: c["claims"][0].update(weight=0.9),
            lambda c: c["claims"][0].update(evidence_ids=["board_good"]),
            lambda c: c["claims"][0].update(evidence_ids=["sanchaek_sequence"]),
            lambda c: c["claims"][0].update(evidence_ids=["board_dosik", "choco_dosik_definition"]),
            lambda c: c["claims"][0]["relations"][0].update(target="missing_node"),
            lambda c: c["topics"][0]["anchor_node_ids"].append("ten_god_정재"),
            lambda c: c["topics"][0]["anchor_node_ids"].remove("ten_god_식신"),
            lambda c: c["topics"].pop(),
            lambda c: c["claims"].append(deepcopy(c["claims"][0])),
        ]
        for mutate in mutations:
            catalog = deepcopy(self.catalog)
            mutate(catalog)
            with self.subTest(catalog=str(catalog)[:80]), self.assertRaises(ValueError):
                validate(catalog, self.graph, self.review)


if __name__ == "__main__":
    unittest.main()
