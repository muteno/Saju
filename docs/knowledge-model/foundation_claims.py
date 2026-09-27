"""Source-attributed claim links over existing concepts, never inference rules.

The F02 lexical review and the base graph stay unchanged. This separately
versioned layer makes reviewed topics and their contextual claims navigable.
"""
from copy import deepcopy
import json
from pathlib import Path

from foundation_additions import text_sha, validate_and_strip, REVIEW
from foundation_review import load_taxonomy, TAXONOMY
from legacy_import import graph_fingerprint

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
CATALOG = "docs/knowledge-model/data/foundation_claim_links.json"
TOPICS = {"review_편인도식": "편인도식", "review_상관패인": "상관패인"}
KINDS = {"definition", "condition", "exception", "disagreement", "retrieval_limit"}
# Finite source-reviewed batch. A later topic/claim needs an explicit provenance
# review instead of silently reassigning an existing statement to another source.
CLAIM_SOURCES = {
    "dosik_board": ("review_편인도식", {"board_dosik"}),
    "dosik_sagong": ("review_편인도식", {"sagong_control", "sagong_paein"}),
    "dosik_choco": ("review_편인도식", {"choco_dosik_definition", "choco_dosik_strength"}),
    "dosik_sequence": ("review_편인도식", {"sanchaek_sequence"}),
    "dosik_naming": ("review_편인도식", {"sanchaek_naming"}),
    "dosik_determinism": ("review_편인도식", {"choco_determinism"}),
    "paein_board": ("review_상관패인", {"board_paein"}),
    "paein_sagong": ("review_상관패인", {"sagong_paein"}),
    "paein_transcription": ("review_상관패인", {"sanchaek_sequence"}),
    "paein_ordinary": ("review_상관패인", {"ordinary_paein"}),
}


def validate(catalog, graph, review, repo=REPO):
    """Fail closed on stale sources/bindings and unreviewed schema expansion."""
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def fields(item, expected):
        require(isinstance(item, dict) and set(item) == set(expected.split()),
                "Unexpected or missing claim-layer fields")

    def strings(values, allow_empty=False):
        require(isinstance(values, list) and (allow_empty or bool(values))
                and all(isinstance(v, str) and v.strip() for v in values)
                and len(values) == len(set(values)), "Invalid claim-layer string list")

    fields(catalog, "schema_version scope inference_enabled use_as_training_labels probability graph_fingerprint review_sha256 topics claims")
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1,
            "Unsupported claim-layer schema")
    require(catalog["scope"] == "source_claim_retrieval"
            and catalog["inference_enabled"] is False
            and catalog["use_as_training_labels"] is False
            and catalog["probability"] is None, "Claim layer cannot activate inference or training")
    require(catalog["graph_fingerprint"] == graph_fingerprint(graph), "Stale claim graph bindings")
    raw_review = (repo / REVIEW).read_bytes()
    require(catalog["review_sha256"] == text_sha(raw_review)
            and review == json.loads(raw_review), "Stale F02 source review")
    validate_and_strip(review, load_taxonomy(repo / TAXONOMY), repo)
    nodes = {n["id"]: n for n in graph["nodes"]}
    evidence = {e["id"]: e for e in review["evidence"]}
    decisions = {r["concept"]: r for r in review["decisions"]}
    topics, claims = catalog["topics"], catalog["claims"]
    require(isinstance(topics, list) and len(topics) == 2, "Expected two reviewed topics")
    require({t["id"] for t in topics} == set(TOPICS), "Missing or duplicate reviewed topic")
    require(isinstance(claims, list) and bool(claims), "Missing source claims")
    require(len({c["id"] for c in claims}) == len(claims), "Duplicate source claim")
    require({c["id"] for c in claims} == set(CLAIM_SOURCES), "Missing or unreviewed source claim")
    for topic in topics:
        fields(topic, "id title anchor_node_ids")
        require(topic["title"] == TOPICS[topic["id"]], "Unexpected topic name")
        require(topic["id"] not in nodes and not any(
            topic["title"] in [n["id"], n["title"], *n["aliases"]] for n in nodes.values()),
            "Topic collides with base graph identity")
        strings(topic["anchor_node_ids"])
        require(all(n in nodes for n in topic["anchor_node_ids"]), "Unknown topic anchor")
    for claim in claims:
        fields(claim, "id topic_id type statement evidence_ids relations conditions exceptions chart_scope time_scope unresolved")
        require(isinstance(claim["id"], str) and claim["id"].strip(), "Missing claim ID")
        require(claim["topic_id"] in TOPICS and claim["type"] in KINDS, "Unknown claim topic/type")
        for field in ("statement", "chart_scope", "time_scope"):
            require(isinstance(claim[field], str) and claim[field].strip(), "Missing claim context")
        for field in ("conditions", "exceptions"):
            strings(claim[field], allow_empty=True)
        strings(claim["unresolved"])
        strings(claim["evidence_ids"])
        expected_topic, expected_evidence = CLAIM_SOURCES[claim["id"]]
        require(claim["topic_id"] == expected_topic
                and set(claim["evidence_ids"]) == expected_evidence,
                "Source claim attribution differs from reviewed binding")
        decision = decisions[TOPICS[claim["topic_id"]]]
        allowed = {e for c in decision["claims"] for e in c["evidence_ids"]}
        require(set(claim["evidence_ids"]) <= allowed, "Evidence belongs to another topic")
        require(len({evidence[e]["source_profile"] for e in claim["evidence_ids"]}) == 1,
                "Different source profiles must remain separate claims")
        require(isinstance(claim["relations"], list), "Invalid claim relations")
        seen = set()
        for relation in claim["relations"]:
            fields(relation, "source predicate target")
            require(relation["source"] in nodes and relation["target"] in nodes,
                    "Unknown relation participant")
            require(relation["source"] != relation["target"], "Unexpected self relation")
            require(isinstance(relation["predicate"], str) and relation["predicate"].strip(),
                    "Missing source-specific predicate")
            key = tuple(relation[k] for k in ("source", "predicate", "target"))
            require(key not in seen, "Duplicate source relation")
            seen.add(key)
    for topic in topics:
        selected = [c for c in claims if c["topic_id"] == topic["id"]]
        require(selected, "Topic has no source claims")
        linked = {r[k] for c in selected for r in c["relations"] for k in ("source", "target")}
        require(set(topic["anchor_node_ids"]) == linked, "Topic anchors must match explicit relation participants")
        # Every original review caveat (including lexical ambiguity) is returned
        # together with the structured claims, not silently dropped during linking.
    return {"topics": len(topics), "claims": len(claims),
            "source_relations": sum(len(c["relations"]) for c in claims),
            "inference_enabled": False, "probability": None}


