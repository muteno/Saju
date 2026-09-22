"""Import legacy conditions for source review, never as rules or probabilities.

Run from any directory: python legacy_import.py
Only the bundled DOCX archives are searched. Unavailable transcript/board sources
remain explicit review items; old paragraph IDs are retained, not re-certified.
"""
import argparse
from bisect import bisect_right
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

from build_corpus import source_units

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LEGACY = Path("정제/_현황판/data")
INPUTS = ("조건부간선.jsonl", "조건부간선_수기.jsonl", "분기간선.jsonl")
# Archive labels are not independent authors. Two old labels refer to one site.
SOURCE_PROFILES = {
    "웹:초코서당": "chocosd.com", "웹:현묘": "yavares.tistory.com",
    "웹:안녕,사주명리(현묘)": "yavares.tistory.com",
    "웹:명리학탐구": "saju.sajuplus.net", "웹:플러스명리학": "saju.sajuplus.net",
    "웹:사공": "www.sajustudy.com", "웹:도화로운": "dohwaroun.com",
}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def identity(prefix, value):
    return prefix + digest(json.dumps(value, ensure_ascii=False, sort_keys=True).encode())[:20]


def graph_fingerprint(graph):
    return digest(json.dumps(graph, ensure_ascii=False, sort_keys=True).encode())


def read_rows(path):
    return [(i, json.loads(line)) for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
            if line.strip()]


def map_concept(label, graph):
    """Conservative explicit identity mapping; no fuzzy or broad alias matching."""
    special = {"오행(총칭)": "five_elements", "십성(총칭)": "ten_gods",
               "천간(총칭)": "heavenly_stems", "지지(총칭)": "earthly_branches",
               "비겁 일반": "peers", "식상 일반": "output", "재성 일반": "wealth",
               "관성 일반": "authority", "인성 일반": "resource", "편관(칠살)": "ten_god_편관"}
    ids = {node["id"] for node in graph["nodes"]}
    if label in special:
        return special[label] if special[label] in ids else None
    symbol = re.fullmatch(r".+\(([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水])\)", label)
    if symbol:
        char = symbol[1]
        key = ("stem_" + char if char in "甲乙丙丁戊己庚辛壬癸" else
               "branch_" + char if char in "子丑寅卯辰巳午未申酉戌亥" else
               "element_" + dict(zip("木火土金水", "목화토금수"))[char])
        return key if key in ids else None
    # In particular, 월지 is not silently identified with the graph alias 월령.
    matches = [n["id"] for n in graph["nodes"] if n["title"] == label]
    return matches[0] if len(matches) == 1 else None


def load_archives(repo):
    documents, manifests = [], []
    inventory = json.loads((repo / "docs/knowledge-model/corpus_inventory.json").read_text(encoding="utf-8"))
    expected = {Path(d["path"]).name: d["sha256"] for d in inventory["documents"] if d["path"].endswith(".docx")}
    paths = sorted((repo / "정제본").glob("*.docx"))
    if {p.name for p in paths} != set(expected):
        raise ValueError("DOCX archive set differs from corpus_inventory.json; restore or review the inventory")
    for path in paths:
        source_hash = digest(path.read_bytes())
        if source_hash != expected[path.name]:
            raise ValueError(f"DOCX archive hash differs from corpus_inventory.json: {path.name}")
        rows = source_units(path)
        header = next((r["text"] for r in rows[:8] if r["text"].startswith("출처:")), "")
        profiles = [p for p in set(SOURCE_PROFILES.values()) if f"({p})" in header]
        profile = profiles[0] if len(profiles) == 1 else None
        manifest = {"path": path.relative_to(repo).as_posix(), "sha256": source_hash,
                    "source_profile": profile, "archive_header": header}
        manifests.append(manifest)
        offsets, offset = [], 0
        for row in rows:
            offsets.append(offset)
            offset += len(row["text"]) + 1
        documents.append({**manifest, "rows": rows, "offsets": offsets,
                          "text": "\n".join(r["text"] for r in rows)})
    return documents, manifests


def find_evidence(anchor, profile, documents):
    """Exact text only; multiple copies stay visible and never increase a score."""
    if not anchor or not profile:
        return []
    evidence = []
    for doc in documents:
        if doc["source_profile"] != profile:
            continue
        start = doc["text"].find(anchor)
        while start >= 0:
            end = start + len(anchor)
            first = bisect_right(doc["offsets"], start) - 1
            last = bisect_right(doc["offsets"], end - 1) - 1
            record = {"source_path": doc["path"], "source_sha256": doc["sha256"],
                      "source_profile": profile, "archive_header": doc["archive_header"],
                      "locator_kind": "ooxml_paragraph_1based_including_table_paragraphs",
                      "start": int(doc["rows"][first]["locator"].split("P")[1]),
                      "end": int(doc["rows"][last]["locator"].split("P")[1]),
                      "quote": anchor, "paragraph_text": "\n".join(r["text"] for r in doc["rows"][first:last+1]),
                      "character_offset_in_extracted_document": start,
                      "verification": "exact_anchor_in_archive_not_legacy_paragraph_id"}
            record["id"] = identity("legacy_evidence_", record)
            evidence.append(record)
            start = doc["text"].find(anchor, end)
    return evidence


