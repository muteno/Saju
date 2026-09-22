"""Scope/privacy, attachment semantics and table-index contracts."""
import hashlib
import json
import unittest

from figma_ingest import ingest


def exported(body, outside="", **kwargs):
    raw = (f'<canvas id="0:1"><section id="498:4143" name="unreviewed root name">'
           f'{body}</section>{outside}</canvas>').encode()
    return ingest(raw, board_key="fixture_key", fetched_at="2026-09-22", **kwargs)


def connector(node_id, start="a", end="b", start_cap="NONE", end_cap="ARROW_LINES", label=""):
    return (f'<connector id="{node_id}" connectorStart="{start}" connectorEnd="{end}" '
            f'connectorStartCap="{start_cap}" connectorEndCap="{end_cap}">{label}</connector>')


class IngestContracts(unittest.TestCase):
    def test_scope_and_text_privacy_and_smoke_counts(self):
        result = exported('<text id="a" name="private unreviewed in-scope text" x="1.5" y="2"/>',
                          '<section id="private"><text id="outside" name="private outside text"/></section>')
        payload = json.dumps(result)
        self.assertNotIn("private unreviewed", payload)
        self.assertNotIn("private outside", payload)
        self.assertEqual([n["id"] for n in result["nodes"]], ["498:4143", "a"])
        self.assertEqual(result["statistics"]["nodes"], 2)
        node = result["nodes"][1]
        self.assertEqual(node["ancestor_ids"], ["0:1", "498:4143"])
        self.assertEqual(node["text_sha256"], hashlib.sha256(b"private unreviewed in-scope text").hexdigest())
        self.assertEqual(node["position"], {"x": 1.5, "y": 2})
        self.assertIsNone(result["probability"])
        self.assertFalse(result["use_in_inference"])

    def test_missing_outside_and_self_loop_are_different(self):
        result = exported('<text id="a"/>' + connector("missing", end="no_such_node")
                          + connector("outside", end="external") + connector("self", end="a"),
                          '<text id="external" name="unexported"/>')
        links = {c["id"]: c for c in result["connectors"]}
        self.assertTrue(links["missing"]["dangling"])
        self.assertEqual(links["missing"]["end"]["status"], "missing_node")
        self.assertFalse(links["outside"]["dangling"])
        self.assertFalse(links["outside"]["both_endpoints_inside_scope"])
        self.assertEqual(links["outside"]["end"]["status"], "outside_scope")
        self.assertTrue(links["self"]["attachment_self_loop"])
        self.assertTrue(links["self"]["both_endpoints_inside_scope"])
        self.assertFalse(links["self"]["use_in_inference"])

    def test_absent_endpoint_does_not_become_a_self_loop(self):
        result = exported('<connector id="empty"/>')
        link = result["connectors"][0]
        self.assertTrue(link["dangling"])
        self.assertFalse(link["attachment_self_loop"])
        self.assertEqual(link["start"]["status"], "absent")

    def test_none_both_reverse_and_unknown_caps_are_preserved(self):
        fixtures = [
            ("none", "NONE", "NONE", "none", "no_arrowheads"),
            ("both", "ARROW_LINES", "ARROW_EQUILATERAL", "both", "both"),
            ("reverse", "ARROW_LINES", "NONE", "start_only", "end_to_start"),
            ("forward", "NONE", "ARROW_LINES", "end_only", "start_to_end"),
            ("unknown", "DIAMOND_FILLED", "ARROW_LINES", "unknown_cap", "unknown"),
        ]
        result = exported('<text id="a"/><text id="b"/>' + ''.join(
            connector(name, start_cap=start, end_cap=end) for name, start, end, _, _ in fixtures))
        links = {c["id"]: c for c in result["connectors"]}
        for name, _, _, cap_class, direction in fixtures:
            with self.subTest(name=name):
                self.assertEqual(links[name]["cap_class"], cap_class)
                self.assertEqual(links[name]["visual_arrow_direction"], direction)
                self.assertEqual(links[name]["semantic_direction"], "not_inferred")

    def test_labels_require_exact_explicit_review(self):
        body = '<text id="a"/><text id="b"/>' + connector("edge", label="생")
        self.assertIsNone(exported(body)["connectors"][0]["label"])
        reviewed = exported(body, reviewed_connector_labels={"edge": "생"})
        self.assertEqual(reviewed["connectors"][0]["label"], "생")
        with self.assertRaises(ValueError):
            exported(body, reviewed_connector_labels={"edge": "극"})

    def test_table_indices_and_hashes_without_reconstructing_merged_cells(self):
        body = ('<table id="t" tableNumRows="2" tableNumColumns="3">'
                '<table-cell id="cell2" tableCellRowIndex="1" tableCellColumnIndex="2">乙</table-cell>'
                '<table-cell id="cell1" tableCellRowIndex="0" tableCellColumnIndex="0">甲</table-cell>'
                '</table>')
        table = exported(body)["tables"][0]
        self.assertEqual((table["rows"], table["columns"]), (2, 3))
        self.assertEqual([(c["id"], c["row"], c["column"]) for c in table["cells"]],
                         [("cell1", 0, 0), ("cell2", 1, 2)])
        self.assertEqual(table["unrepresented_grid_origins"], 4)
        self.assertEqual(table["cells"][0]["text_sha256"], hashlib.sha256("甲".encode()).hexdigest())
        self.assertNotIn("甲", json.dumps(table, ensure_ascii=False))

    def test_invalid_table_or_duplicate_id_fails_explicitly(self):
        invalid = [
            '<text id="same"/><text id="same"/>',
            '<table id="t" tableNumRows="1" tableNumColumns="1"><table-cell id="c" tableCellRowIndex="1" tableCellColumnIndex="0"/></table>',
            '<table id="t" tableNumRows="1" tableNumColumns="1"><table-cell id="a" tableCellRowIndex="0" tableCellColumnIndex="0"/><table-cell id="b" tableCellRowIndex="0" tableCellColumnIndex="0"/></table>',
        ]
        for body in invalid:
            with self.subTest(body=body), self.assertRaises(ValueError):
                exported(body)

    def test_output_is_deterministic_and_raw_hash_is_exact(self):
        raw = b'<canvas id="0:1"><section id="498:4143"/></canvas>'
        kwargs = {"board_key": "fixture", "fetched_at": "2026-09-22T10:20:30Z"}
        a, b = ingest(raw, **kwargs), ingest(raw, **kwargs)
        self.assertEqual(a, b)
        self.assertEqual(a["source"]["raw_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertFalse(a["source"]["raw_content_included"])

    def test_api_self_attachment_keeps_distinct_positions(self):
        body = '<text id="a"/>' + connector("edge", end="a")
        details = {"scope_root_ids": ["498:4143"], "connectors": [{
            "id": "edge", "start": {"endpointNodeId": "a", "position": {"x": 1, "y": 2}},
            "end": {"endpointNodeId": "a", "position": {"x": 3, "y": 4}},
            "start_cap": "NONE", "end_cap": "ARROW_LINES", "line_type": "STRAIGHT", "label": ""}]}
        raw = json.dumps(details).encode()
        result = exported(body, connector_details_raw=raw)
        edge = result["connectors"][0]
        self.assertTrue(edge["attachment_self_loop"])
        self.assertNotEqual(edge["start"]["attachment"]["position"], edge["end"]["attachment"]["position"])
        self.assertEqual(edge["semantic_direction"], "not_inferred")
        self.assertFalse(edge["use_in_inference"])
        self.assertEqual(result["connector_details_source"]["raw_sha256"], hashlib.sha256(raw).hexdigest())

    def test_api_snapshot_mismatch_cannot_silently_override_xml(self):
        body = '<text id="a"/><text id="b"/>' + connector("edge")
        valid = {"scope_root_ids": ["498:4143"], "connectors": [{
            "id": "edge", "start": {"endpointNodeId": "a", "magnet": "LEFT"},
            "end": {"endpointNodeId": "b", "position": {"x": 0, "y": 0}},
            "start_cap": "NONE", "end_cap": "ARROW_LINES", "line_type": "CURVED", "label": ""}]}
        for mutation in ("id", "endpoint", "cap", "scope", "position"):
            extra = json.loads(json.dumps(valid))
            item = extra["connectors"][0]
            if mutation == "id": item["id"] = "other"
            if mutation == "endpoint": item["start"]["endpointNodeId"] = "b"
            if mutation == "cap": item["end_cap"] = "NONE"
            if mutation == "scope": extra["scope_root_ids"].append("outside")
            if mutation == "position": item["end"]["position"]["x"] = float("nan")
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                exported(body, connector_details_raw=json.dumps(extra).encode())


if __name__ == "__main__":
    unittest.main()
