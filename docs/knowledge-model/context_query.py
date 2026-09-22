"""Evaluate reviewed source antecedents using L1 observations and explicit time.

python context_query.py --input case.json [--term 일간] [--model reviewed_model.json]
No source sentence becomes a personal prediction or a training label.
"""
import argparse
import json
from pathlib import Path
import subprocess

from build_corpus import source_units
from conditional_model import predict
from knowledge_query import query
from legacy_import import digest

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
POLICY = "chart-observations-v1"


def calculate_context(request):
    """Recompute observations from the request; never trust caller-supplied features."""
    run = subprocess.run(["node", str(ROOT / "chart_context.mjs"), "-"],
                         input=json.dumps(request, ensure_ascii=False, allow_nan=False, sort_keys=True),
                         capture_output=True, text=True, check=False)
    if run.returncode:
        raise ValueError(run.stderr.strip())
    return json.loads(run.stdout)


def signature(value):
    return digest(json.dumps(value, ensure_ascii=False, sort_keys=True).encode())


def evaluate_expression(expression, features, depth=0):
    """Strong three-valued logic for exact predicates, not fuzzy probabilities."""
    if depth > 16 or not isinstance(expression, dict) or len(expression) != 1:
        raise ValueError("Invalid or overly deep condition expression")
    operator, value = next(iter(expression.items()))
    if operator == "feature":
        if not isinstance(value, str) or not value:
            raise ValueError("Feature name must be a nonempty string")
        state = features.get(value)
        if state is not None and (type(state) not in (int, float) or state not in (0, 1)):
            raise ValueError("Logical predicates require 0, 1 or null, not a graded measurement")
        return {"value": state, "unknown_features": [value] if state is None else [], "feature": value}
    if operator == "not":
        child = evaluate_expression(value, features, depth+1)
        return {"value": None if child["value"] is None else 1-child["value"],
                "unknown_features": child["unknown_features"], "operator": "not", "children": [child]}
    if operator not in ("all", "any") or not isinstance(value, list) or not value:
        raise ValueError("Conditions require nonempty all/any lists, not, or feature")
    children = [evaluate_expression(e, features, depth+1) for e in value]
    states = [c["value"] for c in children]
    if operator == "all":
        result = 0 if 0 in states else None if None in states else 1
    else:
        result = 1 if 1 in states else None if None in states else 0
    return {"value": result, "unknown_features": sorted({f for c in children for f in c["unknown_features"]}),
            "operator": operator, "children": children}


def validate_reviews(reviews, legacy, repo=REPO):
    """Verify candidate snapshot and added surrounding paragraphs before use."""
    if reviews.get("feature_policy") != POLICY or reviews.get("use_as_training_labels") is not False:
        raise ValueError("Invalid review policy")
    candidates = {c["id"]: c for c in legacy["candidates"]}
    loaded, ids = {}, set()
    for review in reviews["reviews"]:
        if review["id"] in ids or not review.get("concept_ids") or not review.get("source_context"):
            raise ValueError("Review needs unique id, concept binding and source context")
        ids.add(review["id"])
        if review.get("review_scope") != "antecedent_only" or review.get("prediction_enabled") is not False:
            raise ValueError("Antecedent review must not authorize personal predictions")
        for candidate_id, expected in review["candidate_signatures"].items():
            if candidate_id not in candidates or signature(candidates[candidate_id]) != expected:
                raise ValueError("Review refers to a changed legacy candidate: " + candidate_id)
        if not review["candidate_signatures"]:
            raise ValueError("Review must bind at least one original candidate")
        for source in review["source_context"]:
            path = (repo / source["path"]).resolve()
            if not path.is_relative_to(repo.resolve()) or path.suffix != ".docx":
                raise ValueError("Source path must be a repository DOCX")
            if path not in loaded:
                loaded[path] = (digest(path.read_bytes()), source_units(path))
            actual_hash, rows = loaded[path]
            start, end = source["start"], source["end"]
            if type(start) is not int or type(end) is not int or start < 1 or end < start:
                raise ValueError("Invalid source paragraph interval")
            quote = "\n".join(r["text"] for r in rows if start <= int(r["locator"].split("P")[1]) <= end)
            if actual_hash != source["sha256"] or not quote or quote != source["quote"]:
                raise ValueError("Review source context has changed: " + source["path"])
        evaluate_expression(review["expression"], {})  # Reject malformed expressions even before data arrives.


def assess(context, reviews, model=None):
    if context.get("feature_policy") != POLICY or reviews.get("feature_policy") != POLICY:
        raise ValueError("Incompatible feature policy")
    features = dict(context["features"])
    review_hash = signature(reviews)
    results = []
    for review in reviews["reviews"]:
        trace = evaluate_expression(review["expression"], context["features"])
        if set(trace["unknown_features"]) - context["features"].keys():
            raise ValueError("Condition references features outside the observation policy")
        state = trace["value"]
        features["condition." + review["id"]] = state
        results.append({"id": review["id"], "label": review["label"], "candidate_ids": list(review["candidate_signatures"]),
                        "concept_ids": review["concept_ids"], "condition_value": state,
                        "status": "needs_context" if state is None else "matched" if state == 1 else "not_matched",
                        "evaluation_scope": "reviewed_antecedent_only_not_full_interpretation",
                        "scope_reconstruction": review["scope_reconstruction"], "reviewer_kind": review["reviewer_kind"],
                        "probability": None, "prediction_enabled": False, "trace": trace,
                        "source_context": review["source_context"], "unresolved": review["unresolved"]})
    prediction = {"status": "no_trained_model_supplied", "probability": None}
    if model is not None:
        if (model.get("feature_policy") != POLICY or model.get("review_sha256") != review_hash
                or any(model.get(k) != context["provenance"][k] for k in ("calculator_files", "adapter_sha256"))):
            raise ValueError("Model requires matching feature policy, review, adapter and calculator source hashes")
        prediction = predict(model, {"features": features})
    return {"feature_policy": POLICY, "evaluated_at": context["evaluated_at"], "natal": context["natal"],
            "time_context": context["time_context"], "observations": context["features"],
            "measurement_bounds": context["bounds"], "measurement_policy": context["measurement"],
            "conditions": results, "model_input": {"features": features}, "prediction": prediction,
            "provenance": {**context["provenance"], "review_sha256": review_hash}, "training_labels_created": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--term", help="Attach exact concept retrieval and directly related assessed conditions")
    parser.add_argument("--model", type=Path)
    args = parser.parse_args()
    try:
        context = calculate_context(json.loads(args.input.read_text(encoding="utf-8")))
        reviews = json.loads((ROOT / "data/context_reviews.json").read_text(encoding="utf-8"))
        legacy = json.loads((ROOT / "data/legacy_review.json").read_text(encoding="utf-8"))
        validate_reviews(reviews, legacy)
        model = json.loads(args.model.read_text(encoding="utf-8")) if args.model else None
        result = assess(context, reviews, model)
        if args.term:
            graph = json.loads((ROOT / "knowledge_graph.json").read_text(encoding="utf-8"))
            result["knowledge"] = query(args.term, graph, legacy)
            if result["knowledge"]["status"] == "found":
                node_id = result["knowledge"]["node"]["id"]
                result["knowledge"]["context_assessment"] = [r for r in result["conditions"] if node_id in r["concept_ids"]]
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(json.dumps({"status": "validation_error", "message": str(error)}, ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
