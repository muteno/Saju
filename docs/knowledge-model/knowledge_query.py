"""Exact concept retrieval with ambiguous aliases preserved; no external services."""
import argparse
import json
from pathlib import Path


def diagram_context(result, structure):
    """Return source-navigation links; no board line becomes a semantic edge."""
    expected = result.get("diagram_structure", {}).get("snapshot_sha256")
    if not expected or expected != structure["source"]["raw_sha256"]:
        raise ValueError("Graph references and diagram structure use different snapshots")
    nodes = {n["id"]: n for n in structure["nodes"]}
    cited = {s["node_id"] for r in result.get("live_foundation_references", []) for s in r["spans"]}
    sections = {node_id for node_id in cited if nodes[node_id]["type"] == "section"}
    connections = []
    for connector in structure["connectors"]:
        endpoints = {connector[role]["node_id"] for role in ("start", "end")}
        direct = sorted(cited & endpoints)
        ancestors = {a for endpoint in endpoints for a in nodes.get(endpoint, {}).get("ancestor_ids", [])}
        contextual = sorted(sections & ancestors)
        if direct or contextual:
            connections.append({"match_kind": "direct_node_attachment" if direct else "cited_section_context",
                "matched_node_ids": direct, "matched_section_ids": contextual,
                "connector": connector})
    return {"use_in_inference": False, "probability": None,
            "meaning": "navigation within cited source nodes/sections; not concept relations",
            "connections": connections}


def query(term, graph, legacy=None):
    matches = [n for n in graph["nodes"] if term in [n["id"], n["title"], *n["aliases"]]]
    if len(matches) != 1:
        return {"status": "ambiguous" if matches else "not_found", "term": term,
                "candidates": [{"id": n["id"], "title": n["title"], "kind": n["kind"]} for n in matches]}
    node = matches[0]
    links = [r for r in graph["relations"] if node["id"] in (r["source"], r["target"])]
    factors = [h for h in graph["hyperedges"] if node["id"] in [*h["input_nodes"], h["output_node"]]]
    refs = set(node["evidence_ids"])
    for item in links + factors: refs.update(item["evidence_ids"])
    # Select review records once from the original evidence. Their companion
    # sources must not pull unrelated review records into the result recursively.
    review_records = {
        field: [item for item in graph.get(field, []) if refs.intersection(item["evidence_ids"])]
        for field in ("conditional_rule_candidates", "source_issues")
    }
    for records in review_records.values():
        for item in records:
            refs.update(item["evidence_ids"])
    foundation_ids = set(node.get("foundation_reference_ids", []))
    live_ids = set(node.get("live_foundation_reference_ids", []))
    result = {"status": "found", "node": node, "relations": links, "context_factors": factors,
            "evidence": [e for e in graph["evidence"] if e["id"] in refs],
            **review_records,
            "context_contract": graph.get("context_contract"),
            "review_context": {
                "selection_basis": "shared_evidence_with_retrieved_concept_relations_or_factors",
                "application_status": "not_evaluated",
                "meaning": "Source conditions and issues for review; shared evidence does not establish rule applicability.",
            },
            "foundation_source": graph.get("foundation_source"),
            "foundation_references": [r for r in graph.get("foundation_references", [])
                                      if r["id"] in foundation_ids],
            "live_foundation_source": graph.get("live_foundation_source"),
            "live_foundation_references": [r for r in graph.get("live_foundation_references", [])
                                           if r["id"] in live_ids],
            "diagram_structure": graph.get("diagram_structure"),
            "probability": None, "probability_status": "requires_trained_context_model"}
    if legacy is not None:
        from legacy_import import graph_fingerprint, review_context
        if legacy["graph_fingerprint"] != graph_fingerprint(graph):
            raise ValueError("Legacy concept bindings use a different graph; rebuild legacy_import.py")
        result["legacy_review"] = review_context(node["id"], legacy)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("term")
    parser.add_argument("--diagram-context", action="store_true",
                        help="Include board attachments in cited source nodes/sections, not inferred relations")
    args = parser.parse_args()
    root = Path(__file__).parent
    graph_path = root / "knowledge_graph.json"
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    legacy_path = root / "data/legacy_review.json"
    legacy = json.loads(legacy_path.read_text(encoding="utf-8")) if legacy_path.exists() else None
    if legacy is not None:
        from legacy_import import digest
        if legacy["graph_sha256"] != digest(graph_path.read_bytes()):
            raise ValueError("Legacy concept bindings are stale; rebuild legacy_import.py")
    result = query(args.term, graph, legacy=legacy)
    if args.diagram_context and result["status"] == "found":
        path = Path(__file__).parent / graph["diagram_structure"]["path"]
        result["diagram_context"] = diagram_context(result, json.loads(path.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))
