"""Reproduce F01 general-term retrieval measurements, without publishing maps.

Run from the repository after regenerating the ignored corpus if needed:
  python docs/knowledge-model/measure_general_terms.py --output /tmp/general.json
The immutable baseline commit must be available in Git. Counts are retrieval
assignments, not independent evidence, subtype labels, or accuracy estimates.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from types import ModuleType

REPO = Path(__file__).resolve().parents[2]
LEGACY = REPO / "정제/_현황판"
BASE = "5a6e4cd8ad02a54a5ac7e0b09664c4e237630bb4"


def sha(raw):
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def load_builder(name, baseline=False):
    path = LEGACY / (name + ".py")
    raw = (subprocess.check_output(["git", "show", f"{BASE}:{path.relative_to(REPO).as_posix()}"], cwd=REPO)
           if baseline else path.read_bytes())
    module = ModuleType(name + ("_before" if baseline else "_after"))
    module.__file__ = str(path)
    exec(compile(raw, str(path), "exec"), module.__dict__)
    return module, sha(raw)


def measure():
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as corpus_reader
    rows = list(corpus_reader.문단들(제목포함=True))
    if not rows:
        raise ValueError("Empty generated corpus; regenerate build_dashboard/ingest_transcripts inputs first")
    before, before_hash = load_builder("build_neuron_map", True)
    after, after_hash = load_builder("build_neuron_map")
    cmap_before, cmap_before_hash = load_builder("build_concept_map", True)
    cmap_after, cmap_after_hash = load_builder("build_concept_map")
    if before.TAXONOMY != cmap_before.TAXONOMY or before.TAXONOMY != after.TAXONOMY or before.TAXONOMY != cmap_after.TAXONOMY:
        raise ValueError("This narrow experiment requires the exact baseline taxonomy")
    # Old concept-map source normally imports the live matcher; bind its exact
    # baseline instead. Both builders consume this same frozen list of rows.
    cmap_before._bnm = before
    result = {"schema_version": 1, "measured_on": "2026-09-23", "base_commit": BASE,
              "scope": "Legacy retrieval only; no generated map, P2, D5 or app publication",
              "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
              "independent_evidence_count": None, "probability": None, "training_labels": False,
              "taxonomy_unchanged": True, "builders": {}, "candidate_aliases": {},
              "code": {"neuron_before": before_hash, "neuron_after": after_hash,
                       "concept_map_before": cmap_before_hash, "concept_map_after": cmap_after_hash}}
    aliases = [word + ending for word in ("합", "충") for ending in ("을 하", "을 해", "이 돼", "이 되")]
    for alias in aliases:
        raw = re.compile(re.escape(alias))
        boundary = re.compile(r"(?<!\w)" + re.escape(alias))
        result["candidate_aliases"][alias] = {
            "substring_occurrences": sum(len(raw.findall(r["text"])) for r in rows),
            "left_boundary_occurrences": sum(len(boundary.findall(r["text"])) for r in rows),
            "left_boundary_rows": sum(bool(boundary.search(r["text"])) for r in rows),
            "applied": False,
        }

    def delta(old, new):
        concepts = sorted(set(old) | set(new))
        return {c: {"before": len(old.get(c, set())), "after": len(new.get(c, set())),
                    "removed_ids": sorted(old.get(c, set()) - new.get(c, set())),
                    "added_ids": sorted(new.get(c, set()) - old.get(c, set()))}
                for c in concepts if old.get(c, set()) != new.get(c, set())}

    from collections import defaultdict
    old, new = defaultdict(set), defaultdict(set)
    for row in rows:
        for matcher, target in ((before, old), (after, new)):
            for concept in matcher.concepts_in(row["text"]):
                target[concept].add(row["q"]["para_id"])
    result["builders"]["neuron"] = delta(old, new)
    print("neuron comparison complete", flush=True)
    corpus_reader.문단들 = lambda **kwargs: iter(rows)
    mapped = []
    for label, builder in (("before", cmap_before), ("after", cmap_after)):
        built, _, n = builder.build()
        if n != len(rows):
            raise ValueError("Corpus row count changed")
        mapped.append({name: {q["para_id"] for q, _ in hits}
                       for groups in built.values() for concepts in groups.values() for name, hits in concepts.items()})
        print(f"concept-map {label} complete", flush=True)
    result["builders"]["concept_map"] = delta(*mapped)
    inputs = ["build_dashboard.py", "ingest_transcripts.py", "코퍼스.py", "data/posts_all.jsonl",
              "data/paras_all.jsonl", "data/전사_글.jsonl", "data/전사_문단.jsonl"]
    result["inputs"] = [{"path": (LEGACY / p).relative_to(REPO).as_posix(), "sha256": sha((LEGACY / p).read_bytes())} for p in inputs]
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = measure()
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: {c: (v["before"], v["after"]) for c, v in changes.items()}
                      for key, changes in data["builders"].items()}, ensure_ascii=False))
