"""Audit unchanged exposure/hidden-stem retrieval and hypothetical 암장 removal.

Regenerate the documented corpus first, then run:
  python3 docs/knowledge-model/measure_exposure_hidden.py --output /tmp/exposure.json
No source, map, P2, D5 or app data is written. Counts are not semantic labels.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from types import ModuleType
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
LEGACY = REPO / "정제/_현황판"
BASE = "cef1307c673342147afbf74b5996f99a7036864e"
SUBJECTS = ("투간·투출", "지장간")
CODE_PATHS = ["정제/_현황판/build_neuron_map.py", "정제/_현황판/build_concept_map.py",
              "dosa-app/engine/src/tables.js", "docs/knowledge-model/chart_context.mjs"]


def sha(raw):
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def unchanged_code():
    result = {}
    for path in CODE_PATHS:
        before = subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)
        after = (REPO / path).read_bytes()
        if sha(before) != sha(after):
            raise ValueError(f"Runtime changed; this preservation audit no longer applies: {path}")
        result[path] = {"before": sha(before), "after": sha(after)}
    return result


def load_pair():
    # Both source files and the taxonomy are current and byte-equivalent to BASE.
    modules = []
    for name in ("build_neuron_map", "build_concept_map"):
        path = LEGACY / (name + ".py")
        module = ModuleType(name + "_exposure_audit")
        module.__file__ = str(path)
        exec(compile(path.read_bytes(), str(path), "exec"), module.__dict__)
        modules.append(module)
    neuron, cmap = modules
    cmap._bnm = neuron
    if neuron.TAXONOMY != cmap.TAXONOMY:
        raise ValueError("Builders loaded different taxonomies")
    return neuron, cmap


def remove_amjang(pair):
    neuron, cmap = pair
    for module in pair:
        for groups in module.TAXONOMY.values():
            for concepts in groups.values():
                if "지장간" in concepts:
                    concepts["지장간"].remove("암장")
    neuron.alias2concept["암장"].remove("지장간")
    if not neuron.alias2concept["암장"]:
        del neuron.alias2concept["암장"]
    neuron.ALIASES = sorted(neuron.alias2concept, key=len, reverse=True)
    neuron.ALIAS_RE = re.compile("|".join(re.escape(a) for a in neuron.ALIASES))


def run_pair(pair, rows, reader, label):
    neuron, cmap = pair
    hits = defaultdict(set)
    for row in rows:
        for concept in neuron.concepts_in(row["text"]):
            hits[concept].add(row["q"]["para_id"])
    with patch.object(reader, "문단들", lambda **kwargs: iter(rows)):
        built, _, count = cmap.build()
    if count != len(rows):
        raise ValueError("Corpus size mismatch")
    cmap_hits = {name: {q["para_id"] for q, _ in matches}
                 for groups in built.values() for concepts in groups.values()
                 for name, matches in concepts.items()}
    print(f"{label}: both builders complete", flush=True)
    return {"neuron": hits, "concept_map": cmap_hits}


def changes(before, after):
    return {concept: {"before": len(before.get(concept, set())),
                      "after": len(after.get(concept, set())),
                      "added_ids": sorted(after.get(concept, set()) - before.get(concept, set())),
                      "removed_ids": sorted(before.get(concept, set()) - after.get(concept, set()))}
            for concept in sorted(set(before) | set(after))
            if before.get(concept, set()) != after.get(concept, set())}


def measure():
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    code = unchanged_code()
    rows = list(reader.문단들(제목포함=True))
    if not rows or len({r["q"]["para_id"] for r in rows}) != len(rows):
        raise ValueError("Empty corpus or duplicate paragraph IDs")
    current_pair = load_pair()
    hypothetical = load_pair()
    remove_amjang(hypothetical)
    current = run_pair(current_pair, rows, reader, "current_equals_base")
    without = run_pair(hypothetical, rows, reader, "hypothetical_without_amjang")
    if unchanged_code() != code:
        raise ValueError("Runtime changed during measurement")
    alias_counts = {}
    for alias in ("투간", "투출", "透出", "透干", "지장간", "지장 간", "地藏干", "암장"):
        found = [r for r in rows if alias in r["text"]]
        alias_counts[alias] = {"rows": len(found), "occurrences": sum(r["text"].count(alias) for r in found)}
    spelling_ids = {r["q"]["para_id"] for r in rows if "透干" in r["text"]}
    cases = {"hidden_amjang_transcript": "T-314074aef2-0001",
             "hidden_amjang_metaphor": "T-74cd923110-0001",
             "hidden_amjang_transcription": "T-84dac440c0-0000"}
    known_ids = {r["q"]["para_id"] for r in rows}
    if not set(cases.values()) <= known_ids:
        raise ValueError("Reviewed paragraphs missing")
    inputs = ["build_dashboard.py", "ingest_transcripts.py", "코퍼스.py",
              "data/posts_all.jsonl", "data/paras_all.jsonl", "data/전사_글.jsonl", "data/전사_문단.jsonl"]
    return {
        "schema_version": 1, "base_commit": BASE,
        "scope": "Existing topic retrieval preserved; alias removal is hypothetical only",
        "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
        "title_included": True, "gist_included": False,
        "independent_evidence_count": None, "probability": None, "training_labels": False,
        "actual_alias_additions": [], "actual_alias_removals": [],
        "actual_concept_assignment_changes": {"neuron": {}, "concept_map": {}},
        "actual_no_change_basis": "Same code, taxonomy and frozen input; current run is also the baseline run",
        "code": code, "measurement_sha256": sha(Path(__file__).read_bytes()),
        "current_counts": {b: {c: len(h[c]) for c in SUBJECTS} for b, h in current.items()},
        "current_builder_differences": {c: {"neuron_only_ids": sorted(current["neuron"][c] - current["concept_map"][c]),
                                            "concept_map_only_ids": sorted(current["concept_map"][c] - current["neuron"][c])}
                                        for c in SUBJECTS},
        "alias_occurrences": alias_counts,
        "unregistered_spelling": {"alias": "透干", "applied": False,
                                  "containing_ids": sorted(spelling_ids),
                                  "currently_unrecalled_ids": {b: sorted(spelling_ids - h["투간·투출"])
                                                               for b, h in current.items()}},
        "hypothetical_without_amjang": {b: changes(current[b], without[b]) for b in current},
        "reviewed_cases": {eid: {"para_id": pid,
                                  "current_hidden_hits": {b: pid in h["지장간"] for b, h in current.items()},
                                  "without_amjang_hidden_hits": {b: pid in h["지장간"] for b, h in without.items()}}
                           for eid, pid in cases.items()},
        "inputs": [{"path": (LEGACY / p).relative_to(REPO).as_posix(), "sha256": sha((LEGACY / p).read_bytes())}
                   for p in inputs],
        "corpus_sha256": sha(json.dumps([[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
                                        ensure_ascii=False, separators=(",", ":")).encode()),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"current": result["current_counts"], "hypothetical": {
        b: {c: [v["before"], v["after"]] for c, v in diff.items()}
        for b, diff in result["hypothetical_without_amjang"].items()}}, ensure_ascii=False))
