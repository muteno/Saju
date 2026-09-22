"""Compare additive and interaction logistic models on exactly the same reviewed cases.

No automatic winner selection, real-world prediction claim or calibration claim.
"""
import copy
import math
from pathlib import Path

from case_review import prepare, validate_split
from conditional_model import fit, predict
from context_query import POLICY, signature


def model_template(spec, audit, *, interactions):
    claims = []
    for target in spec["targets"]:
        claims.append({"id": target["id"], "bias": None,
                       "required_features": list(target["base_features"]),
                       "feature_weights": {f: None for f in target["base_features"]},
                       "interactions": [{"id": i["id"], "when": dict(i["when"]), "weight": None}
                                        for i in target["interactions"]] if interactions else []})
    return {"hypothesis_mode": "nonexclusive", "parameter_origin": "untrained",
            "feature_policy": POLICY, **copy.deepcopy(audit["compatibility"]),
            "target_kind": "literature_applicability", "target_definitions": copy.deepcopy(spec["targets"]),
            "bundle_sha256": audit["bundle_sha256"], "spec_sha256": audit["spec_sha256"], "claims": claims}


def evaluate(model, rows, targets, *, allow_synthetic=False):
    details = []
    by_target = {t["id"]: [] for t in targets}
    for row in rows:
        output = predict(model, row["context"], allow_synthetic=allow_synthetic)
        estimates = []
        for claim in output["claims"]:
            if claim["probability"] is None:
                raise ValueError("Comparison produced an incomplete prediction")
            y, p, logit = row["labels"][claim["id"]], claim["probability"], claim["logit"]
            loss = ((1-y)*logit if logit >= 0 else -y*logit) + math.log1p(math.exp(-abs(logit)))
            if not math.isfinite(loss):
                raise ValueError("Evaluation loss overflow")
            item = {"target_id": claim["id"], "label": y, "estimate": p,
                    "binary_cross_entropy": loss, "squared_label_error": (p-y)**2}
            estimates.append(item)
            by_target[claim["id"]].append(item)
        details.append({"case_id": row["case_id"], "estimates": estimates})
    metrics = {}
    for target in targets:
        items = by_target[target["id"]]
        if not items:
            raise ValueError("Cannot score an empty holdout")
        metrics[target["id"]] = {"n": len(items),
                                 "binary_cross_entropy": math.fsum(x["binary_cross_entropy"]/len(items) for x in items),
                                 "mean_squared_label_error": math.fsum(x["squared_label_error"]/len(items) for x in items),
                                 "squared_error_semantics": "Brier score" if target["label_type"] == "binary" else "error against expert degree, not event-frequency calibration",
                                 "label_min": min(x["label"] for x in items), "label_max": max(x["label"] for x in items)}
    return {"metrics": metrics, "cases": details}


def compare(bundle, reviews, *, allow_synthetic=False, epochs=300, learning_rate=0.15, l2=0.001):
    audit, rows = prepare(bundle, reviews, allow_synthetic=allow_synthetic)
    if audit["blockers"]:
        return {"status": "blocked", "audit": audit, "models": None, "probability": None}
    try:
        split = validate_split(bundle, audit, rows)
    except ValueError as error:
        return {"status": "blocked", "audit": audit, "split_error": str(error), "models": None, "probability": None}
    # Every comparison gets identical required features, eligible cases, split and optimizer.
    templates = {name: model_template(bundle["spec"], audit, interactions=use)
                 for name, use in (("additive", False), ("with_interactions", True))}
    reports, models = {}, {}
    holdout_ids = set(split["holdout_case_ids"])
    holdout = [row for row in rows if row["case_id"] in holdout_ids]
    optimizer = {"epochs": epochs, "learning_rate": learning_rate, "l2": l2}
    code_hash = signature({name: Path(__file__).with_name(name).read_text(encoding="utf-8")
                           for name in ("compare_models.py", "case_review.py", "conditional_model.py")})
    for name, template in templates.items():
        model = fit(template, rows, split["holdout_group"], allow_synthetic=allow_synthetic, **optimizer)
        model["comparison_split"] = split
        model["comparison_code_sha256"] = code_hash
        model["optimizer"] = optimizer
        models[name] = model
        reports[name] = evaluate(model, holdout, bundle["spec"]["targets"], allow_synthetic=allow_synthetic)
    delta = {t["id"]: reports["additive"]["metrics"][t["id"]]["binary_cross_entropy"] -
             reports["with_interactions"]["metrics"][t["id"]]["binary_cross_entropy"] for t in bundle["spec"]["targets"]}
    return {"status": "synthetic_comparison" if rows[0]["label_origin"] == "synthetic" else "reviewed_label_comparison_uncalibrated",
            "target_kind": "literature_applicability", "audit": audit, "split": split, "optimizer": optimizer,
            "models": models, "holdout": reports, "bce_reduction_with_interactions": delta,
            "delta_semantics": "positive means lower loss on this holdout only; not automatic model selection",
            "calibrated": False, "empirical_outcome_accuracy": None, "automatic_winner": None}
