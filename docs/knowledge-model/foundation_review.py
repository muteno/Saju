"""Check F01 edition decisions and source pointers; never merge review data.

The legacy TAXONOMY remains the executable source. This checker makes missing
decisions, unintended alias changes and stale evidence fail the normal gate.
Literal source agreement is not semantic certification or a training label.
"""
import argparse
import ast
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUNDLE = "docs/knowledge-model/data/foundation_review_bundle.json"
REVIEW = "docs/knowledge-model/data/foundation_taxonomy_review.json"
TAXONOMY = "정제/_현황판/build_concept_map.py"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def text_digest(raw):
    """Compare LF Git text blobs even when checkout converted them to CRLF."""
    return digest(raw.replace(b"\r\n", b"\n"))


def fingerprint(taxonomy):
    return digest(json.dumps(taxonomy, ensure_ascii=False, sort_keys=True).encode())


def load_taxonomy(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    assignments = [node for node in tree.body if isinstance(node, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == "TAXONOMY" for t in node.targets)]
    if len(assignments) != 1:
        raise ValueError("Expected one literal TAXONOMY assignment")
    declaration = assignments[0]
    if len(declaration.targets) != 1:
        raise ValueError("TAXONOMY cannot share an assignment target")
    parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Name) or node.id != "TAXONOMY" or node is declaration.targets[0]:
            continue
        attr = parents.get(node)
        call = parents.get(attr)
        loop = parents.get(call)
        # The current builder reads this literal through direct iteration only.
        # Reject direct mutations, aliases and opaque function calls instead of
        # executing arbitrary module code. This is a static source contract, not
        # a general proof against mutation through derived loop variables.
        if not (isinstance(attr, ast.Attribute) and attr.attr == "items"
                and isinstance(call, ast.Call) and call.func is attr
                and not call.args and not call.keywords
                and isinstance(loop, ast.For) and loop.iter is call):
            raise ValueError("TAXONOMY only permits a literal declaration and direct iteration")
    return ast.literal_eval(declaration.value)


def flatten(taxonomy):
    result = {}
    for category, groups in taxonomy.items():
        for group, concepts in groups.items():
            for name, aliases in concepts.items():
                if name in result or len(aliases) != len(set(aliases)):
                    raise ValueError(f"Duplicate concept or alias: {name}")
                result[name] = {"category": category, "group": group, "aliases": aliases}
    return result


