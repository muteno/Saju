"""Regression checks for identity, missing sources, conditions and query isolation."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from legacy_import import (SOURCE_PROFILES, convert_record, find_evidence, graph_fingerprint,
                           load_archives, map_concept)
from knowledge_query import query

ROOT = Path(__file__).parent


class LegacyImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = json.loads((ROOT / "knowledge_graph.json").read_text(encoding="utf-8"))
        cls.bundle = json.loads((ROOT / "data/legacy_review.json").read_text(encoding="utf-8"))

    def row(self):
        return {"a": "편관(칠살)", "b": "일간", "kind": "조건부", "dir": "→",
                "polarity": "부(-)", "조건": ["자리", "오행"], "조건절": "주변에 목이 없으면",
                "para_id": "test-1", "출처처": "웹:명리학탐구", "조건극성": "부재",
                "트리거품질": 1.0, "weight": 1.0, "등급": "상"}

    def doc(self, text="원문 시작\n주변에 목이 없으면 검토한다.", profile="saju.sajuplus.net"):
        rows = [{"locator": f"XML-P{i}", "text": t} for i, t in enumerate(text.split("\n"), 1)]
        offsets, total = [], 0
        for row in rows:
            offsets.append(total)
            total += len(row["text"]) + 1
        return {"path": "archive.docx", "sha256": "snapshot", "source_profile": profile,
                "archive_header": "source", "rows": rows, "offsets": offsets, "text": text}

    def test_symbol_identities_and_position_alias_are_not_conflated(self):
        self.assertEqual(map_concept("신금(辛)", self.graph), "stem_辛")
        self.assertEqual(map_concept("신금(申)", self.graph), "branch_申")
        self.assertIsNone(map_concept("월지", self.graph))
        self.assertEqual(map_concept("편관(칠살)", self.graph), "ten_god_편관")
        self.assertIsNone(map_concept("천간합", self.graph))
        self.assertIsNone(map_concept("미등록용어", self.graph))

    def test_absence_and_direction_survive_without_legacy_scores(self):
        row = self.row()
        before = copy.deepcopy(row)
        item, evidence = convert_record(row, "조건부간선.jsonl", 1, self.graph, [self.doc()])
        self.assertEqual(item["condition"]["presence_or_absence"], "부재")
        self.assertEqual(item["condition"]["direction"], "→")
        self.assertEqual(item["condition"]["clause"], row["조건절"])
        self.assertEqual(item["source_status"], "literal_anchor_found")
        self.assertEqual(evidence[0]["start"], 2)
        self.assertEqual(evidence[0]["quote"], row["조건절"])
        self.assertFalse(item["active_in_probability_model"])
        self.assertIsNone(item["probability"])
        for key in ("weight", "트리거품질", "등급"):
            self.assertNotIn(key, json.dumps(item, ensure_ascii=False))
        self.assertEqual(row, before)

    def test_wrong_source_and_inexact_clause_do_not_pass(self):
        self.assertEqual(find_evidence("주변에 목이 없으면", "chocosd.com", [self.doc()]), [])
        self.assertEqual(find_evidence("주변에 목이 있으면", "saju.sajuplus.net", [self.doc()]), [])
        self.assertEqual(find_evidence("", "saju.sajuplus.net", [self.doc()]), [])

    def test_missing_transcript_stays_unverified(self):
        row = self.row()
        row["출처처"] = "전사:석우당"
        item, evidence = convert_record(row, "조건부간선.jsonl", 1, self.graph, [self.doc()])
        self.assertEqual(item["source_status"], "source_not_available_in_import_scope")
        self.assertEqual(evidence, [])

    def test_manual_anchor_does_not_verify_paraphrased_condition(self):
        row = self.row()
        row.update(수기=True, 검증구="주변에 목이 없으면", 조건절="새롭게 해석한 복합 조건")
        item, _ = convert_record(row, "조건부간선_수기.jsonl", 3, self.graph, [self.doc()])
        self.assertEqual(item["anchor_kind"], "manual_anchor_not_verbatim_condition")
        self.assertEqual(item["semantic_status"], "needs_review")
        self.assertIn("manual_condition_paraphrase_requires_review", item["review_reasons"])

    def test_both_branches_retained_without_assuming_exclusivity(self):
        row = {"문장": "첫 조건이면 다음 조건도 검토", "para_id": "test-branch", "출처처": "웹:현묘",
               "분기A": {"절": "첫 조건이면", "조건": ["자리"], "개념": ["일간"]},
               "분기B": {"절": "다음 조건도 검토", "조건": ["오행"], "개념": ["월지"]},
               "전체개념": ["일간", "월지"], "공통개념": []}
        item, _ = convert_record(row, "분기간선.jsonl", 1, self.graph, [])
        self.assertEqual(item["condition"]["branches"], [row["분기A"], row["분기B"]])
        self.assertEqual(item["condition"]["branch_logic"], "unreviewed_not_assumed_exclusive")

    def test_shared_paragraph_is_one_group_not_independent_support(self):
        first = self.row()
        second = {**first, "b": "지장간"}
        a, _ = convert_record(first, "조건부간선.jsonl", 1, self.graph, [])
        b, _ = convert_record(second, "조건부간선.jsonl", 2, self.graph, [])
        self.assertEqual(a["evidence_group"], b["evidence_group"])
        self.assertNotEqual(a["id"], b["id"])
        self.assertEqual(SOURCE_PROFILES["웹:명리학탐구"], SOURCE_PROFILES["웹:플러스명리학"])

    def test_query_adds_only_direct_review_without_changing_core_graph(self):
        original = query("일간", self.graph)
        enriched = query("일간", self.graph, self.bundle)
        context = enriched.pop("legacy_review")
        self.assertEqual(original, enriched)
        self.assertTrue(context["candidates"])
        self.assertFalse(context["use_in_inference"])
        needed = set()
        for candidate in context["candidates"]:
            self.assertIn("day_master", [m["concept_id"] for m in candidate["concept_mappings"]])
            needed.update(candidate["evidence_ids"])
        self.assertEqual(needed, {e["id"] for e in context["evidence"]})

    def test_stale_bindings_rejected_by_programmatic_query(self):
        stale = {**self.bundle, "graph_fingerprint": "old"}
        with self.assertRaisesRegex(ValueError, "different graph"):
            query("일간", self.graph, stale)

    def test_incomplete_archive_directory_is_not_a_successful_rebuild(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "docs/knowledge-model").mkdir(parents=True)
            (root / "docs/knowledge-model/corpus_inventory.json").write_text(
                json.dumps({"documents": [{"path": "missing.docx", "sha256": "expected"}]}))
            with self.assertRaisesRegex(ValueError, "archive set"):
                load_archives(root)

    def test_snapshot_accounting_and_no_promoted_rules(self):
        bundle = self.bundle
        self.assertEqual(bundle["graph_fingerprint"], graph_fingerprint(self.graph))
        self.assertEqual(sum(len(c["legacy_records"]) for c in bundle["candidates"]), 767)
        self.assertEqual(sum(bundle["summary"]["source_status"].values()), len(bundle["candidates"]))
        evidence = {e["id"]: e for e in bundle["evidence"]}
        for candidate in bundle["candidates"]:
            self.assertFalse(candidate["active_in_probability_model"])
            self.assertIsNone(candidate["probability"])
            self.assertEqual(bool(candidate["evidence_ids"]), candidate["source_status"] == "literal_anchor_found")
            for ref in candidate["evidence_ids"]:
                self.assertIn(evidence[ref]["quote"], evidence[ref]["paragraph_text"])
                self.assertEqual(candidate["source_profile"], evidence[ref]["source_profile"])


if __name__ == "__main__":
    unittest.main()
