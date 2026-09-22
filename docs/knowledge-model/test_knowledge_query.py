"""Prevent source navigation from becoming semantic claims or mixing snapshots."""
import copy
import json
from pathlib import Path
import unittest

from knowledge_query import diagram_context, query


class SourceNavigationTests(unittest.TestCase):
    def setUp(self):
        self.result = {
            "diagram_structure": {"snapshot_sha256": "current"},
            "live_foundation_references": [{"spans": [{"node_id": "section"}, {"node_id": "definition"}]}],
        }
        self.structure = {
            "source": {"raw_sha256": "current"},
            "nodes": [
                {"id": "section", "type": "section", "ancestor_ids": []},
                {"id": "definition", "type": "text", "ancestor_ids": ["section"]},
                {"id": "diagram_dot", "type": "shape-with-text", "ancestor_ids": ["section"]},
                {"id": "elsewhere", "type": "text", "ancestor_ids": []},
            ],
            "connectors": [
                {"id": "direct", "start": {"node_id": "definition"}, "end": {"node_id": "elsewhere"}},
                {"id": "nearby", "start": {"node_id": "diagram_dot"}, "end": {"node_id": "diagram_dot"}},
                {"id": "unrelated", "start": {"node_id": "elsewhere"}, "end": {"node_id": "missing"}},
            ],
        }

    def test_section_context_is_distinct_from_direct_attachment(self):
        result = diagram_context(self.result, self.structure)
        self.assertFalse(result["use_in_inference"])
        self.assertIsNone(result["probability"])
        matches = {row["connector"]["id"]: row["match_kind"] for row in result["connections"]}
        self.assertEqual(matches, {"direct": "direct_node_attachment", "nearby": "cited_section_context"})

    def test_stale_structure_is_rejected(self):
        self.structure["source"]["raw_sha256"] = "old"
        with self.assertRaises(ValueError):
            diagram_context(self.result, self.structure)

    def test_ambiguous_alias_does_not_select_a_source(self):
        graph = {"nodes": [
            {"id": "stem", "title": "신금", "kind": "heavenly_stem", "aliases": ["신"]},
            {"id": "branch", "title": "신금", "kind": "earthly_branch", "aliases": ["신"]},
        ]}
        result = query("신", graph)
        self.assertEqual(result, {"status": "ambiguous", "term": "신", "candidates": [
            {"id": "stem", "title": "신금", "kind": "heavenly_stem"},
            {"id": "branch", "title": "신금", "kind": "earthly_branch"},
        ]})

    def test_not_found_keeps_existing_contract(self):
        self.assertEqual(query("missing", {"nodes": []}),
                         {"status": "not_found", "term": "missing", "candidates": []})


class SourceReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = json.loads(Path(__file__).with_name("knowledge_graph.json").read_text(encoding="utf-8"))

    def test_review_records_use_original_evidence_once_and_include_companion_sources(self):
        graph = {
            "nodes": [{"id": "concept", "title": "Concept", "kind": "basic_concept",
                       "aliases": [], "evidence_ids": ["definition"]}],
            "relations": [{"source": "concept", "target": "other", "evidence_ids": ["relation"]}],
            "hyperedges": [{"input_nodes": ["concept"], "output_node": "other",
                            "evidence_ids": ["factor"]}],
            "conditional_rule_candidates": [
                {"id": "direct", "evidence_ids": ["definition", "condition"]},
                {"id": "factor_review", "evidence_ids": ["factor", "factor_condition"]},
                {"id": "transitive_candidate", "evidence_ids": ["condition", "unrelated"]},
            ],
            "source_issues": [
                {"id": "relation_review", "evidence_ids": ["relation", "contrasting_source"]},
                {"id": "transitive_issue", "evidence_ids": ["factor_condition", "unrelated"]},
            ],
            "evidence": [{"id": item} for item in ["definition", "relation", "factor", "condition",
                                                   "factor_condition", "contrasting_source", "unrelated"]],
        }
        before = copy.deepcopy(graph)
        result = query("concept", graph)
        self.assertEqual([item["id"] for item in result["conditional_rule_candidates"]],
                         ["direct", "factor_review"])
        self.assertEqual([item["id"] for item in result["source_issues"]], ["relation_review"])
        self.assertEqual({item["id"] for item in result["evidence"]},
                         {"definition", "relation", "factor", "condition", "factor_condition", "contrasting_source"})
        self.assertEqual(result["node"], graph["nodes"][0])
        self.assertEqual(result["relations"], graph["relations"])
        self.assertEqual(result["context_factors"], graph["hyperedges"])
        self.assertEqual(result["review_context"]["application_status"], "not_evaluated")
        self.assertIsNone(result["probability"])
        self.assertEqual(graph, before)

    def test_graph_without_optional_review_records_remains_queryable(self):
        graph = {"nodes": [{"id": "concept", "title": "Concept", "kind": "basic_concept",
                            "aliases": [], "evidence_ids": []}],
                 "relations": [], "hyperedges": [], "evidence": []}
        result = query("concept", graph)
        self.assertEqual(result["status"], "found")
        self.assertEqual(result["conditional_rule_candidates"], [])
        self.assertEqual(result["source_issues"], [])
        self.assertIsNone(result["context_contract"])

    def test_transformation_retains_school_scope_and_unchecked_conditions(self):
        result = query("합화", self.graph)
        candidates = {item["id"]: item for item in result["conditional_rule_candidates"]}
        issues = {item["id"]: item for item in result["source_issues"]}
        policy = candidates["candidate_combine_not_transform"]
        self.assertEqual(policy["status"], "source_specific_policy_candidate")
        self.assertFalse(policy["then"]["transform_elements"])
        self.assertIn("적용 유파 정책", policy["then"]["next_required"])
        self.assertFalse(policy["active_in_probability_model"])
        self.assertEqual(issues["source_harmony_transformation_policy"]["type"], "scope_or_school_difference")
        self.assertEqual(result["context_contract"], self.graph["context_contract"])
        self.assertEqual(result["probability_status"], "requires_trained_context_model")

    def test_day_master_returns_counting_scope_without_transitive_favorable_rule(self):
        result = query("일간", self.graph)
        self.assertIn("source_counting_scope", [item["id"] for item in result["source_issues"]])
        self.assertNotIn("candidate_missing_element_not_automatic_favorable",
                         [item["id"] for item in result["conditional_rule_candidates"]])
        evidence = {item["id"] for item in result["evidence"]}
        self.assertTrue({"evidence_2dca61e13ad410dd", "evidence_44a116b4e56b7141",
                         "evidence_02877e10368b0cbf"} <= evidence)

    def test_in_branch_returns_copy_issue_and_both_source_passages(self):
        result = query("寅", self.graph)
        self.assertEqual(result["node"]["id"], "branch_寅")
        issues = {item["id"]: item for item in result["source_issues"]}
        self.assertEqual(issues["source_copy_error_inhae"]["type"], "internal_inconsistency")
        evidence = {item["id"] for item in result["evidence"]}
        self.assertTrue({"evidence_e0e1fc5cd858394c", "evidence_e1a0029f66e961f2"} <= evidence)

    def test_every_returned_review_record_resolves_to_unchanged_source_passages(self):
        before = copy.deepcopy(self.graph)
        originals = {item["id"]: item for item in self.graph["evidence"]}
        for node in self.graph["nodes"]:
            with self.subTest(concept=node["id"]):
                result = query(node["id"], self.graph)
                evidence = {item["id"]: item for item in result["evidence"]}
                for record in result["conditional_rule_candidates"] + result["source_issues"]:
                    for evidence_id in record["evidence_ids"]:
                        self.assertIn(evidence_id, evidence)
                        self.assertEqual(evidence[evidence_id], originals[evidence_id])
                        self.assertTrue(evidence[evidence_id]["quote"])
                        self.assertTrue(evidence[evidence_id]["source_path"])
                        self.assertTrue(evidence[evidence_id]["source_sha256"])
                self.assertIsNone(result["probability"])
                self.assertEqual(result["review_context"]["application_status"], "not_evaluated")
        self.assertEqual(self.graph, before)


if __name__ == "__main__":
    unittest.main()
