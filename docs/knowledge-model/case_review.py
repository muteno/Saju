"""Prepare source-bound annotation cases; null, disputed and fixture labels never train.

python case_review.py --input data/case_review_pilot.json [--compare]
The CLI recomputes features and checks sources before any comparison.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re

from context_query import POLICY, ROOT, assess, calculate_context, signature, validate_reviews

COMPATIBILITY = ("calculator_files", "adapter_sha256", "review_sha256")


def text(value):
    return isinstance(value, str) and bool(value.strip())


def instant(value):
    if not text(value):
        raise ValueError("Time must be an ISO timestamp with UTC offset")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid ISO timestamp") from exc
    if result.tzinfo is None:
        raise ValueError("Time must include UTC offset")
    return result.astimezone(timezone.utc)


def signed_review(review):
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        return False
    if not all(text(review.get(k)) for k in ("reviewer_id", "rationale", "reviewed_at")):
        return False
    instant(review["reviewed_at"])
    return True


def validate_spec(spec, reviews):
    if (not isinstance(spec, dict) or spec.get("feature_policy") != POLICY or spec.get("review_sha256") != signature(reviews)
            or spec.get("target_kind") != "literature_applicability"):
        raise ValueError("Spec must bind current observations/reviews and a literature-applicability target")
    available = {r["id"] for r in reviews["reviews"]}
    targets = spec.get("targets")
    if not isinstance(targets, list) or not targets:
        raise ValueError("At least one explicitly defined target is required")
    ids = set()
    for target in targets:
        if (not isinstance(target, dict) or not text(target.get("id")) or target["id"] in ids
                or not all(text(target.get(k)) for k in ("hypothesis", "positive_definition", "negative_definition", "unknown_definition"))
                or target.get("label_type") not in ("binary", "soft")
                or not target.get("source_review_ids") or not set(target["source_review_ids"]) <= available):
            raise ValueError("Target needs unique identity, label definitions and existing source reviews")
        ids.add(target["id"])
        if target["label_type"] == "soft" and not text(target.get("degree_policy")):
            raise ValueError("Soft targets require an explicit degree policy, distinct from confidence")
        features = target.get("base_features")
        if (not isinstance(features, list) or not features or len(set(features)) != len(features)
                or any(not isinstance(f, str) or not f.startswith(("natal.", "time.")) or "completes_" in f for f in features)):
            raise ValueError("Baseline requires raw observation features, not precomputed conditions/interactions")
        interactions = target.get("interactions")
        if not isinstance(interactions, list) or not interactions:
            raise ValueError("Comparison requires declared interaction hypotheses")
        interaction_ids = set()
        for interaction in interactions:
            if not isinstance(interaction, dict):
                raise ValueError("Interaction must be an object")
            when = interaction.get("when")
            if (not text(interaction.get("id")) or interaction["id"] in interaction_ids
                    or not isinstance(when, dict) or len(when) < 2 or not set(when) <= set(features)
                    or any(v not in ("present", "absent") for v in when.values())
                    or not interaction.get("source_review_ids") or not set(interaction["source_review_ids"]) <= available):
                raise ValueError("Interactions need unique identity, at least two baseline features and source binding")
            interaction_ids.add(interaction["id"])


def input_identity(request):
    """Normalize ordinary defaults/offset spelling to detect copied calculator inputs."""
    birth = {"minute": 0, "timeZone": "Asia/Seoul", "longitude": 126.978,
             "solarTimeCorrection": True, "lateZiRule": "midnight23", **request["birth"]}
    birth["minute"] = None if birth["hour"] is None else 0 if birth["minute"] is None else birth["minute"]
    periods = sorted((instant(p["start"]).isoformat(), instant(p["end"]).isoformat(), p["pillar"])
                     for p in (request.get("daewoon_periods") or []))
    return signature({"birth": birth, "evaluated_at": instant(request["evaluated_at"]).isoformat(), "periods": periods})


def prepare(bundle, reviews, *, allow_synthetic=False):
    """Return an audit and eligible rows; readiness is an attestation, not expert verification."""
    if (not isinstance(bundle, dict) or type(bundle.get("schema_version")) is not int or bundle["schema_version"] != 1
            or not isinstance(bundle.get("cases"), list) or not bundle["cases"]):
        raise ValueError("A nonempty version-1 case bundle is required")
    spec = bundle["spec"]
    validate_spec(spec, reviews)
    target_ids = {t["id"] for t in spec["targets"]}
    required = sorted({f for t in spec["targets"] for f in t["base_features"]})
    report, rows, compatibility, ids, cache = [], [], None, set(), {}
    blockers = []
    for target in spec["targets"]:
        if not signed_review(target.get("review")):
            blockers.append("unreviewed_target:" + target["id"])
    for case in bundle["cases"]:
        if not isinstance(case, dict):
            raise ValueError("Case must be an object")
        case_id = case.get("case_id")
        if not text(case_id) or case_id in ids:
            raise ValueError("case_id must be unique and nonempty")
        ids.add(case_id)
        if "features" in case or "context" in case:
            raise ValueError("Case features must be recomputed from request, not supplied")
        if case.get("case_origin") not in ("observed_case", "calculator_fixture", "synthetic"):
            raise ValueError("Case origin must be explicit")
        provenance = case["provenance"]
        if (not isinstance(provenance, dict) or not all(text(provenance.get(k)) for k in ("source_group", "subject_group"))
                or not isinstance(provenance.get("dependency_groups"), list)
                or not provenance["dependency_groups"] or any(not text(x) for x in provenance["dependency_groups"])):
            raise ValueError("Source/subject identity and dependency groups must be explicit")
        request = case["request"]
        key = signature(request)
        if key not in cache:
            cache[key] = assess(calculate_context(request), reviews)
        context = cache[key]
        current = {k: context["provenance"][k] for k in COMPATIBILITY}
        if compatibility is not None and compatibility != current:
            raise ValueError("Measurement/source versions changed while preparing cases")
        compatibility = current
        features = context["model_input"]["features"]
        if any(f not in features for f in required):
            raise ValueError("Spec references an unsupported observation feature")
        reasons = []
        if case["case_origin"] == "calculator_fixture":
            reasons.append("calculator_fixture_not_training_data")
        if case["case_origin"] == "synthetic" and not allow_synthetic:
            reasons.append("synthetic_requires_explicit_opt_in")
        if not signed_review(provenance.get("review")):
            reasons.append("unreviewed_provenance")
        evidence = provenance.get("input_evidence")
        if not isinstance(evidence, list):
            raise ValueError("input_evidence must be an explicit list")
        if not evidence:
            reasons.append("missing_input_evidence")
        for item in evidence:
            if (not isinstance(item, dict) or not text(item.get("reference")) or not isinstance(item.get("sha256"), str)
                    or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"])):
                raise ValueError("Input evidence requires reference and SHA-256 identity")
            if instant(item["available_at"]) > instant(request["evaluated_at"]):
                reasons.append("future_input_evidence")
        labels = case.get("labels")
        if not isinstance(labels, dict) or set(labels) != target_ids:
            raise ValueError("Every target needs an explicit annotation, including pending/unknown")
        values, origins = {}, set()
        for target in spec["targets"]:
            label = labels[target["id"]]
            if not isinstance(label, dict):
                raise ValueError("Annotation must be an object")
            status, value = label.get("status"), label.get("value")
            if status not in ("pending", "unknown", "disputed", "reviewed"):
                raise ValueError("Invalid annotation status")
            if status != "reviewed":
                if value is not None:
                    raise ValueError("Pending, unknown and disputed annotations must keep value null")
                reasons.append("label_" + status + ":" + target["id"])
                continue
            if (type(value) not in (int, float) or not 0 <= value <= 1 or not math.isfinite(value)
                    or target["label_type"] == "binary" and (type(value) is not int or value not in (0, 1))):
                raise ValueError("Reviewed label does not match the declared binary/soft target")
            refs = label.get("evidence_refs")
            allowed_refs = {x["reference"] for x in evidence} | {"source-review:" + x for x in target["source_review_ids"]}
            if (not signed_review(label) or not isinstance(refs, list) or not refs
                    or any(not text(x) or x not in allowed_refs for x in refs)):
                reasons.append("unsigned_or_unsupported_label:" + target["id"])
            expected_origin = "synthetic" if case["case_origin"] == "synthetic" else "expert"
            if label.get("label_origin") != expected_origin:
                reasons.append("unaccepted_label_origin:" + target["id"])
            if signed_review(label) and any(instant(x["available_at"]) > instant(label["reviewed_at"]) for x in evidence):
                reasons.append("label_predates_input_evidence:" + target["id"])
            values[target["id"]] = value
            origins.add(label.get("label_origin"))
        missing = [f for f in required if features[f] is None]
        if missing:
            reasons.append("unknown_required_observations")
        reasons = sorted(set(reasons))
        record = {"case_id": case_id, "eligible": not reasons, "exclusion_reasons": reasons,
                  "case_origin": case["case_origin"], "request": request,
                  "case_provenance": provenance, "annotations": labels,
                  "unknown_features": missing, "features": {f: features[f] for f in required},
                  "condition_audit": [{"id": r["id"], "status": r["status"]} for r in context["conditions"]],
                  "input_identity": input_identity(request), "provenance": context["provenance"]}
        report.append(record)
        if not reasons:
            # One target can use soft labels while another is binary; fit validates each value.
            rows.append({"case_id": case_id, "source_group": provenance["source_group"],
                         "label_type": "soft" if any(t["label_type"] == "soft" for t in spec["targets"]) else "binary",
                         "label_origin": next(iter(origins)), "labels": values,
                         "context": {"features": record["features"]}})
    if len({row["label_origin"] for row in rows}) > 1:
        blockers.append("mixed_synthetic_and_expert_cases")
    audit = {"schema_version": 1, "status": "needs_review" if blockers or len(rows) != len(report) else "eligible_for_split_validation",
             "case_count": len(report), "eligible_count": len(rows), "excluded_count": len(report)-len(rows),
             "blockers": blockers, "exclusion_counts": dict(Counter(reason for row in report for reason in row["exclusion_reasons"])),
             "cases": report, "feature_policy": POLICY, "compatibility": compatibility,
             "target_definitions": spec["targets"],
             "bundle_sha256": signature(bundle), "spec_sha256": signature(spec),
             "labels_created": False, "expert_identity_and_source_independence_verified": False,
             "probability": None}
    return audit, rows


def validate_split(bundle, audit, rows):
    """Check declared groups transitively across ALL cases, including excluded bridges."""
    split = bundle.get("split", {})
    if not isinstance(split, dict):
        raise ValueError("Split must be an object")
    protocol = split.get("protocol")
    if protocol not in ("source_subject_holdout", "source_subject_forward"):
        raise ValueError("Split must explicitly select a source/subject holdout protocol")
    assignments = [split.get(k) for k in ("train_case_ids", "holdout_case_ids")]
    if any(not isinstance(a, list) or not a or any(not text(x) for x in a) or len(set(a)) != len(a) for a in assignments):
        raise ValueError("Train/holdout case IDs must be nonempty unique lists")
    train, holdout = map(set, assignments)
    case_map = {c["case_id"]: c for c in bundle["cases"]}
    if train & holdout or not (train | holdout) <= case_map.keys():
        raise ValueError("Split contains overlap or unknown case IDs")
    eligible = {r["case_id"] for r in rows}
    if (train | holdout) != eligible:
        raise ValueError("Split must use every eligible case exactly once; excluded cases cannot train")
    parents = {case_id: case_id for case_id in case_map}
    def find(x):
        while parents[x] != x:
            parents[x] = parents[parents[x]]
            x = parents[x]
        return x
    first = {}
    identities = {r["case_id"]: r["input_identity"] for r in audit["cases"]}
    for case_id, case in case_map.items():
        p = case["provenance"]
        tokens = [("source", p["source_group"]), ("subject", p["subject_group"]), ("input", identities[case_id])]
        tokens += [("dependency", x) for x in p["dependency_groups"]]
        tokens += [("evidence", x["sha256"]) for x in p["input_evidence"]]
        for token in tokens:
            if token in first:
                parents[find(case_id)] = find(first[token])
            else:
                first[token] = case_id
    if {find(i) for i in train} & {find(i) for i in holdout}:
        raise ValueError("Train/holdout share a source, subject, dependency, evidence file or copied input")
    training_groups = {case_map[i]["provenance"]["source_group"] for i in train}
    holdout_groups = {case_map[i]["provenance"]["source_group"] for i in holdout}
    if len(training_groups) < 2 or len(holdout_groups) != 1:
        raise ValueError("Current trainer requires two training source groups and one held-out group")
    training_components = {find(i) for i in train}
    if len(training_components) < 2:
        raise ValueError("Training source names collapse to fewer than two dependency components")
    if protocol == "source_subject_forward":
        cutoff = instant(split.get("train_until"))
        for target in bundle["spec"]["targets"]:
            if instant(target["review"]["reviewed_at"]) > cutoff:
                raise ValueError("Target definition was reviewed after the training cutoff")
        for case_id in train:
            c = case_map[case_id]
            times = [c["request"]["evaluated_at"], c["provenance"]["review"]["reviewed_at"]]
            times += [x["reviewed_at"] for x in c["labels"].values()]
            times += [x["available_at"] for x in c["provenance"]["input_evidence"]]
            if any(instant(t) > cutoff for t in times):
                raise ValueError("Training case, evidence or annotation crosses the training cutoff")
        if any(instant(case_map[i]["request"]["evaluated_at"]) <= cutoff for i in holdout):
            raise ValueError("Forward holdout must be later than the training cutoff")
    return {"protocol": protocol, "train_case_ids": sorted(train), "holdout_case_ids": sorted(holdout),
            "training_groups": sorted(training_groups), "holdout_group": next(iter(holdout_groups)),
            "training_dependency_component_count": len(training_components),
            "forward_time_constraints_checked": protocol == "source_subject_forward",
            "group_identity_truth_verified": False, "historical_access_verified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "data/case_review_pilot.json")
    parser.add_argument("--compare", action="store_true")
    parser.add_argument("--demo", action="store_true", help="Allow explicitly synthetic test labels only")
    args = parser.parse_args()
    try:
        bundle = json.loads(args.input.read_text(encoding="utf-8"))
        reviews = json.loads((ROOT / "data/context_reviews.json").read_text(encoding="utf-8"))
        legacy = json.loads((ROOT / "data/legacy_review.json").read_text(encoding="utf-8"))
        validate_reviews(reviews, legacy)
        if args.compare:
            from compare_models import compare
            result = compare(bundle, reviews, allow_synthetic=args.demo)
        else:
            result, _ = prepare(bundle, reviews, allow_synthetic=args.demo)
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(json.dumps({"status": "validation_error", "message": str(error)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