def convert_record(row, source_file, line, graph, documents):
    branching = "분기간선" in source_file
    if branching:
        labels = sorted(set(row["전체개념"]) | set(row["분기A"]["개념"]) | set(row["분기B"]["개념"]))
        condition = {"sentence": row["문장"], "branches": [row["분기A"], row["분기B"]],
                     "shared_concepts": row["공통개념"], "branch_logic": "unreviewed_not_assumed_exclusive"}
        anchor, anchor_kind = row["문장"], "legacy_sentence"
    else:
        labels = sorted({row["a"], row["b"]})
        condition = {"source_concept": row["a"], "target_concept": row["b"],
                     "clause": row["조건절"], "tags": row["조건"],
                     "presence_or_absence": row["조건극성"], "relation_polarity": row["polarity"],
                     "direction": row["dir"], "legacy_relation_kind": row.get("수기관계", row["kind"])}
        anchor = row.get("검증구", row["조건절"])
        anchor_kind = "manual_anchor_not_verbatim_condition" if row.get("수기") else "legacy_clause"
    profile = SOURCE_PROFILES.get(row["출처처"])
    evidence = find_evidence(anchor, profile, documents)
    mappings = [{"legacy_label": label, "concept_id": map_concept(label, graph)} for label in labels]
    status = ("literal_anchor_found" if evidence else "anchor_not_found_in_available_archives" if profile
              else "source_not_available_in_import_scope")
    item = {"kind": "branch_candidate" if branching else "conditional_candidate",
            "legacy_para_id": row["para_id"], "legacy_source_label": row["출처처"],
            "source_profile": profile, "concept_mappings": mappings, "condition": condition,
            "anchor": anchor, "anchor_kind": anchor_kind,
            "source_status": status, "evidence_ids": [e["id"] for e in evidence],
            "semantic_status": "needs_review", "application_status": "not_evaluated",
            "active_in_probability_model": False, "probability": None,
            "evidence_group": identity("legacy_group_", [profile or row["출처처"], row["para_id"]]),
            "review_reasons": ["condition_meaning_scope_and_exceptions_not_verified",
                               "legacy_paragraph_id_not_resolved"]}
    if anchor_kind == "manual_anchor_not_verbatim_condition":
        item["review_reasons"].append("manual_condition_paraphrase_requires_review")
    if any(m["concept_id"] is None for m in mappings):
        item["review_reasons"].append("unmapped_concepts")
    if not evidence:
        item["review_reasons"].append(status)
    item["id"] = identity("legacy_candidate_", [item["kind"], row["para_id"], row["출처처"], condition])
    item["legacy_records"] = [{"path": source_file, "line": line, "legacy_id": row.get("간선id"),
                               "record_sha256": digest(json.dumps(row, ensure_ascii=False, sort_keys=True).encode())}]
    return item, evidence


def build(repo=REPO):
    graph_path = repo / "docs/knowledge-model/knowledge_graph.json"
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    documents, archives = load_archives(repo)
    candidates, evidence, inputs, counts = {}, {}, [], {}
    for name in INPUTS:
        path = repo / LEGACY / name
        rows = read_rows(path)
        counts[name] = len(rows)
        inputs.append({"path": path.relative_to(repo).as_posix(), "sha256": digest(path.read_bytes()), "rows": len(rows)})
        for line, row in rows:
            item, spans = convert_record(row, path.relative_to(repo).as_posix(), line, graph, documents)
            if item["id"] in candidates:
                candidates[item["id"]]["legacy_records"].extend(item["legacy_records"])
            else:
                candidates[item["id"]] = item
            evidence.update({e["id"]: e for e in spans})
    catalog = [{"legacy_label": row["concept"], "concept_id": map_concept(row["concept"], graph)}
               for _, row in read_rows(repo / LEGACY / "정의카드.jsonl")]
    for name in ("정의카드.jsonl", "링크망.jsonl"):
        path = repo / LEGACY / name
        inputs.append({"path": path.relative_to(repo).as_posix(), "sha256": digest(path.read_bytes()),
                       "rows": len(read_rows(path))})
    records = sorted(candidates.values(), key=lambda r: r["id"])
    return {"schema_version": 1, "graph_sha256": digest(graph_path.read_bytes()),
            "graph_fingerprint": graph_fingerprint(graph),
            "policy": {"use_in_inference": False, "probability": None,
                       "legacy_weights_imported": False, "cooccurrence_edges_imported": False,
                       "all_candidates_require_semantic_review": True,
                       "independence": "Group by source profile and legacy paragraph; no counts become probability.",
                       "source_scope": f"{len(archives)} repository DOCX archives; transcript/board originals outside this import scope"},
            "inputs": inputs, "archives": archives, "concept_catalog": catalog,
            "candidates": records, "evidence": sorted(evidence.values(), key=lambda r: r["id"]),
            "summary": {"input_records": sum(counts.values()), "input_counts": counts,
                        "unique_candidates": len(records), "duplicates_collapsed": sum(counts.values())-len(records),
                        "source_status": dict(Counter(r["source_status"] for r in records)),
                        "legacy_concepts": len(catalog),
                        "mapped_concepts": sum(c["concept_id"] is not None for c in catalog),
                        "mapped_candidates": sum(any(m["concept_id"] for m in r["concept_mappings"]) for r in records),
                        "unique_evidence_spans": len(evidence),
                        "legacy_evidence_groups": len({r["evidence_group"] for r in records}),
                        "active_probability_rules": 0}}


def review_context(node_id, bundle):
    candidates = [item for item in bundle["candidates"]
                  if any(m["concept_id"] == node_id for m in item["concept_mappings"])]
    refs = {ref for item in candidates for ref in item["evidence_ids"]}
    return {"use_in_inference": False, "application_status": "not_evaluated", "probability": None,
            "candidates": candidates, "evidence": [e for e in bundle["evidence"] if e["id"] in refs]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare generated output with the committed snapshot")
    args = parser.parse_args()
    result = build()
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    output = ROOT / "data/legacy_review.json"
    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != rendered:
            raise SystemExit("Legacy review snapshot is missing or stale; run legacy_import.py")
    else:
        output.write_text(rendered, encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