class ClaimIndex:
    """Validated, detached snapshot shared by CLI and direct query consumers."""
    def __init__(self, catalog, graph, review, repo=REPO):
        self.counts = validate(catalog, graph, review, repo)
        self._catalog = deepcopy(catalog)
        self._review = deepcopy(review)

    def check_graph(self, graph):
        if self._catalog["graph_fingerprint"] != graph_fingerprint(graph):
            raise ValueError("Stale claim graph bindings")

    def topics(self):
        return [{"id": t["id"], "title": t["title"], "kind": "source_review_topic",
                 "aliases": [], "evidence_ids": [], "inference_enabled": False}
                for t in self._catalog["topics"]]

    def retrieve(self, node_id):
        topics = [t for t in self._catalog["topics"]
                  if node_id == t["id"] or node_id in t["anchor_node_ids"]]
        if not topics:
            return None
        topic_ids = {t["id"] for t in topics}
        claims = [c for c in self._catalog["claims"] if c["topic_id"] in topic_ids]
        titles = {t["title"] for t in topics}
        decisions = [d for d in self._review["decisions"] if d["concept"] in titles]
        refs = {e for c in claims for e in c["evidence_ids"]}
        for decision in decisions:
            refs.update(decision["alias_evidence_ids"])
            refs.update(e for c in decision["claims"] for e in c["evidence_ids"])
        evidence = [e for e in self._review["evidence"] if e["id"] in refs]
        by_id = {e["id"]: e for e in evidence}
        records = [{**c, "source_profile": by_id[c["evidence_ids"][0]]["source_profile"],
                    "status": "source_claim", "application_status": "not_evaluated",
                    "inference_enabled": False, "probability": None} for c in claims]
        return deepcopy({"scope": "source_claim_retrieval", "topics": topics,
                         "claims": records, "lexical_reviews": decisions, "evidence": evidence,
                         "selection_basis": "explicit_topic_or_anchor_identity; complete_topic_context",
                         "application_status": "not_evaluated", "inference_enabled": False,
                         "use_as_training_labels": False, "probability": None})


def load_index(graph, repo=REPO):
    # A missing/stale catalog is an error, not a silent return to not_found.
    catalog = json.loads((repo / CATALOG).read_text(encoding="utf-8"))
    review = json.loads((repo / REVIEW).read_text(encoding="utf-8"))
    return ClaimIndex(catalog, graph, review, repo)


if __name__ == "__main__":
    graph = json.loads((ROOT / "knowledge_graph.json").read_text(encoding="utf-8"))
    print(json.dumps(load_index(graph).counts, ensure_ascii=False, indent=2))
