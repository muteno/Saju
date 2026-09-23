"""Audit rooting retrieval and simulate the six withheld local aliases.

This does not edit/publish the taxonomy, maps, D5, P2 or app. Run after
build_dashboard.merge() and ingest_transcripts.py regenerate the ignored corpus:
  python3 docs/knowledge-model/measure_rooting.py --output /tmp/rooting.json
Counts are retrieval assignments, including repeated sources, not accuracy or
independent evidence. The long-alias probe demonstrates component masking only.
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
BASE = "ec26ac92834a7df3c21dd6b7a07dd26c85cb6dfc"
CANDIDATES = ["뿌리 없", "뿌리가", "뿌리는", "뿌리도", "뿌리로", "뿌리를"]


def sha(raw):
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def load_builder(name):
    path = LEGACY / (name + ".py")
    raw = path.read_bytes()
    baseline = subprocess.check_output(
        ["git", "show", f"{BASE}:{path.relative_to(REPO).as_posix()}"], cwd=REPO)
    if sha(raw) != sha(baseline):
        raise ValueError("Builder changed; audit baseline must be reviewed again")
    module = ModuleType(name + "_rooting_audit")
    module.__file__ = str(path)
    exec(compile(raw, str(path), "exec"), module.__dict__)
    return module, sha(raw)


def add_neuron_aliases(builder, aliases):
    # Only an isolated module instance is changed, never the source file.
    for alias in aliases:
        builder.alias2concept.setdefault(alias, set()).add("통근")
    builder.ALIASES = sorted(builder.alias2concept, key=len, reverse=True)
    builder.ALIAS_RE = re.compile("|".join(re.escape(a) for a in builder.ALIASES))


def delta(before, after):
    return {c: {"before": len(before.get(c, set())), "after": len(after.get(c, set())),
                "added_ids": sorted(after.get(c, set()) - before.get(c, set())),
                "removed_ids": sorted(before.get(c, set()) - after.get(c, set()))}
            for c in sorted(set(before) | set(after))
            if before.get(c, set()) != after.get(c, set())}


def measure():
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    rows = list(reader.문단들(제목포함=True))
    if not rows:
        raise ValueError("Empty corpus; regenerate the documented inputs first")
    ids = [r["q"]["para_id"] for r in rows]
    if len(set(ids)) != len(ids):
        raise ValueError("Repeated paragraph IDs would hide changes in set counts")
    neuron, neuron_hash = load_builder("build_neuron_map")
    proposed, _ = load_builder("build_neuron_map")
    cmap, cmap_hash = load_builder("build_concept_map")
    old_taxonomy = deepcopy(cmap.TAXONOMY)
    add_neuron_aliases(proposed, CANDIDATES)

    old_neuron, new_neuron = defaultdict(set), defaultdict(set)
    for row in rows:
        for builder, target in ((neuron, old_neuron), (proposed, new_neuron)):
            for concept in builder.concepts_in(row["text"]):
                target[concept].add(row["q"]["para_id"])
    print("neuron: current vs withheld-six simulation complete", flush=True)

    mapped = []
    with patch.object(reader, "문단들", lambda **kwargs: iter(rows)):
        for stage in ("current", "hypothetical_six_aliases"):
            if stage != "current":
                for groups in cmap.TAXONOMY.values():
                    for concepts in groups.values():
                        if "통근" in concepts:
                            concepts["통근"].extend(CANDIDATES)
            built, _, n = cmap.build()
            if n != len(rows):
                raise ValueError("Corpus changed between comparisons")
            mapped.append({name: {q["para_id"] for q, _ in hits}
                           for groups in built.values() for concepts in groups.values()
                           for name, hits in concepts.items()})
            print(f"concept map: {stage} complete", flush=True)
    cmap.TAXONOMY = old_taxonomy

    probe, _ = load_builder("build_neuron_map")
    add_neuron_aliases(probe, ["일지의 뿌리가"])
    probe_text = "그런데 일지의 뿌리가 있잖아요"
    alias_counts = {}
    for alias in CANDIDATES:
        hits = {r["q"]["para_id"] for r in rows if alias in r["text"]}
        alias_counts[alias] = {
            "substring_rows": len(hits),
            "substring_occurrences": sum(r["text"].count(alias) for r in rows),
            "potential_added_neuron_ids": sorted(hits - old_neuron["통근"]),
            "potential_added_concept_map_ids": sorted(hits - mapped[0]["통근"]),
            "applied": False,
        }
    inputs = ["build_dashboard.py", "ingest_transcripts.py", "코퍼스.py",
              "data/posts_all.jsonl", "data/paras_all.jsonl",
              "data/전사_글.jsonl", "data/전사_문단.jsonl"]
    return {
        "schema_version": 1, "base_commit": BASE,
        "scope": "Read-only retrieval audit; hypothetical changes were not applied",
        "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
        "title_included": True, "gist_included": False,
        "independent_evidence_count": None, "probability": None, "training_labels": False,
        "code": {"neuron_sha256": neuron_hash, "concept_map_sha256": cmap_hash,
                 "measurement_sha256": sha(Path(__file__).read_bytes())},
        "inputs": [{"path": (LEGACY / p).relative_to(REPO).as_posix(),
                    "sha256": sha((LEGACY / p).read_bytes())} for p in inputs],
        "corpus_sha256": sha(json.dumps(
            [[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
            ensure_ascii=False, separators=(",", ":")).encode()),
        "actual_applied_aliases": [], "production_builder_change": False,
        "current_rooting_assignments": {"neuron": len(old_neuron["통근"]),
                                        "concept_map": len(mapped[0]["통근"])},
        "candidate_aliases": alias_counts,
        "hypothetical_six_aliases": {"neuron": delta(old_neuron, new_neuron),
                                      "concept_map": delta(*mapped)},
        "hypothetical_long_alias_probe": {
            "text": probe_text, "alias": "일지의 뿌리가", "applied": False,
            "neuron_before": sorted(neuron.concepts_in(probe_text)),
            "neuron_after": sorted(probe.concepts_in(probe_text)),
            "lost_components": sorted(neuron.concepts_in(probe_text) - probe.concepts_in(probe_text)),
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"current": result["current_rooting_assignments"],
                      "hypothetical": {k: {c: [v["before"], v["after"]] for c, v in d.items()}
                                       for k, d in result["hypothetical_six_aliases"].items()},
                      "probe": result["hypothetical_long_alias_probe"]}, ensure_ascii=False))
