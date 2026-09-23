"""Compare F01 climate/control candidates and the bounded production change.

Run after the documented corpus regeneration:
  python3 docs/knowledge-model/measure_climate_control.py --output /tmp/climate.json
The baseline uses both Git source files and the baseline taxonomy. Hypothetical
aliases only enter isolated modules. No maps, D5, P2 or app data are published.
"""
import argparse
from collections import Counter, defaultdict
from copy import deepcopy
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
BASE = "cacd81db0d3abb1261439b71c7052481c58d8621"
CLIMATE = ["더위", "덥습니다", "따뜻한 기운", "추위", "춥다", "춥습니다", "한난", "한난조습"]
CONTROL = ["극을 하", "극하는 오행", "극하니까", "극합니다"]
APPLIED = ["극을 하", "극하니까", "극합니다"]


def sha(raw):
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def source(name, baseline):
    path = LEGACY / (name + ".py")
    return (subprocess.check_output(["git", "show", f"{BASE}:{path.relative_to(REPO).as_posix()}"], cwd=REPO)
            if baseline else path.read_bytes())


def load_pair(baseline):
    raw_cmap = source("build_concept_map", baseline)
    raw_neuron = source("build_neuron_map", baseline)
    read_text = Path.read_text

    def read_taxonomy(path, *args, **kwargs):
        if path.resolve() == LEGACY / "build_concept_map.py":
            return raw_cmap.decode("utf-8")
        return read_text(path, *args, **kwargs)

    modules = []
    with patch.object(Path, "read_text", read_taxonomy):
        for name, raw in (("build_neuron_map", raw_neuron), ("build_concept_map", raw_cmap)):
            module = ModuleType(name + ("_baseline" if baseline else "_current"))
            module.__file__ = str(LEGACY / (name + ".py"))
            exec(compile(raw, module.__file__, "exec"), module.__dict__)
            modules.append(module)
    neuron, cmap = modules
    cmap._bnm = neuron  # Never bind old concept-map code to the current gate.
    if neuron.TAXONOMY != cmap.TAXONOMY:
        raise ValueError("The two builders loaded different taxonomies")
    return neuron, cmap, {"neuron": sha(raw_neuron), "concept_map": sha(raw_cmap)}


def extend(pair, concept, aliases):
    neuron, cmap, _ = pair
    for builder in (neuron, cmap):
        for groups in builder.TAXONOMY.values():
            for concepts in groups.values():
                if concept in concepts:
                    concepts[concept].extend(aliases)
    for alias in aliases:
        neuron.alias2concept.setdefault(alias, set()).add(concept)
    neuron.ALIASES = sorted(neuron.alias2concept, key=len, reverse=True)
    neuron.ALIAS_RE = re.compile("|".join(re.escape(a) for a in neuron.ALIASES))


def delta(before, after):
    return {c: {"before": len(before.get(c, set())), "after": len(after.get(c, set())),
                "added_ids": sorted(after.get(c, set()) - before.get(c, set())),
                "removed_ids": sorted(before.get(c, set()) - after.get(c, set()))}
            for c in sorted(set(before) | set(after)) if before.get(c, set()) != after.get(c, set())}


def run_pair(pair, rows, reader, label):
    neuron, cmap, _ = pair
    neuron_hits = defaultdict(set)
    for row in rows:
        for concept in neuron.concepts_in(row["text"]):
            neuron_hits[concept].add(row["q"]["para_id"])
    with patch.object(reader, "문단들", lambda **kwargs: iter(rows)):
        built, _, n = cmap.build()
    if n != len(rows):
        raise ValueError("Corpus changed")
    cmap_hits = {name: {q["para_id"] for q, _ in matches}
                 for groups in built.values() for concepts in groups.values() for name, matches in concepts.items()}
    print(f"{label}: both builders complete", flush=True)
    return {"neuron": neuron_hits, "concept_map": cmap_hits}


