"""Build a provenance-bearing concept graph; this does not estimate probabilities.

Run from this folder: python build_graph.py
The curated inputs are bundled in data/. Original DOCX/MD files remain untouched.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def stable_id(prefix, value):
    return prefix + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def build():
    basic, curated = read("basic_concepts.json"), read("source_candidates.json")
    inventory = json.loads((ROOT / "corpus_inventory.json").read_text(encoding="utf-8"))
    documents = {d["path"]: d for d in inventory["documents"]}
    nodes, relations, evidence, hyperedges, editorial = {}, [], {}, [], []
    old_evidence_ids = {}

    def cite(item):
        path = item.get("source_relative_path", item["source_path"])
        path = path.split("1. 원본 라이브러리/")[-1]
        start = item.get("paragraph_start", item.get("start"))
        end = item.get("paragraph_end", item.get("end", start))
        kind = item.get("locator_kind", "ooxml_paragraph_1based_including_table_paragraphs")
        record = {"source_path": "1. 원본 라이브러리/" + path,
                  "locator_kind": kind, "start": start, "end": end, "quote": item["quote"]}
        key = stable_id("evidence_", record)
        document = documents[record["source_path"]]
        record.update(source_id=document["id"], source_sha256=document["sha256"])
        record.update({k: item[k] for k in ("source_sha256", "source_group", "article_metadata") if k in item})
        # Enrich an existing identical span rather than discarding known metadata.
        evidence.setdefault(key, {}).update(record)
        evidence[key]["id"] = key
        if item.get("evidence_id"):
            old_evidence_ids[item["evidence_id"]] = key
        return key

    def node(key, title, kind, definition="", aliases=None, refs=None, **extra):
        nodes[key] = {"id": key, "title": title, "kind": kind, "definition": definition,
                      "aliases": aliases or [], "evidence_ids": refs or [], **extra}
        return key

    def edge(source, predicate, target, refs, status="source_grounded", **context):
        record = {"source": source, "predicate": predicate, "target": target,
                  "evidence_ids": sorted(set(refs)), "status": status, "context": context,
                  "probability_model": {"target": "contextual_applicability",
                      "conditioning": ["keyword_activations", "multi_keyword_interactions", "chart_context",
                                       "time_context", "source_profile"],
                      "parameters": None, "status": "untrained"},
                  "extraction_review": "source_span_checked"}
        record["id"] = stable_id("relation_", {k: record[k] for k in ("source", "predicate", "target", "context")})
        relations.append(record)
        return record["id"]

    for c in basic["concepts"]:
        refs = [cite(e) for e in c["evidence"]]
        node(c["id"], c["title"], "basic_concept", c["definition"], c["aliases"], refs,
             unresolved_conditions=c["unresolved_conditions"], properties=c.get("properties", {}))

    for c in basic["concepts"]:
        for link in c["prerequisite_links"]:
            editorial.append({"source": c["id"], **link, "use_in_inference": False})
        for link in c["relation_links"]:
            refs = [old_evidence_ids[x] for x in link["evidence_ids"]]
            if not refs:
                editorial.append({"source": c["id"], **link, "use_in_inference": False})
                continue
            predicate = link["relation"]
            if c["id"] in {"peers", "output", "wealth", "authority", "resource"} and link["target"] == "ten_gods":
                predicate = "속한 상위개념"
                refs.append(old_evidence_ids["ten_gods_e2"])
            if c["id"] == "ten_gods" and predicate == "하위군":
                predicate = "하위군을 포함"
            edge(c["id"], predicate, link["target"], refs, scope="definition_or_source_claim")

    cycle_refs = [cite(e) for e in curated["structural_edges"][0]["evidence"]]
    for element in "목화토금수":
        node("element_" + element, element, "element", "오행의 한 범주", refs=cycle_refs)
        edge("element_" + element, "속한 상위개념", "five_elements", cycle_refs)
    for e in curated["structural_edges"]:
        if e["predicate"] in ("생", "극"):
            edge("element_" + e["subject"], e["predicate"], "element_" + e["object"],
                 [cite(x) for x in e["evidence"]], scope="symbolic_relation_within_convention")

    for polarity in ("음", "양"):
        refs = nodes["yin_yang"]["evidence_ids"][:1]
        node("polarity_" + polarity, polarity, "polarity", "음양의 한 측면", refs=refs)
        edge("polarity_" + polarity, "속한 상위개념", "yin_yang", refs)
    stems = nodes["heavenly_stems"]["properties"]["heavenly_stems"]
    for stem in stems:
        refs = [old_evidence_ids[e] for e in stem["evidence_ids"]]
        node(stem["id"], stem["name"], "heavenly_stem", stem["polarity"] + "의 " + stem["element"],
             [stem["hangul"], stem["hanja"]], refs, element=stem["element"], polarity=stem["polarity"])
        for target, predicate in [("heavenly_stems", "속한 상위개념"),
                                  ("element_" + stem["element"], "오행 배속"),
                                  ("polarity_" + stem["polarity"], "음양 배속")]:
            edge(stem["id"], predicate, target, refs)

    family_map = {"비겁": "peers", "식상": "output", "재성": "wealth", "관성": "authority", "인성": "resource"}
    for rule in curated["ten_god_classification_rules"]:
        title, family = rule["then"]["ten_god"], family_map[rule["then"]["family"]]
        refs = [cite(e) for e in rule["evidence"]]
        key = node("ten_god_" + title, title, "ten_god", "일간과의 오행 관계·음양으로 분류하는 십신", refs=refs)
        edge(key, "속한 상위개념", family, refs + [old_evidence_ids["ten_gods_e2"]])
        hyperedges.append({"id": rule["id"], "kind": "symbolic_definition",
            "input_nodes": ["day_master", "heavenly_stems", "generation_control", "yin_yang"],
            "output_node": key, "when": rule["when"], "then": rule["then"],
            "evidence_ids": refs, "scope": rule["scope"], "prediction_of_person": False})

    for char, hanja in zip("자축인묘진사오미신유술해", "子丑寅卯辰巳午未申酉戌亥"):
        refs = nodes["earthly_branches"]["evidence_ids"][:1]
        key = node("branch_" + hanja, char + "(" + hanja + ")", "earthly_branch", "지지의 한 기호", [char, hanja], refs)
        edge(key, "속한 상위개념", "earthly_branches", refs)
    branch_ids = dict(zip("자축인묘진사오미신유술해", ["branch_" + x for x in "子丑寅卯辰巳午未申酉戌亥"]))
    for relation, pairs in curated["branch_pair_lookup"].items():
        for pair in pairs:
            edge(branch_ids[pair["pair"][0]], relation + "쌍", branch_ids[pair["pair"][1]],
                 [cite(x) for x in pair["evidence"]], unordered=True, effect=pair["effect"],
                 automatic_transformation=False, automatic_event_prediction=False)

    conditional = []
    for item in curated["conditional_rule_candidates"]:
        conditional.append({**{k: v for k, v in item.items() if k != "evidence"},
                            "evidence_ids": [cite(x) for x in item["evidence"]], "active_in_probability_model": False})

    bindings = read("provenance_bindings.json")
    siksin_binding = bindings["bindings"]["source:siksin_saengjae_candidate"]
    def collect_evidence(obj):
        result = []
        if isinstance(obj, dict):
            if "quote" in obj and "source_path" in obj:
                result.append(cite(obj))
            else:
                for v in obj.values(): result.extend(collect_evidence(v))
        elif isinstance(obj, list):
            for v in obj: result.extend(collect_evidence(v))
        return result
    refs = collect_evidence(siksin_binding)
    node("candidate_siksin_saengjae", "식신생재", "interpretation_candidate",
         "식신에서 재성으로 이어지는 생성 구조를 살펴보는 후보. 격국 성립·현실 결과는 추가 판단 대상.", refs=refs)
    hyperedges.append({"id": "context_siksin_saengjae", "kind": "contextual_interpretation",
        "input_nodes": ["ten_god_식신", "wealth", "month_command", "rooting", "day_master"],
        "output_node": "candidate_siksin_saengjae", "evidence_ids": refs,
        "source_supported_core": "식신→정재·편재 생성 관계",
        "context_features_to_review": ["strength", "month_command", "rooting", "other_relations", "position", "time_context"],
        "feature_direction_and_magnitude": "not_estimated; requires claim-specific annotation",
        "target_probability": "P(interpretation_candidate | context, time, source_profile)",
        "parameters": None, "status": "needs_training"})

    issues = []
    for issue in curated["source_issues"]:
        issues.append({**{k: v for k, v in issue.items() if k != "evidence"},
                       "evidence_ids": [cite(x) for x in issue["evidence"]]})

    # Keep the board snapshot distinct from the blog evidence and learned values.
    foundation = read("figma_foundation_bindings.json")
    foundation_refs = foundation["bindings"]
    assert len({r["id"] for r in foundation_refs}) == len(foundation_refs)
    assert {r["concept_id"] for r in foundation_refs} == {c["id"] for c in basic["concepts"]}
    assert len(foundation_refs) == len(basic["concepts"])
    for ref in foundation_refs:
        assert ref["coverage"] in {"definition", "explanation", "title_only", "not_found"}
        assert bool(ref["spans"]) == (ref["coverage"] != "not_found")
        nodes[ref["concept_id"]]["foundation_reference_ids"] = [ref["id"]]

    live = read("figma_live_bindings.json")
    live_refs = live["bindings"]
    structure = read("figma_live_structure.json")
    assert structure["source"]["raw_sha256"] == live["source"]["snapshot_sha256"]
    board_ids = {n["id"] for n in structure["nodes"]}
    assert len({r["id"] for r in live_refs}) == len(live_refs)
    assert {r["concept_id"] for r in live_refs} == {c["id"] for c in basic["concepts"]}
    assert len(live_refs) == len(basic["concepts"])
    for ref in live_refs:
        assert ref["coverage"] in {"definition", "explanation", "title_only", "not_found"}
        assert bool(ref["spans"]) == (ref["coverage"] != "not_found")
        assert all(span["node_id"] in board_ids for span in ref["spans"])
        nodes[ref["concept_id"]]["live_foundation_reference_ids"] = [ref["id"]]

    result = {"schema_version": "0.1", "purpose": "context-conditioned probabilistic knowledge model foundation",
        "scope": "18 basic concepts plus directly sourced symbolic components; not full-corpus semantic extraction",
        "nodes": list(nodes.values()), "relations": relations, "hyperedges": hyperedges,
        "conditional_rule_candidates": conditional, "editorial_links": editorial,
        "evidence": list(evidence.values()), "source_issues": issues,
        "foundation_source": foundation["source"],
        "foundation_references": foundation_refs,
        "live_foundation_source": live["source"],
        "live_foundation_references": live_refs,
        "diagram_structure": {"path": "data/figma_live_structure.json",
            "use_in_inference": False, "probability": None,
            "snapshot_sha256": live["source"]["snapshot_sha256"],
            "statistics": structure["statistics"],
            "purpose": "source navigation and attachment inspection; not semantic or probabilistic edges"},
        "context_contract": {"activation": "observed degree in [0,1]; null means unknown, not zero",
            "time": "natal chart, daewoon, yearly/monthly context stored separately with evaluation time",
            "interactions": "explicit factors with 2 or more keywords; do not reduce all to independent pair edges",
            "probability": "conditional on context; no fixed probability inferred from corpus frequency",
            "model_status": "untrained; demonstration parameters must never be silently used as learned ones"},
        "statistics": {"basic_concepts": 18, "nodes": len(nodes), "relations": len(relations),
            "hyperedges": len(hyperedges), "evidence_spans": len(evidence), "editorial_links": len(editorial)}}
    assert len({r["id"] for r in relations}) == len(relations), "Duplicate semantic edge"
    for r in relations:
        assert r["source"] in nodes and r["target"] in nodes
        assert r["evidence_ids"] and all(x in evidence for x in r["evidence_ids"])
    for h in hyperedges:
        assert all(x in nodes for x in h["input_nodes"]) and h["output_node"] in nodes
        assert h["evidence_ids"] and all(x in evidence for x in h["evidence_ids"])
    (ROOT / "knowledge_graph.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["statistics"], ensure_ascii=False))


if __name__ == "__main__":
    build()
