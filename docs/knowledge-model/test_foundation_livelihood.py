"""Source tables, non-inference, provenance and actual composed query behavior."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from foundation_claims import ClaimIndex, CATALOG as BASE_CATALOG, REVIEW as BASE_REVIEW, load_index
from foundation_livelihood import CATALOG, REVIEW, REPO, LivelihoodIndex, validate, extend_index
from foundation_additions import text_sha
from knowledge_query import query

ROOT = Path(__file__).resolve().parent


class LivelihoodTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = json.loads((ROOT / "knowledge_graph.json").read_text())
        cls.review = json.loads((REPO / REVIEW).read_text())
        cls.catalog = json.loads((REPO / CATALOG).read_text())
        cls.legacy = json.loads((ROOT / "data/legacy_review.json").read_text())
        cls.base = ClaimIndex(json.loads((REPO / BASE_CATALOG).read_text()), cls.graph,
                              json.loads((REPO / BASE_REVIEW).read_text()))
        # Freeze the original eight-topic contract; the new peach tests exercise
        # the default loader and verify preservation within the full composition.
        cls.index = extend_index(cls.base, cls.graph)

    def direct(self, title):
        return query(title, self.graph, claim_index=self.index)["source_claim_review"]

    def test_sources_caveats_and_no_inference_are_returned_together(self):
        for title, count in (("활인업", 5), ("재고귀인", 8)):
            actual = self.direct(title)
            original = next(d for d in self.review["decisions"] if d["concept"] == title)
            self.assertEqual(actual["lexical_reviews"], [original])
            self.assertEqual({e["id"] for e in actual["evidence"]}, set(original["evidence_ids"]))
            self.assertEqual(len(actual["claims"]), count)
            evidence = {e["id"]: e for e in actual["evidence"]}
            for c in actual["claims"]:
                self.assertEqual(c["source_profile"], evidence[c["evidence_ids"][0]]["source_profile"])
                self.assertEqual(c["application_status"], "not_evaluated")
                self.assertFalse(c["inference_enabled"])
                self.assertIsNone(c["probability"])
                self.assertEqual(c["relations"], [])
                self.assertTrue(c["unresolved"])
            self.assertFalse(actual["use_as_training_labels"])
            self.assertTrue(any(c["conditions"] for c in actual["claims"]))
            self.assertTrue(any(c["exceptions"] for c in actual["claims"]))

    def test_existing_six_topics_and_186_base_payloads_remain_exact(self):
        terms = {v for n in self.graph["nodes"] for v in [n["id"], n["title"], *n["aliases"]]}
        self.assertEqual(len(terms), 186)
        for term in terms:
            before = query(term, self.graph, self.legacy, self.base)
            after = query(term, self.graph, self.legacy, self.index)
            old, new = before.pop("source_claim_review", None), after.pop("source_claim_review", None)
            self.assertEqual(before, after, term)
            if old:
                for field, key in (("topics", "id"), ("claims", "id"), ("lexical_reviews", "concept"), ("evidence", "id")):
                    identities = {r[key] for r in old[field]}
                    self.assertEqual([r for r in new[field] if r[key] in identities], old[field], (term, field))
        for topic in self.base.topics():
            for term in (topic["id"], topic["title"]):
                self.assertEqual(query(term, self.graph, self.legacy, self.base),
                                 query(term, self.graph, self.legacy, self.index), term)

    def test_shared_anchors_do_not_expand_transitively(self):
        expected = {"신금": {"활인업", "재고귀인"}, "천간": {"활인업", "재고귀인"},
                    "재성": {"재생관", "재고귀인"}, "일간": {"관살혼잡", "재고귀인"},
                    "갑목": {"재고귀인"}, "지장간": {"재고귀인"}, "충": {"재고귀인"},
                    "편관": {"재생관", "관살혼잡", "사흉신"}}
        for term, titles in expected.items():
            actual = self.direct(term)
            self.assertEqual({t["title"] for t in actual["topics"]}, titles, term)
            for field in ("claims", "evidence"):
                combined = {r["id"]: r for title in titles for r in self.direct(title)[field]}
                self.assertEqual({r["id"]: r for r in actual[field]}, combined)

    def test_source_table_has_all_conjuncts_and_does_not_narrow_branch_scope(self):
        c = next(c for c in self.direct("재고귀인")["claims"] if c["id"] == "treasury_configuration")
        # Independent oracle: 도화로운1932–1955, including asymmetric comparisons.
        expected = [("甲乙", "辰", "戊", None), ("丙丁", "丑", "辛", "丁"),
                    ("戊己", "丑", "癸", "己"), ("庚辛", "未", "乙", "辛"), ("壬癸", "戌", "丁", "癸")]
        actual = [("".join(s.removeprefix("stem_") for s in p["day_master_options"]),
                   p["branch_node_id"].removeprefix("branch_"), p["additional_stem_node_id"].removeprefix("stem_"),
                   p["more_effective_day_master"].removeprefix("stem_") if p["more_effective_day_master"] else None)
                  for p in c["configurations"]]
        self.assertEqual(actual, expected)
        for p in c["configurations"]:
            self.assertIn("특정 주 한정 없음", p["branch_scope"])
            self.assertIn("추가 조건", p["additional_stem_role"])
            self.assertEqual(p["application_status"], "not_evaluated")
        self.assertTrue(any("야쟈시 적용X" in v for v in c["unresolved"]))
        for term in ("을목", "경금", "축(丑)", "술(戌)"):
            self.assertEqual(self.direct(term)["claims"], self.direct("재고귀인")["claims"])

    def test_unmapped_names_contrary_sources_and_asr_are_not_synonyms(self):
        for term in ("활인", "할인업", "의사", "신신병존", "재고", "재고기인", "재성입묘", "합거"):
            self.assertEqual(query(term, self.graph, claim_index=self.index)["status"], "not_found", term)
        live = {c["id"]: c for c in self.direct("활인업")["claims"]}
        self.assertEqual({p["node_id"] for p in live["livelihood_hyeonmyo"]["participants"] if p["node_id"]},
                         {"stem_辛", "heavenly_stems"})
        self.assertTrue(any("나란" in c for c in live["livelihood_hyeonmyo"]["conditions"]))
        self.assertTrue(any("업종만" in c for c in live["livelihood_plus"]["exceptions"]))
        self.assertTrue(any("청구업자" in c for c in live["livelihood_hyomyeong"]["unresolved"]))
        wealth = {c["id"]: c for c in self.direct("재고귀인")["claims"]}
        self.assertEqual(wealth["treasury_definition"]["source_family"], wealth["treasury_transcript"]["source_family"])
        self.assertNotEqual(wealth["treasury_definition"]["source_profile"], wealth["treasury_transcript"]["source_profile"])
        self.assertIn("시지", wealth["treasury_tomb"]["chart_scope"])
        self.assertTrue(any(p["label"] == "합거" and p["node_id"] is None
                            for p in wealth["treasury_hidden_limit"]["participants"]))

    def test_configuration_participant_scope_and_inference_injection_fail(self):
        def claim(c, cid): return next(r for r in c["claims"] if r["id"] == cid)
        mutations = [lambda c: c.update(inference_enabled=True), lambda c: c.update(use_as_training_labels=0),
                     lambda c: c.update(probability=.8), lambda c: c.update(schema_version=True),
                     lambda c: c["claims"].pop(), lambda c: c["topics"].pop(),
                     lambda c: c["claims"][0].update(weight=.7),
                     lambda c: c["claims"][0].update(evidence_ids=["live_hyeonmyo"]),
                     lambda c: c["claims"][0]["participants"][0].update(node_id="authority"),
                     lambda c: c["topics"][0]["anchor_node_ids"].append("day_master"),
                     lambda c: claim(c, "treasury_configuration")["configurations"].pop(),
                     lambda c: claim(c, "treasury_configuration")["configurations"][0].update(branch_scope="일지"),
                     lambda c: claim(c, "treasury_configuration")["configurations"][0].update(additional_stem_node_id="stem_己"),
                     lambda c: claim(c, "treasury_configuration")["configurations"][0].update(more_effective_day_master="stem_乙"),
                     lambda c: claim(c, "treasury_board")["relations"].append({"source":"wealth","target":"hidden_stems","predicate":"always"})]
        for i, mutate in enumerate(mutations):
            c = deepcopy(self.catalog); mutate(c)
            with self.subTest(i=i), self.assertRaises(ValueError):
                validate(c, self.graph, self.review)

    def test_review_hash_source_quotes_and_stale_graph_fail(self):
        c = deepcopy(self.catalog); c["review_sha256"] = "0" * 64
        with self.assertRaises(ValueError): validate(c, self.graph, self.review)
        for edit in (dict(quote="invented"), dict(sha256="0"*64), dict(path="../outside")):
            r = deepcopy(self.review); r["evidence"][0].update(edit)
            raw = (json.dumps(r, ensure_ascii=False) + "\n").encode()
            c = deepcopy(self.catalog); c["review_sha256"] = text_sha(raw)
            read = Path.read_bytes
            with patch.object(Path, "read_bytes", lambda p: raw if p == REPO / REVIEW else read(p)):
                with self.assertRaises(ValueError): validate(c, self.graph, r)
        graph = deepcopy(self.graph); graph["nodes"][0]["definition"] += " changed"
        with self.assertRaises(ValueError): query("활인업", graph, claim_index=self.index)

    def test_nested_outputs_and_catalog_do_not_mutate_index(self):
        c, r = deepcopy(self.catalog), deepcopy(self.review)
        index = LivelihoodIndex(c, self.graph, r)
        expected = index.retrieve("review_재고귀인")
        c["claims"].clear(); r["evidence"].clear()
        value = index.retrieve("review_재고귀인")
        value["claims"][1]["configurations"][0]["day_master_options"].clear()
        value["evidence"][0]["quote"] = "changed"
        self.assertEqual(index.retrieve("review_재고귀인"), expected)
        expected = self.direct("신금")
        changed = self.direct("신금"); changed["claims"].clear()
        self.assertEqual(self.direct("신금"), expected)

    def test_cli_direct_and_base_only_keep_explicit_modes(self):
        for term in ("활인업", "재고귀인"):
            cmd = [sys.executable, str(ROOT / "knowledge_query.py"), term]
            actual = json.loads(subprocess.check_output(cmd + ["--diagram-context"], cwd="/tmp", text=True))
            self.assertEqual(actual.pop("diagram_context")["status"], "no_live_board_binding")
            self.assertEqual(actual, query(term, self.graph, self.legacy, self.index))
            base = json.loads(subprocess.check_output(cmd + ["--base-only"], cwd="/tmp", text=True))
            self.assertEqual(base["status"], "not_found")
        # The default loader must fail on a missing extension, not silently hide it.
        read = Path.read_text
        def missing(p, *args, **kwargs):
            if p == REPO / CATALOG: raise FileNotFoundError(str(p))
            return read(p, *args, **kwargs)
        with patch.object(Path, "read_text", missing), self.assertRaises(FileNotFoundError):
            load_index(self.graph)


if __name__ == "__main__":
    unittest.main()
