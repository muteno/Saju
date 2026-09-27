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
TOPICS = {"review_편인도식": "편인도식", "review_상관패인": "상관패인",
          "review_재생관": "재생관", "review_관살혼잡": "관살혼잡",
          "review_사길신": "사길신", "review_사흉신": "사흉신"}
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
    "generation_definition": ("review_재생관", {"sagong_generation"}),
    "generation_planes": ("review_재생관", {"sagong_planes", "sagong_generation_examples"}),
    "generation_hidden": ("review_재생관", {"hyeonmyo_branch_generation"}),
    "generation_year": ("review_재생관", {"hyeonmyo_generation_variant", "hyeonmyo_generation_exception"}),
    "generation_transcription": ("review_재생관", {"generation_suffix"}),
    "mixed_board": ("review_관살혼잡", {"board_mixed"}),
    "mixed_hyeonmyo": ("review_관살혼잡", {"hyeonmyo_mixed"}),
    "mixed_determinism": ("review_관살혼잡", {"choco_determinism"}),
    "good_board": ("review_사길신", {"board_good"}),
    "good_sagong": ("review_사길신", {"sagong_classes"}),
    "good_plus_2021": ("review_사길신", {"plus_color_2021"}),
    "good_plus_other": ("review_사길신", {"plus_color_other"}),
    "good_relative": ("review_사길신", {"choco_relative_good_bad"}),
    "bad_board": ("review_사흉신", {"board_bad"}),
    "bad_sagong": ("review_사흉신", {"sagong_classes"}),
    "bad_plus_2021": ("review_사흉신", {"plus_color_2021"}),
    "bad_plus_other": ("review_사흉신", {"plus_color_other"}),
    "bad_relative": ("review_사흉신", {"choco_relative_good_bad"}),
    "bad_transcription": ("review_사흉신", {"choco_dosik_definition"}),
}


def _classification(label, groups, coverage="complete"):
    """Materialize a finite reviewed list, not a rule that infers membership."""
    return {"label": label, "coverage": coverage,
            "groups": [{"label": group, "members": [
                {"label": name, "node_id": node} for name, node in members]}
                for group, members in groups]}


def _single_groups(*names):
    return [(name, [(name, "ten_god_" + name)]) for name in names]