def measure():
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    rows = list(reader.문단들(제목포함=True))
    if not rows or len({r["q"]["para_id"] for r in rows}) != len(rows):
        raise ValueError("Empty corpus or duplicate paragraph IDs")
    before = load_pair(True)
    after = load_pair(False)
    # A baseline neuron module normally reads the current taxonomy from disk.
    # Check that the patched reader actually prevented that contamination.
    if "상극" in before[0].concepts_in("금은 목을 극합니다."):
        raise ValueError("Baseline contains a new alias")
    expected_old = deepcopy(after[1].TAXONOMY)
    for groups in expected_old.values():
        for concepts in groups.values():
            if "상극" in concepts:
                for alias in APPLIED:
                    concepts["상극"].remove(alias)
    if expected_old != before[1].TAXONOMY:
        raise ValueError("Taxonomy delta is not exactly the three reviewed phrases")

    result = {
        "schema_version": 1, "base_commit": BASE,
        "scope": "Legacy topic retrieval; hypothetical candidates are not production changes",
        "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
        "title_included": True, "gist_included": False,
        "independent_evidence_count": None, "probability": None, "training_labels": False,
        "actual_applied_aliases": {"조후 균형": [], "상극": APPLIED},
        "code": {"before": before[2], "after": after[2],
                 "measurement_sha256": sha(Path(__file__).read_bytes())},
        "candidate_occurrences": {}, "comparisons": {},
    }
    for concept, aliases in (("조후 균형", CLIMATE), ("상극", CONTROL)):
        result["candidate_occurrences"][concept] = {}
        for alias in aliases:
            boundary = re.compile(r"(?<!\w)" + re.escape(alias))
            matches = [r for r in rows if alias in r["text"]]
            entry = {"substring_rows": len(matches),
                     "substring_occurrences": sum(r["text"].count(alias) for r in matches),
                     "applied": concept == "상극" and alias in APPLIED}
            if concept == "상극":
                entry["left_boundary_rows"] = sum(bool(boundary.search(r["text"])) for r in matches)
                entry["word_internal_only_ids"] = sorted(r["q"]["para_id"] for r in matches
                                                         if not boundary.search(r["text"]))
            result["candidate_occurrences"][concept][alias] = entry

    baseline_hits = run_pair(before, rows, reader, "baseline")
    concepts = ("조후 균형", "한난조습", "조후용신", "상극", "오행(총칭)")
    result["baseline_counts"] = {b: {c: len(h[c]) for c in concepts} for b, h in baseline_hits.items()}
    actual_hits = run_pair(after, rows, reader, "actual_bounded_control")
    result["comparisons"]["actual_bounded_control"] = {
        b: delta(baseline_hits[b], actual_hits[b]) for b in baseline_hits}
    for changes in result["comparisons"]["actual_bounded_control"].values():
        if set(changes) != {"상극"} or changes["상극"]["removed_ids"]:
            raise ValueError("Unexpected production concept loss or unrelated change")

    for label, concept, aliases in (("hypothetical_climate_eight", "조후 균형", CLIMATE),
                                     ("hypothetical_control_four_unguarded", "상극", CONTROL)):
        candidate = load_pair(True)
        extend(candidate, concept, aliases)
        hits = run_pair(candidate, rows, reader, label)
        result["comparisons"][label] = {b: delta(baseline_hits[b], hits[b]) for b in baseline_hits}
        if concept == "상극":
            text = "극하는 오행"
            result["long_alias_probe"] = {
                "text": text, "applied": False,
                "neuron_baseline": sorted(before[0].concepts_in(text)),
                "neuron_actual": sorted(after[0].concepts_in(text)),
                "neuron_hypothetical_four": sorted(candidate[0].concepts_in(text)),
            }

    inputs = ["build_dashboard.py", "ingest_transcripts.py", "코퍼스.py",
              "data/posts_all.jsonl", "data/paras_all.jsonl", "data/전사_글.jsonl", "data/전사_문단.jsonl"]
    result["inputs"] = [{"path": (LEGACY / p).relative_to(REPO).as_posix(),
                         "sha256": sha((LEGACY / p).read_bytes())} for p in inputs]
    result["corpus_sha256"] = sha(json.dumps(
        [[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
        ensure_ascii=False, separators=(",", ":")).encode())
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({scenario: {builder: {concept: [v["before"], v["after"]]
                                         for concept, v in changes.items()}
                                 for builder, changes in builders.items()}
                      for scenario, builders in result["comparisons"].items()}, ensure_ascii=False))
