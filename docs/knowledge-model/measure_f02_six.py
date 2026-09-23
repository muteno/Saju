"""Compare real topic retrieval at the F02 base with the six-name extension.

Keep the frozen 56,202 rows and all 271 old ID sets. This does not run neuron
edge generation, alias judgments, D5, P2 or the application inference engine.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
import sys

from foundation_additions import BASE, EXPECTED, REVIEW, validate_and_strip
import measure_hidden_stages as shared

REPO, LEGACY = shared.REPO, shared.LEGACY


def load_pair(baseline):
    old = shared.BASE
    try:
        shared.BASE = BASE
        return shared.load_pair(baseline)
    finally:
        shared.BASE = old


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def measure():
    before, after = load_pair(True), load_pair(False)
    review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
    stripped, extension = validate_and_strip(review, after[1].TAXONOMY)
    if stripped != before[1].TAXONOMY:
        raise ValueError("F02 changed the old taxonomy")
    old_names = set(before[0].concept_meta)
    if len(old_names) != 271 or set(after[0].concept_meta) != old_names | set(EXPECTED):
        raise ValueError("Unexpected concept inventory")
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    rows = list(reader.문단들(제목포함=True))
    if not rows or len({r["q"]["para_id"] for r in rows}) != len(rows):
        raise ValueError("Empty corpus or duplicate paragraph IDs")
    previous = json.loads((REPO / "docs/knowledge-model/data/foundation_month_command_measurement.json").read_text())
    corpus_hash = shared.sha(json.dumps([[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
                                        ensure_ascii=False, separators=(",", ":")).encode())
    if len(rows) != previous["corpus_rows"] or corpus_hash != previous["corpus_sha256"]:
        raise ValueError("Corpus differs from frozen input")
    dependencies = [Path(__file__), Path(shared.__file__), REPO / REVIEW,
                    REPO / "docs/knowledge-model/foundation_additions.py"]
    inputs = previous["inputs"] + [dict(path=p.relative_to(REPO).as_posix(), sha256=shared.sha(p.read_bytes()))
                                   for p in dependencies]
    def verify_inputs():
        for entry in inputs:
            if shared.sha((REPO / entry["path"]).read_bytes()) != entry["sha256"]:
                raise ValueError("Input drift: " + entry["path"])
    verify_inputs()
    unchanged = {}
    for path in ("dosa-app/engine/src/tables.js", "docs/knowledge-model/chart_context.mjs"):
        raw = (REPO / path).read_bytes()
        old = subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)
        if shared.sha(raw) != shared.sha(old):
            raise ValueError("Engine/observation changed: " + path)
        unchanged[path] = shared.sha(raw)

    baseline = shared.run_pair(before, rows, reader, "baseline")
    current = shared.run_pair(after, rows, reader, "current")
    changes = {builder: shared.delta(baseline[builder], current[builder]) for builder in baseline}
    old_sets = {}
    for builder in baseline:
        for name in old_names:
            if baseline[builder].get(name, set()) != current[builder].get(name, set()):
                raise ValueError("Old ID set changed: " + builder + "/" + name)
        if set(changes[builder]) != set(EXPECTED):
            raise ValueError("Unexpected addition/removal scope")
        old_sets[builder] = {
            label: shared.sha(encode({name: sorted(hits.get(name, set())) for name in sorted(old_names)}))
            for label, hits in (("before", baseline[builder]), ("after", current[builder]))}
    # Independent literal oracle, including an occurrence-local suffix exclusion.
    # Agreement of two builders alone would allow a shared omission to pass.
    for name in EXPECTED:
        pattern = re.escape(name) + (r"(?!련|리)" if name == "재생관" else "")
        expected_ids = {r["q"]["para_id"] for r in rows if re.search(pattern, r["text"])}
        for builder in current:
            if current[builder][name] != expected_ids:
                raise ValueError("New topic differs from literal oracle: " + builder + "/" + name)
    suffix_cases = []
    for row in rows:
        matches = list(re.finditer("재생관련|재생관리", row["text"]))
        if matches:
            pid = row["q"]["para_id"]
            suffix_cases.append({"para_id": pid, "file": row["post"].get("file"),
                "excluded_occurrences": [m.group() for m in matches],
                "other_canonical_occurrences": len(re.findall(r"재생관(?!련|리)", row["text"])),
                "retrieved": {b: pid in h["재생관"] for b, h in current.items()},
                "occurrence_semantics": "unresolved; paragraph retention does not certify this transcription"})
    if load_pair(True)[2] != before[2] or load_pair(False)[2] != after[2]:
        raise ValueError("Builder changed during measurement")
    verify_inputs()
    return {
        "schema_version": 1, "base_commit": BASE, "scope": "lexical_retrieval_only",
        "corpus_rows": len(rows), "reader_labels": dict(Counter(r["출처종"] for r in rows)),
        "corpus_sha256": corpus_hash, "title_included": True, "gist_included": False,
        "independent_evidence_count": None, "probability": None, "training_labels": False,
        "old_concepts_checked": len(old_names), "executable_concepts": len(after[0].concept_meta),
        "extension": extension, "code": {"before": before[2], "after": after[2], "unchanged": unchanged},
        "inputs": inputs, "old_concept_id_set_sha256": old_sets,
        "counts": {b: {name: len(h[name]) for name in EXPECTED} for b, h in current.items()},
        "actual_concept_assignment_changes": changes,
        "suffix_cases": suffix_cases,
        "limits": ["Title repetition and web/transcript duplication are retained, not independent support.",
                   "Negated and critical mentions remain topics, never affirmative relation labels.",
                   "No neuron edge generation, alias judgments, D5/P2 or app inference is verified here."],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
