"""Prevent source navigation from becoming semantic claims or mixing snapshots."""
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
        self.assertEqual(result["status"], "ambiguous")
        self.assertNotIn("live_foundation_references", result)


if __name__ == "__main__":
    unittest.main()
