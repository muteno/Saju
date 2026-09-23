"""Measure only the shared 사령부 exclusion; preserve unresolved commander usage.

Uses the frozen F01 corpus and each edition's real builders and taxonomy.
No maps, D5, P2, engine values or training labels are generated.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
import sys

import measure_hidden_stages as shared

REPO = shared.REPO
LEGACY = shared.LEGACY
BASE = "f96a7e2bd8606dd32899164a887a46fc17a9abb4"
SUBJECT = "월률분야·사령"


def load_pair(baseline):
    # The shared loader reads *both* historical builders and their taxonomy.
    # Temporarily select this review's base; never change the previous script.
    old_base = shared.BASE
    try:
        shared.BASE = BASE
        return shared.load_pair(baseline)
    finally:
        shared.BASE = old_base


def measure():
    before, after = load_pair(True), load_pair(False)
    if before[1].TAXONOMY != after[1].TAXONOMY or before[2]["concept_map"] != after[2]["concept_map"]:
        raise ValueError("Unexpected taxonomy or concept-map source change")
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    rows = list(reader.문단들(제목포함=True))
    if not rows or len({r["q"]["para_id"] for r in rows}) != len(rows):
        raise ValueError("Empty corpus or duplicate paragraph IDs")
    previous = json.loads((REPO / "docs/knowledge-model/data/foundation_hidden_stages_measurement.json").read_text())
    corpus_hash = shared.sha(json.dumps([[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
                                        ensure_ascii=False, separators=(",", ":")).encode())
    if len(rows) != previous["corpus_rows"] or corpus_hash != previous["corpus_sha256"]:
        raise ValueError("Corpus differs from the frozen input; review before rebasing")
    for entry in previous["inputs"]:
        if shared.sha((REPO / entry["path"]).read_bytes()) != entry["sha256"]:
            raise ValueError("Input drift: " + entry["path"])
    unchanged = {}
    for path in ("dosa-app/engine/src/tables.js", "docs/knowledge-model/chart_context.mjs"):
        raw = (REPO / path).read_bytes()
        old = subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)
        if shared.sha(raw) != shared.sha(old):
            raise ValueError("Unexpected engine/observation change: " + path)
        unchanged[path] = shared.sha(raw)

    baseline = shared.run_pair(before, rows, reader, "baseline")
    current = shared.run_pair(after, rows, reader, "current")
    changes = {builder: shared.delta(baseline[builder], current[builder]) for builder in baseline}
    expected_removed = {r["q"]["para_id"] for r in rows if "사령부" in r["text"]}
    if len(expected_removed) != 28 or changes["neuron"] or set(changes["concept_map"]) != {SUBJECT}:
        raise ValueError("Unexpected scope/count change")
    change = changes["concept_map"][SUBJECT]
    if change["added_ids"] or set(change["removed_ids"]) != expected_removed:
        raise ValueError("Unexpected removals beyond reviewed HQ occurrences")
    if load_pair(True)[2] != before[2] or load_pair(False)[2] != after[2]:
        raise ValueError("Builder code changed during measurement")

    aliases = ["월률분야", "월령분일용사", "사령", "당령", "인원용사"]
    compounds = ["사령부", "사령관", "사령탑"]
    alias_counts = {a: {"substring_rows": sum(a in r["text"] for r in rows),
                        "substring_occurrences": sum(r["text"].count(a) for r in rows)} for a in aliases}
    raw_probes = {}
    for alias in ("월률분일용사", "월령용사", "月律分野", "司令", "當令", "人元用事"):
        ids = {r["q"]["para_id"] for r in rows if alias in r["text"]}
        raw_probes[alias] = {"applied": False, "substring_rows": len(ids),
                            "currently_unrecalled_rows": {b: len(ids - h[SUBJECT]) for b, h in current.items()}}
    cases = ["CHO-GANJI-P012-05", "CT-P021-08", "HM-P029-04", "PL-YONGSIN-P005-01",
             "PL-SIPSIN-P036-02", "PL-SIPSIN-P038-02", "CHO-STORY-P017-11",
             "T-a8eb288610-0000", "T-a8eb288610-0001", "T-cb20c115de-0000", "T-1bd1f01447-0000",
             "T-5c1fad8dc1-0000", "T-5c1fad8dc1-0001", "T-570ff780cb-0001"]
    by_id = {r["q"]["para_id"]: r for r in rows}
    if not set(cases) <= by_id.keys():
        raise ValueError("Reviewed source paragraph missing")
    reviewed = {pid: {"file": by_id[pid]["post"].get("file"),
                      "before": {b: pid in h[SUBJECT] for b, h in baseline.items()},
                      "after": {b: pid in h[SUBJECT] for b, h in current.items()}} for pid in cases}
    # Broad compound deletion is only a diagnostic: it loses commander metaphors.
    compound_ids = {r["q"]["para_id"] for r in rows if re.search("사령부|사령관|사령탑", r["text"])}
    subjects = [SUBJECT, "지장간", "여기·중기·정기", "월지", "일지", "일간"]
    return {
        "schema_version": 1, "base_commit": BASE,
        "scope": "Legacy topic retrieval: only HQ substring exclusion shared; commander metaphors held",
        "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
        "title_included": True, "gist_included": False,
        "independent_evidence_count": None, "probability": None, "training_labels": False,
        "actual_alias_additions": [], "actual_alias_removals": [],
        "code": {"before": before[2], "after": after[2], "unchanged": unchanged},
        "measurement_sha256": shared.sha(Path(__file__).read_bytes()),
        "measurement_dependencies": [{"path": Path(shared.__file__).relative_to(REPO).as_posix(),
                                       "sha256": shared.sha(Path(shared.__file__).read_bytes())}],
        "counts": {label: {b: {c: len(h[c]) for c in subjects} for b, h in pairs.items()}
                   for label, pairs in (("before", baseline), ("after", current))},
        "actual_concept_assignment_changes": changes,
        "alias_occurrences": alias_counts, "unregistered_spellings": raw_probes,
        "compound_rows": {a: sum(a in r["text"] for r in rows) for a in compounds},
        "whole_paragraph_exclusion_probe": {"applied": False, "rows": len(compound_ids),
            "currently_retrieved_neuron_ids_that_would_be_lost": sorted(compound_ids & current["neuron"][SUBJECT])},
        "reviewed_cases": reviewed,
        "remaining_builder_differences": {
            "neuron_only_ids": sorted(current["neuron"][SUBJECT] - current["concept_map"][SUBJECT]),
            "concept_map_only_ids": sorted(current["concept_map"][SUBJECT] - current["neuron"][SUBJECT])},
        "inputs": previous["inputs"], "corpus_sha256": corpus_hash,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"counts": result["counts"], "changes": result["actual_concept_assignment_changes"],
                      "compound_rows": result["compound_rows"]}, ensure_ascii=False))
