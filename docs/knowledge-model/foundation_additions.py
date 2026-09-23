"""Validate the explicit F02 extension without rebasing the frozen F01 review.

This is a lexical retrieval contract, not semantic certification. Each claim is
source-attributed review data; none is an executable relation or training label.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REVIEW = "docs/knowledge-model/data/foundation_f02_review.json"
BASE = "4d5a9d2214b21d0018abc455f7ed184adcbb468b"
CATEGORY = "S05 십성·육친"
EXPECTED = {
    "편인도식": "십성 공식", "상관패인": "십성 공식",
    "재생관": "십성 공식", "관살혼잡": "십성 공식",
    "사길신": "십성 분류축", "사흉신": "십성 분류축",
}


def text_sha(raw):
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def validate_and_strip(review, taxonomy, repo=REPO):
    """Return a copy with only the six checked additions removed, plus counts."""
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    def nonempty(value):
        return isinstance(value, str) and bool(value.strip())

    require(review["schema_version"] == 1, "Unsupported F02 schema")
    require(review["hash_policy"] == "sha256_lf_git_text", "Unsupported F02 hash policy")
    require(review["base_commit"] == BASE, "Wrong F02 base")
    require(review["scope"] == "lexical_retrieval_only", "F02 is retrieval only")
    require(review["apply_relations"] is False and review["use_as_training_labels"] is False
            and review["probability"] is None, "F02 must remain outside inference and training")
    rows = review["decisions"]
    require(len(rows) == 6 and {r["concept"] for r in rows} == set(EXPECTED),
            "Missing, duplicate or unexpected F02 decision")
    evidence = review["evidence"]
    require(len({e["id"] for e in evidence}) == len(evidence), "Duplicate F02 evidence ID")
    by_id = {e["id"]: e for e in evidence}
    files = {}
    for item in evidence:
        require(nonempty(item["id"]) and nonempty(item["source_profile"]), "Missing source identity")
        require(item["kind"] in {"board_snapshot", "web", "transcript"}, "Unknown source kind")
        relative = Path(item["path"])
        require(not relative.is_absolute(), "Evidence path must be relative")
        path = (repo / relative).resolve()
        require(path.is_relative_to(repo.resolve()), "Evidence outside repository")
        if path not in files:
            raw = path.read_bytes()
            files[path] = text_sha(raw), raw.decode("utf-8-sig").splitlines()
        sha, lines = files[path]
        require(item["sha256"] == sha, "Stale F02 evidence: " + item["id"])
        bounds = item["lines"]
        require(isinstance(bounds, list) and len(bounds) == 2, "Invalid F02 range")
        start, end = bounds
        require(type(start) is int and type(end) is int and 1 <= start <= end <= len(lines),
                "Invalid F02 range: " + item["id"])
        require(nonempty(item["quote"]) and item["quote"] in "\n".join(lines[start-1:end]),
                "F02 quote mismatch: " + item["id"])

    def check_refs(ids):
        require(isinstance(ids, list) and bool(ids) and len(ids) == len(set(ids))
                and all(eid in by_id for eid in ids), "Missing or duplicate F02 evidence reference")

    current = deepcopy(taxonomy)
    all_names = {name for groups in current.values() for concepts in groups.values() for name in concepts}
    for row in rows:
        name = row["concept"]
        group = EXPECTED[name]
        require(row["category"] == CATEGORY and row["group"] == group, "Wrong F02 placement: " + name)
        require(row["decision"] == "add_topic" and row["aliases"] == [name],
                "Only reviewed canonical F02 names may be added: " + name)
        require(row["inference_enabled"] is False, "F02 relation activation forbidden")
        require(nonempty(row["reason"]) and nonempty(row["next_action"]), "Missing F02 decision context")
        require(row["participant_candidates"] and all(p in all_names for p in row["participant_candidates"]),
                "Unknown F02 participant candidate")
        check_refs(row["alias_evidence_ids"])
        require(any(name in by_id[eid]["quote"] for eid in row["alias_evidence_ids"]),
                "F02 canonical name absent from linked quote: " + name)
        require(row["claims"], "Missing F02 source claims")
        for claim in row["claims"]:
            require(claim["status"] == "source_claim" and nonempty(claim["statement"]),
                    "Source claim cannot become an execution rule")
            require(claim["type"] in {"definition", "condition", "exception", "disagreement", "retrieval_limit"},
                    "Unknown F02 claim type")
            check_refs(claim["evidence_ids"])
        require(row["held_aliases"] and all(nonempty(a["alias"]) and nonempty(a["reason"])
                                           for a in row["held_aliases"]), "Missing held-alias context")
        require(current.get(CATEGORY, {}).get(group, {}).get(name) == [name],
                "Missing or changed F02 taxonomy entry: " + name)
        # A second occurrence in another category must not disappear unnoticed.
        require(sum(name in concepts for groups in current.values() for concepts in groups.values()) == 1,
                "Duplicate F02 concept placement: " + name)
        del current[CATEGORY][group][name]
    # This group was introduced by F02. Never remove unrelated contents.
    require(current[CATEGORY]["십성 분류축"] == {}, "Unexpected F02 classification entry")
    del current[CATEGORY]["십성 분류축"]
    return current, {"added_concepts": len(rows), "added_aliases": len(rows),
                     "evidence_ranges": len(evidence), "scope": review["scope"],
                     "probability": None, "training_labels": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.parse_args()
    from foundation_review import load_taxonomy, TAXONOMY
    review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
    _, result = validate_and_strip(review, load_taxonomy(REPO / TAXONOMY))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