def validate(review, repo=REPO, taxonomy=None):
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    raw_bundle = (repo / BUNDLE).read_bytes()
    bundle = json.loads(raw_bundle)
    require(review["schema_version"] == 1, "Unsupported review schema")
    require(review["hash_policy"] == "sha256_lf_git_text", "Unsupported evidence hash policy")
    require(review["bundle_sha256"] == text_digest(raw_bundle), "Review bundle changed")
    require(review["repository_base_commit"] == bundle["repository_base_commit"], "Wrong edition base")
    require(review["apply_to_probability_model"] is False and review["use_as_training_labels"] is False,
            "Review must remain outside probability and training")
    old = bundle["taxonomy"]
    expected = {name: kind for kind in ("local_only", "repository_only", "changed_shared")
                for name in old[kind]}
    rows = review["decisions"]
    require(len(rows) == len(expected) and len({r["concept"] for r in rows}) == len(expected),
            "Missing or duplicate edition decision")
    require({r["concept"] for r in rows} == set(expected), "Edition decision coverage changed")

    # Every quote points to a physical source file; P0 IDs are retained as context,
    # never substituted for a file hash and an exact range.
    evidence = review["evidence"]
    require(len({e["id"] for e in evidence}) == len(evidence), "Duplicate evidence ID")
    evidence_by_id = {e["id"]: e for e in evidence}
    files = {}
    for e in evidence:
        path = (repo / e["path"]).resolve()
        require(path.is_relative_to(repo.resolve()), "Evidence outside repository")
        if path not in files:
            raw = path.read_bytes()
            files[path] = (text_digest(raw), raw.decode("utf-8-sig").splitlines())
        sha, lines = files[path]
        require(sha == e["sha256"], f"Stale evidence: {e['id']}")
        start, end = e["lines"]
        require(type(start) is int and type(end) is int and 1 <= start <= end <= len(lines),
                f"Invalid source range: {e['id']}")
        require(bool(e["quote"].strip()) and e["quote"] in "\n".join(lines[start-1:end]),
                f"Quote mismatch: {e['id']}")

    current = deepcopy(taxonomy if taxonomy is not None else load_taxonomy(repo / TAXONOMY))
    flat = flatten(current)
    applied = []
    for row in rows:
        name = row["concept"]
        kind = expected[name]
        require(row["difference_kind"] == kind, f"Wrong difference kind: {name}")
        require(row["decision"] in {"채택", "분리", "보류"}, f"Unknown decision: {name}")
        require(bool(row["reason"].strip()) and bool(row["next_action"].strip()), f"Missing reason: {name}")
        require(row["target_file"] == TAXONOMY, f"Wrong target: {name}")
        require(row["bundle_pointer"] == f"/taxonomy/{kind}/{name}", f"Wrong edition pointer: {name}")
        local = old[kind][name]["local"]["aliases"] if kind == "changed_shared" else (
            old[kind][name]["aliases"] if kind == "local_only" else [])
        remote = old[kind][name]["repository"]["aliases"] if kind == "changed_shared" else (
            old[kind][name]["aliases"] if kind == "repository_only" else [])
        require(row["local_only_aliases"] == sorted(set(local) - set(remote))
                and row["repository_only_aliases"] == sorted(set(remote) - set(local)),
                f"Edition alias delta changed: {name}")
        require(all(eid in evidence_by_id for eid in row["evidence_ids"]), f"Missing evidence: {name}")
        require(row["source_review"] in {"reviewed_examples", "literal_candidate_only", "pending"},
                f"Unknown source review: {name}")
        for addition in row["applied_aliases"]:
            alias = addition["alias"]
            require(row["decision"] == "채택" and row["source_review"] == "reviewed_examples",
                    f"Unreviewed alias application: {name}")
            require(kind == "changed_shared" and alias in old[kind][name]["local"]["aliases"]
                    and alias not in old[kind][name]["repository"]["aliases"], f"Not a local delta: {alias}")
            require(addition["evidence_id"] in row["evidence_ids"], f"Unlinked alias evidence: {alias}")
            e = evidence_by_id[addition["evidence_id"]]
            require(alias in e["quote"], f"Alias absent from source quote: {alias}")
            require(alias in flat[name]["aliases"], f"Reviewed alias not in TAXONOMY: {alias}")
            flat[name]["aliases"].remove(alias)
            applied.append((name, alias))
        if kind == "local_only":
            require(name not in flat, f"Unreviewed local concept entered TAXONOMY: {name}")
        else:
            base_entry = old[kind][name] if kind == "repository_only" else old[kind][name]["repository"]
            require(flat[name] == base_entry, f"Unrecorded edition change: {name}")

    # After undoing only declared additions, all 271 concepts must still equal
    # the measured base. This catches changes outside the 76-row difference list.
    require(fingerprint(current) == review["baseline_taxonomy_sha256"], "Unexpected TAXONOMY change")
    require(len(flat) == old["repository_count"] and len(set(flat) | set(old["local_only"])) == old["name_union_count"],
            "Concept count drift")
    return {"differences": len(rows), "decisions": dict(Counter(r["decision"] for r in rows)),
            "concepts": len(flat), "name_union": old["name_union_count"],
            "applied_aliases": len(applied), "evidence_ranges": len(evidence),
            "probability": None, "training_labels": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Read-only validation (the default)")
    parser.parse_args()
    review = json.loads((REPO / REVIEW).read_text(encoding="utf-8"))
    print(json.dumps(validate(review), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
