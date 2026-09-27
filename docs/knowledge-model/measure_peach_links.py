"""Actual queries against PR #198 main; counts are not prediction accuracy."""
import hashlib
import json
from pathlib import Path
import subprocess
from types import ModuleType

from foundation_claims import load_index
from foundation_peach import CATALOG, REVIEW, REPO
from knowledge_query import query

BASE = "3519f61c5539a58e492176c6558cbf98db6f9703"
ROOT = Path(__file__).resolve().parent


def baseline(path):
    return subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)


def measure():
    graph = json.loads((ROOT / "knowledge_graph.json").read_text())
    legacy = json.loads((ROOT / "data/legacy_review.json").read_text())
    module = ModuleType("peach_baseline")
    module.__file__ = str(ROOT / "foundation_claims.py")
    exec(compile(baseline("docs/knowledge-model/foundation_claims.py"),
                 "baseline/foundation_claims.py", "exec"), module.__dict__)
    # The baseline loader imports livelihood; that code/catalog and its complete
    # original ClaimIndex catalog are byte-checked below before accepting output.
    old, current = module.load_index(graph), load_index(graph)
    terms = sorted({v for n in graph["nodes"] for v in [n["id"], n["title"], *n["aliases"]]})
    changed = []
    for term in terms:
        before, after = query(term, graph, legacy, old), query(term, graph, legacy, current)
        old_context, new_context = before.pop("source_claim_review", None), after.pop("source_claim_review", None)
        assert before == after, term
        if old_context != new_context:
            changed.append(term)
        if old_context:
            for field, key in (("topics", "id"), ("claims", "id"), ("lexical_reviews", "concept"), ("evidence", "id")):
                existing = {r[key] for r in old_context[field]}
                assert [r for r in new_context[field] if r[key] in existing] == old_context[field], (term, field)
        if new_context:
            for field, key in (("topics", "id"), ("claims", "id"), ("lexical_reviews", "concept"), ("evidence", "id")):
                assert len({r[key] for r in new_context[field]}) == len(new_context[field]), (term, field)
    preserved = [t["title"] for t in old.topics()]
    for topic in old.topics():
        for term in (topic["id"], topic["title"]):
            assert query(term, graph, legacy, old) == query(term, graph, legacy, current), term
    new_topics = {}
    for term in ("진도화", "가도화"):
        before, after = query(term, graph, legacy, old), query(term, graph, legacy, current)
        result = after["source_claim_review"]
        new_topics[term] = {"before": before["status"], "after": after["status"],
            "claims": len(result["claims"]), "evidence_ranges": len(result["evidence"]),
            "source_configurations": sum(len(c["configurations"]) for c in result["claims"]),
            "anchor_node_ids": result["topics"][0]["anchor_node_ids"],
            "unmapped_participants": sorted({p["label"] for c in result["claims"]
                                              for p in c["participants"] if p["node_id"] is None}),
            "probability": after["probability"]}
    frozen = ["docs/knowledge-model/data/foundation_claim_links.json",
              "docs/knowledge-model/data/foundation_f02_review.json", REVIEW,
              "docs/knowledge-model/foundation_livelihood.py", "docs/knowledge-model/data/foundation_livelihood_links.json",
              "docs/knowledge-model/knowledge_graph.json", "docs/knowledge-model/knowledge_query.py",
              "docs/knowledge-model/data/legacy_review.json", "docs/knowledge-model/data/context_reviews.json",
              "docs/knowledge-model/data/foundation_taxonomy_review.json",
              "docs/knowledge-model/data/foundation_partial_review.json",
              "docs/knowledge-model/foundation_priority.py", "docs/knowledge-model/foundation_partial.py",
              "docs/knowledge-model/foundation_additions.py", "docs/knowledge-model/foundation_review.py",
              "docs/knowledge-model/legacy_import.py",
              "정제/_현황판/build_neuron_map.py", "정제/_현황판/build_concept_map.py"]
    source_files = {e["path"] for t in current.topics() for e in current.retrieve(t["id"])["evidence"]}
    unchanged = {}
    for path in sorted(set(frozen) | source_files):
        raw = (REPO / path).read_bytes()
        assert raw == baseline(path), path
        unchanged[path] = hashlib.sha256(raw).hexdigest()
    layer = {path: hashlib.sha256((REPO / path).read_bytes()).hexdigest() for path in (
        "docs/knowledge-model/foundation_claims.py", "docs/knowledge-model/foundation_peach.py",
        "docs/knowledge-model/test_foundation_peach.py", "docs/knowledge-model/test_foundation_livelihood.py",
        "docs/knowledge-model/measure_peach_links.py", CATALOG)}
    return {"base_commit": BASE, "scope": "actual_query_comparison_not_prediction_accuracy",
            "base_terms_checked": len(terms), "base_payload_changes_excluding_claim_layer": 0,
            "old_topics_exactly_preserved": preserved, "old_claim_records_preserved": old.counts["claims"],
            "changed_base_term_claim_contexts": changed, "before_counts": old.counts, "after_counts": current.counts,
            "new_topics": new_topics, "paired_topics_share_claims_and_evidence": True,
            "all_topic_anchor_count": len({n for t in current.topics() for r in current.retrieve(t["id"])["topics"]
                                            for n in r["anchor_node_ids"]}),
            "cited_ranges_all_topics": len({e["id"] for t in current.topics()
                                            for e in current.retrieve(t["id"])["evidence"]}),
            "unchanged_sha256": unchanged, "current_layer_sha256": layer}


if __name__ == "__main__":
    print(json.dumps(measure(), ensure_ascii=False, indent=2))
