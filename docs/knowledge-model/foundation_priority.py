"""Bounded second F02 review: four topics, two aliases, one held relation.

Only a detached taxonomy copy is stripped before the frozen F02/F01 checks.
Mentions and attributed claims never activate chart inference or training.
"""
from copy import deepcopy
import argparse
import json
from pathlib import Path

from foundation_additions import text_sha

REPO = Path(__file__).resolve().parents[2]
BASE = "8d0a8226ef00c16fa552ca3ae2600699097b1a91"
REVIEW = "docs/knowledge-model/data/foundation_priority_review.json"
TOPICS = {
    "활인업": ("S15 발현·결과", "업"),
    "재고귀인": ("S06 신살", "길신"),
    "진도화": ("S06 신살", "도화·역마·화개"),
    "가도화": ("S06 신살", "도화·역마·화개"),
}
VOID_PATH = ("S06 신살", "흉신", "공망")
VOID_BEFORE = ["공망", "空亡", "天中殺"]
VOID_ALIASES = ["천중살", "天中煞"]
SUBJECTS = set(TOPICS) | {"천중살", "부분삼형"}


def validate_and_strip(review, taxonomy, repo=REPO):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    require(review["schema_version"] == 1 and review["base_commit"] == BASE,
            "Wrong priority review version/base")
    require(review["scope"] == "lexical_retrieval_only"
            and review["apply_relations"] is False
            and review["use_as_training_labels"] is False
            and review["probability"] is None, "Priority review cannot enable inference/training")
    evidence = review["evidence"]
    require(isinstance(evidence, list) and evidence, "Missing priority evidence")
    by_id = {e["id"]: e for e in evidence}
    require(len(by_id) == len(evidence), "Duplicate priority evidence")
    cached = {}
    for e in evidence:
        require(text(e["id"]) and text(e["source_profile"]), "Missing source identity")
        require(e["kind"] in {"board_snapshot", "web", "transcript"}, "Unknown source kind")
        relative = Path(e["path"])
        path = (repo / relative).resolve()
        require(not relative.is_absolute() and path.is_relative_to(repo.resolve()),
                "Evidence outside repository")
        if path not in cached:
            raw = path.read_bytes()
            cached[path] = text_sha(raw), raw.decode("utf-8-sig").splitlines()
        digest, lines = cached[path]
        require(e["sha256"] == digest, "Stale priority evidence: " + e["id"])
        bounds = e["lines"]
        require(isinstance(bounds, list) and len(bounds) == 2
                and all(type(n) is int for n in bounds), "Invalid evidence bounds")
        start, end = bounds
        require(1 <= start <= end <= len(lines), "Evidence bounds outside source")
        require(text(e["quote"]) and e["quote"] in "\n".join(lines[start - 1:end]),
                "Priority quote mismatch: " + e["id"])

    def refs(ids):
        require(isinstance(ids, list) and ids and len(ids) == len(set(ids))
                and all(eid in by_id for eid in ids), "Invalid priority evidence links")

    rows = review["decisions"]
    require(len(rows) == 6 and {r["concept"] for r in rows} == SUBJECTS,
            "Missing, duplicate or unreviewed priority decision")
    current = deepcopy(taxonomy)
    used = set()
    for row in rows:
        name = row["concept"]
        require(row["inference_enabled"] is False and text(row["reason"])
                and text(row["next_action"]), "Missing bounded decision context")
        refs(row["evidence_ids"])
        used.update(row["evidence_ids"])
        require(row["claims"] and row["held_aliases"], "Missing claims/held-alias review")
        for held in row["held_aliases"]:
            require(text(held["alias"]) and text(held["reason"]), "Missing held-alias reason")
        for claim in row["claims"]:
            require(claim["status"] == "source_claim" and text(claim["statement"]),
                    "Claim is not attributed review data")
            require(claim["type"] in {"definition", "condition", "exception", "disagreement", "retrieval_limit"},
                    "Unknown priority claim type")
            refs(claim["evidence_ids"])
            require(set(claim["evidence_ids"]) <= set(row["evidence_ids"]), "Cross-decision evidence link")
        if name in TOPICS:
            category, group = TOPICS[name]
            require(row["decision"] == "add_topic" and row["target"] == [category, group, name]
                    and row["aliases"] == [name], "Unreviewed topic/alias/placement")
            refs(row["alias_evidence_ids"])
            require(set(row["alias_evidence_ids"]) <= set(row["evidence_ids"])
                    and any(name in by_id[eid]["quote"] for eid in row["alias_evidence_ids"]),
                    "Canonical topic missing from linked evidence")
            require(current.get(category, {}).get(group, {}).get(name) == [name],
                    "Missing/changed priority topic: " + name)
            require(sum(name in cs for gs in current.values() for cs in gs.values()) == 1,
                    "Duplicate priority topic")
            del current[category][group][name]
        elif name == "천중살":
            require(row["decision"] == "add_aliases" and row["target"] == list(VOID_PATH)
                    and row["aliases"] == VOID_ALIASES, "Unreviewed void aliases")
            refs(row["alias_evidence_ids"])
            require(set(row["alias_evidence_ids"]) <= set(row["evidence_ids"]), "Unlinked void evidence")
            for alias in VOID_ALIASES:
                require(any(alias in by_id[eid]["quote"] and "공망" in by_id[eid]["quote"]
                            for eid in row["alias_evidence_ids"]), "Void synonym lacks direct evidence")
                owners = [n for gs in current.values() for cs in gs.values()
                          for n, aliases in cs.items() if alias in aliases or n == alias]
                require(owners == ["공망"], "Void synonym has unexpected owner")
            category, group, target = VOID_PATH
            require(current[category][group][target] == VOID_BEFORE + VOID_ALIASES,
                    "Unexpected existing void alias change")
            current[category][group][target] = VOID_BEFORE[:]
        else:
            require(row["decision"] == "review_relation_only" and row["aliases"] == []
                    and row["alias_evidence_ids"] == []
                    and row["target"] == ["S04 합충형파해", "형·파·해·원진", "삼형"],
                    "Partial punishment is not a new executable topic")
            require(not any(name in cs for gs in current.values() for cs in gs.values()),
                    "Held partial-punishment node entered taxonomy")
    require(used == set(by_id), "Unlinked priority evidence")
    return current, {"reviewed_subjects": 6, "added_concepts": 4, "added_existing_aliases": 2,
                     "evidence_ranges": len(evidence), "relation_reviews_only": 1,
                     "probability": None, "training_labels": False}


def load_and_strip(taxonomy, repo=REPO):
    return validate_and_strip(json.loads((repo / REVIEW).read_text(encoding="utf-8")), taxonomy, repo)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--concept", choices=sorted(SUBJECTS))
    args = parser.parse_args()
    from foundation_review import load_taxonomy, TAXONOMY
    review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
    _, result = validate_and_strip(review, load_taxonomy(REPO / TAXONOMY))
    if args.concept:
        row = next(r for r in review["decisions"] if r["concept"] == args.concept)
        result = {"scope": review["scope"], "decision": row,
                  "evidence": [e for e in review["evidence"] if e["id"] in row["evidence_ids"]],
                  "inference_enabled": False, "use_as_training_labels": False, "probability": None}
    print(json.dumps(result, ensure_ascii=False, indent=2))
