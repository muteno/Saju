"""Reproduce retrieval-only comparison with the PR #193 main baseline."""
import hashlib
import json
from pathlib import Path
import subprocess
from types import ModuleType

from foundation_claims import CATALOG, REPO, REVIEW, load_index
from knowledge_query import query

BASE = "9897b462458f4f35079969ceda6a54317cb3c10e"
ROOT = Path(__file__).resolve().parent


def baseline(path):
    return subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)


def measure():
    graph = json.loads((ROOT / "knowledge_graph.json").read_text())
    review = json.loads((REPO / REVIEW).read_text())
    legacy = json.loads((ROOT / "data/legacy_review.json").read_text())
    old_catalog = json.loads(baseline(CATALOG))
    catalog = json.loads((REPO / CATALOG).read_text())
    old_module = ModuleType("classification_baseline")
    old_module.__file__ = str(ROOT / "foundation_claims.py")
    exec(compile(baseline("docs/knowledge-model/foundation_claims.py"),
                 "baseline/foundation_claims.py", "exec"), old_module.__dict__)
    old = old_module.ClaimIndex(old_catalog, graph, review)
    current = load_index(graph)
    terms = sorted({v for n in graph["nodes"] for v in [n["id"], n["title"], *n["aliases"]]})
    changed = []
    for term in terms:
        before = query(term, graph, legacy, old)
        after = query(term, graph, legacy, current)
        if before.pop("source_claim_review", None) != after.pop("source_claim_review", None):
            changed.append(term)
        assert before == after, term
    preserved = [t["title"] for t in old_catalog["topics"]]
    for term in preserved:
        assert query(term, graph, legacy, old) == query(term, graph, legacy, current), term
    assert catalog["claims"][:len(old_catalog["claims"])] == old_catalog["claims"]
    assert catalog["topics"][:len(old_catalog["topics"])] == old_catalog["topics"]
    assert catalog["supplemental_evidence"] == old_catalog["supplemental_evidence"]
    new_topics = {}
    for term in ("사길신", "사흉신"):
        before = query(term, graph, legacy, old)
        after = query(term, graph, legacy, current)
        result = after["source_claim_review"]
        new_topics[term] = {"before": before["status"], "after": after["status"],
                            "claims": len(result["claims"]), "evidence_ranges": len(result["evidence"]),
                            "probability": after["probability"]}
    unchanged = {}
    previous = json.loads((ROOT / "data/foundation_generation_mixed_measurement.json").read_text())
    for path in previous["unchanged_sha256"]:
        raw = (REPO / path).read_bytes()
        assert raw == baseline(path), path
        unchanged[path] = hashlib.sha256(raw).hexdigest()
    layer = {path: hashlib.sha256((REPO / path).read_bytes()).hexdigest() for path in (
        "docs/knowledge-model/foundation_claims.py", "docs/knowledge-model/test_foundation_claims.py",
        "docs/knowledge-model/measure_classification_links.py", CATALOG)}
    return {"base_commit": BASE, "scope": "actual_query_comparison_not_prediction_accuracy",
            "base_terms_checked": len(terms), "base_payload_changes_excluding_claim_layer": 0,
            "old_topics_exactly_preserved": preserved,
            "old_claim_records_preserved": len(old_catalog["claims"]),
            "changed_base_term_claim_contexts": changed,
            "before_counts": old.counts, "after_counts": current.counts,
            "new_topics": new_topics,
            "classification_anchors": {t["title"]: t["anchor_node_ids"] for t in catalog["topics"][-2:]},
            "all_topic_anchor_count": len({n for t in catalog["topics"] for n in t["anchor_node_ids"]}),
            "cited_ranges_all_topics": len({e["id"] for t in catalog["topics"] for e in current.retrieve(t["id"])["evidence"]}),
            "unchanged_sha256": unchanged, "current_layer_sha256": layer}


if __name__ == "__main__":
    print(json.dumps(measure(), ensure_ascii=False, indent=2))