# Exact source-reviewed membership contracts. Group labels/counts, alternatives,
# empty expansions and unmapped names are meaningful, not interchangeable sets.
# "complete" means the list is fully spelled out, not that every node is mapped.
CLASSIFICATIONS = {
    "good_board": [_classification("재관인식(財官印食)", [
        ("재", [("정재", "ten_god_정재"), ("편재", "ten_god_편재")]),
        ("관", [("정관", "ten_god_정관")]), ("인", [("정인", "ten_god_정인")]),
        ("식", [("식신", "ten_god_식신")])])],
    "good_sagong": [_classification("사길신", _single_groups("식신", "정재", "정관", "정인"))],
    "good_plus_2021": [_classification("사길신", [
        ("정관", [("정관", "ten_god_정관")]),
        ("재성", [("정재", "ten_god_정재"), ("편재", "ten_god_편재")]),
        ("인성", [("정인", "ten_god_정인"), ("편인", "ten_god_편인")]),
        ("식신", [("식신", "ten_god_식신")])])],
    "good_plus_other": [_classification("재관인식", _single_groups("정재", "정관", "정인", "식신"))],
    "bad_board": [
        _classification("살상겁인(殺傷劫刃)", [
            ("살", []), ("상", []), ("겁", []), ("인", [("양인", None)])], "partial"),
        _classification("살상겁효(殺傷劫梟)", [
            ("살", []), ("상", []), ("겁", []), ("효", [("편인", "ten_god_편인")])], "partial")],
    "bad_sagong": [_classification("사흉신", _single_groups("상관", "겁재", "편관", "편인"))],
    "bad_plus_2021": [_classification("사흉신", [
        ("편관(칠살)", [("편관(칠살)", "ten_god_편관")]),
        ("상관", [("상관", "ten_god_상관")]), ("양인", [("양인", None)]),
        ("겁재", [("겁재", "ten_god_겁재")])])],
    "bad_plus_other": [_classification("살상겁효", _single_groups("편관", "상관", "겁재", "편인"))],
}
# Additional adjacent passages; the frozen F02 review is never rewritten.
# Each addition inherits its source identity from the original reviewed passage.
SUPPLEMENT_SOURCES = {
    "sagong_generation_examples": ("sagong_planes", (1021, 1060)),
    "hyeonmyo_generation_exception": ("hyeonmyo_generation_variant", (380, 384)),
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

    fields(catalog, "schema_version scope inference_enabled use_as_training_labels probability graph_fingerprint review_sha256 supplemental_evidence topics claims")
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 3,
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
    supplements = catalog["supplemental_evidence"]
    require(isinstance(supplements, list) and len(supplements) == len(SUPPLEMENT_SOURCES)
            and {e["id"] for e in supplements} == set(SUPPLEMENT_SOURCES),
            "Missing or unreviewed supplemental evidence")
    for item in supplements:
        fields(item, "id path sha256 lines quote source_profile kind")
        parent_id, bounds = SUPPLEMENT_SOURCES[item["id"]]
        parent = evidence[parent_id]
        require(item["id"] not in evidence, "Duplicate supplemental evidence")
        require(all(item[k] == parent[k] for k in ("path", "sha256", "source_profile", "kind")),
                "Supplemental evidence attribution changed")
        require(item["lines"] == list(bounds)
                and all(type(n) is int for n in item["lines"]), "Supplemental range changed")
        raw = (repo / item["path"]).read_bytes()
        lines = raw.decode("utf-8-sig").splitlines()
        start, end = bounds
        require(item["sha256"] == text_sha(raw) and end <= len(lines)
                and item["quote"] == "\n".join(lines[start-1:end]),
                "Supplemental source quote mismatch")
        evidence[item["id"]] = item
    decisions = {r["concept"]: r for r in review["decisions"]}
    topics, claims = catalog["topics"], catalog["claims"]
    require(isinstance(topics, list) and len(topics) == len(TOPICS), "Expected six reviewed topics")
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
        extra = " classifications" if claim["id"] in CLASSIFICATIONS else ""
        fields(claim, "id topic_id type statement evidence_ids relations conditions exceptions chart_scope time_scope unresolved" + extra)
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
        allowed.update(eid for eid, (parent, _) in SUPPLEMENT_SOURCES.items() if parent in allowed)
        require(set(claim["evidence_ids"]) <= allowed, "Evidence belongs to another topic")
        require(len({evidence[e]["source_profile"] for e in claim["evidence_ids"]}) == 1,
                "Different source profiles must remain separate claims")
        require(isinstance(claim["relations"], list), "Invalid claim relations")
        if claim["topic_id"] in {"review_사길신", "review_사흉신"}:
            require(claim["relations"] == [], "Classifications cannot create causal relations")
        if claim["id"] in CLASSIFICATIONS:
            require(claim["classifications"] == CLASSIFICATIONS[claim["id"]],
                    "Classification differs from reviewed source membership")
            for item in claim["classifications"]:
                for group in item["groups"]:
                    for member in group["members"]:
                        require(member["node_id"] is None or member["node_id"] in nodes,
                                "Unknown classification member node")
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
        linked.update(m["node_id"] for c in selected for item in c.get("classifications", [])
                      for group in item["groups"] for m in group["members"] if m["node_id"] is not None)
        require(set(topic["anchor_node_ids"]) == linked,
                "Topic anchors must match explicit relation participants or classification members")
        # Every original review caveat (including lexical ambiguity) is returned
        # together with the structured claims, not silently dropped during linking.
    return {"topics": len(topics), "claims": len(claims),
            "source_relations": sum(len(c["relations"]) for c in claims),
            "source_classifications": sum(len(c.get("classifications", [])) for c in claims),
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
        evidence = [e for e in self._review["evidence"] + self._catalog["supplemental_evidence"]
                    if e["id"] in refs]
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
    from foundation_livelihood import extend_index as extend_livelihood
    from foundation_peach import extend_index as extend_peach
    previous = extend_livelihood(ClaimIndex(catalog, graph, review, repo), graph, repo)
    return extend_peach(previous, graph, repo)


if __name__ == "__main__":
    graph = json.loads((ROOT / "knowledge_graph.json").read_text(encoding="utf-8"))
    print(json.dumps(load_index(graph).counts, ensure_ascii=False, indent=2))
