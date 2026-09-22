"""Exact concept retrieval with ambiguous aliases preserved; no external services."""
import argparse
import json
from pathlib import Path


def query(term, graph):
    matches = [n for n in graph["nodes"] if term in [n["id"], n["title"], *n["aliases"]]]
    if len(matches) != 1:
        return {"status": "ambiguous" if matches else "not_found", "term": term,
                "candidates": [{"id": n["id"], "title": n["title"], "kind": n["kind"]} for n in matches]}
    node = matches[0]
    links = [r for r in graph["relations"] if node["id"] in (r["source"], r["target"])]
    factors = [h for h in graph["hyperedges"] if node["id"] in [*h["input_nodes"], h["output_node"]]]
    refs = set(node["evidence_ids"])
    for item in links + factors: refs.update(item["evidence_ids"])
    foundation_ids = set(node.get("foundation_reference_ids", []))
    return {"status": "found", "node": node, "relations": links, "context_factors": factors,
            "evidence": [e for e in graph["evidence"] if e["id"] in refs],
            "foundation_source": graph.get("foundation_source"),
            "foundation_references": [r for r in graph.get("foundation_references", [])
                                      if r["id"] in foundation_ids],
            "probability": None, "probability_status": "requires_trained_context_model"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("term")
    args = parser.parse_args()
    graph = json.loads((Path(__file__).parent / "knowledge_graph.json").read_text(encoding="utf-8"))
    print(json.dumps(query(args.term, graph), ensure_ascii=False, indent=2))
