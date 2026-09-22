"""Corpus-grounded pilot: stem properties, five-element relations and ten gods.

This module accepts already supplied heavenly stems. It does not convert birth
dates, calculate earthly branches/hidden stems, assess strength/season/root,
resolve combinations/clashes, or predict events. The sole interpretive pattern
is 식신생재, reported only as a structural candidate requiring review. No scores,
financial predictions, medical conclusions or production-readiness are implied.

Source-reference keys are resolved in the accompanying knowledge-graph artifact;
they are provenance identifiers, not evidence of interpretive validation.

Usage: python rules_engine.py --input examples.json --example complete_candidate
       python -m unittest -v test_rules.py
"""

import argparse
import json
from collections import Counter
from pathlib import Path


STEMS = {
    "갑": ("목", "양"), "을": ("목", "음"),
    "병": ("화", "양"), "정": ("화", "음"),
    "무": ("토", "양"), "기": ("토", "음"),
    "경": ("금", "양"), "신": ("금", "음"),
    "임": ("수", "양"), "계": ("수", "음"),
}
HANJA = dict(zip("甲乙丙丁戊己庚辛壬癸", STEMS))
GENERATES = {"목": "화", "화": "토", "토": "금", "금": "수", "수": "목"}
CONTROLS = {"목": "토", "토": "수", "수": "화", "화": "금", "금": "목"}
TEN_GODS = {
    ("same", True): "비견", ("same", False): "겁재",
    ("generates", True): "식신", ("generates", False): "상관",
    ("controls", True): "편재", ("controls", False): "정재",
    ("controlled_by", True): "편관", ("controlled_by", False): "정관",
    ("generated_by", True): "편인", ("generated_by", False): "정인",
}
PROVENANCE = {
    "stem_properties": "source:stem_properties",
    "five_element_cycles": "source:five_element_cycles",
    "ten_god_definition": "source:ten_god_definition",
    "siksin_saengjae_candidate": "source:siksin_saengjae_candidate",
}
REVIEW_REQUIREMENTS = [
    {"id": "strength", "label": "일간과 각 오행의 강약", "status": "not_implemented"},
    {"id": "season", "label": "월령·계절 조건", "status": "not_implemented"},
    {"id": "root", "label": "지지·지장간·통근", "status": "not_implemented"},
    {"id": "interactions", "label": "합·충 및 경로를 바꾸는 조건", "status": "not_implemented"},
    {"id": "rule_conditions", "label": "원문별 성립·예외 조건 대조", "status": "needs_review"},
]
POSITION_ORDER = ("year", "month", "day", "hour")


class ValidationError(ValueError):
    """Explicit input error; the engine does not fill in missing chart data."""


def normalize_stem(value):
    if not isinstance(value, str):
        raise ValidationError("gan must be one of 갑을병정무기경신임계 or its Hanja equivalent")
    normalized = HANJA.get(value, value)
    if normalized not in STEMS:
        raise ValidationError("unsupported gan: " + repr(value))
    return normalized


def element_relation(source_element, target_element):
    """Return the directed relationship from source to target."""
    if (not isinstance(source_element, str) or not isinstance(target_element, str)
            or source_element not in GENERATES or target_element not in GENERATES):
        raise ValidationError("element must be one of 목, 화, 토, 금, 수")
    if source_element == target_element:
        return "same"
    if GENERATES[source_element] == target_element:
        return "generates"
    if GENERATES[target_element] == source_element:
        return "generated_by"
    if CONTROLS[source_element] == target_element:
        return "controls"
    return "controlled_by"


def ten_god(daymaster, target):
    """Classify one target stem relative to a supplied daymaster stem."""
    daymaster, target = normalize_stem(daymaster), normalize_stem(target)
    source_element, source_polarity = STEMS[daymaster]
    target_element, target_polarity = STEMS[target]
    relation = element_relation(source_element, target_element)
    same_polarity = source_polarity == target_polarity
    return {
        "daymaster": daymaster,
        "target": target,
        "ten_god": TEN_GODS[(relation, same_polarity)],
        "trace": [
            {"step": "stem_properties", "daymaster_element": source_element,
             "daymaster_polarity": source_polarity, "target_element": target_element,
             "target_polarity": target_polarity,
             "source_ref": PROVENANCE["stem_properties"]},
            {"step": "element_relation", "direction": "daymaster_to_target",
             "relation": relation, "source_ref": PROVENANCE["five_element_cycles"]},
            {"step": "polarity", "relation": "same" if same_polarity else "opposite"},
            {"step": "ten_god", "value": TEN_GODS[(relation, same_polarity)],
             "source_ref": PROVENANCE["ten_god_definition"]},
        ],
    }


def validate_chart(chart):
    if not isinstance(chart, dict):
        raise ValidationError("input must be an object")
    if set(chart) != {"stems", "hour_unknown"}:
        raise ValidationError("input must contain exactly stems and hour_unknown")
    if not isinstance(chart["hour_unknown"], bool):
        raise ValidationError("hour_unknown must be a boolean")
    if not isinstance(chart["stems"], list):
        raise ValidationError("stems must be a list")
    records, seen_ids, seen_positions = [], set(), set()
    for item in chart["stems"]:
        if not isinstance(item, dict) or set(item) != {"id", "gan", "position"}:
            raise ValidationError("each stem must contain exactly id, gan and position")
        record_id, position = item["id"], item["position"]
        if not isinstance(record_id, str) or not record_id.strip() or record_id != record_id.strip():
            raise ValidationError("stem id must be a nonempty string without outer whitespace")
        if not isinstance(position, str) or position not in POSITION_ORDER:
            raise ValidationError("position must be year, month, day or hour")
        if record_id in seen_ids or position in seen_positions:
            raise ValidationError("stem ids and positions must be unique")
        seen_ids.add(record_id)
        seen_positions.add(position)
        records.append({"id": record_id, "gan": normalize_stem(item["gan"]), "position": position})
    required = {"year", "month", "day"}
    if not chart["hour_unknown"]:
        required.add("hour")
    missing = required - seen_positions
    if missing:
        raise ValidationError("missing required positions: " + ", ".join(sorted(missing)))
    return sorted(records, key=lambda item: POSITION_ORDER.index(item["position"]))


def _siksin_saengjae(daymaster, observations, hour_unknown):
    food = [item for item in observations if item["ten_god"] == "식신"]
    wealth = [item for item in observations if item["ten_god"] in ("편재", "정재")]
    paths = []
    for first in food:
        for second in wealth:
            first_element, second_element = STEMS[first["gan"]][0], STEMS[second["gan"]][0]
            # Co-occurrence alone is not the rule: verify its directed generating edge.
            if element_relation(first_element, second_element) == "generates":
                paths.append({
                    "node_ids": [daymaster["id"], first["id"], second["id"]],
                    "edges": [
                        {"from": daymaster["id"], "to": first["id"], "relation": "generates",
                         "relative_ten_god": "식신"},
                        {"from": first["id"], "to": second["id"], "relation": "generates",
                         "target_ten_god_relative_to_daymaster": second["ten_god"]},
                    ],
                    "source_refs": [PROVENANCE["five_element_cycles"],
                                    PROVENANCE["ten_god_definition"]],
                })
    missing_observed_roles = []
    if not food:
        missing_observed_roles.append("식신")
    if not wealth:
        missing_observed_roles.append("재성(편재 또는 정재)")
    checks = [dict(item) for item in REVIEW_REQUIREMENTS]
    if hour_unknown:
        checks.append({"id": "hour", "label": "시주 미상", "status": "unknown"})
    return {
        "rule_id": "candidate:siksin_saengjae",
        "term": "식신생재",
        "status": "needs_review" if paths else "not_observed",
        "structural_candidate": bool(paths),
        "evaluation_scope": "known_heavenly_stems_only",
        "observed_roles": {"식신": [item["id"] for item in food],
                           "재성": [item["id"] for item in wealth]},
        "missing_observed_roles": missing_observed_roles,
        "paths": paths,
        "interpretation": {
            "status": "blocked",
            "reason": "천간 생성 경로만으로 원국 전체의 식신생재 성립이나 현실 결과를 확정할 수 없습니다.",
            "missing_checks": checks,
        },
        "absence_is_chart_wide_conclusion": False,
        "source_ref": PROVENANCE["siksin_saengjae_candidate"],
    }


def analyze_chart(chart):
    records = validate_chart(chart)
    daymaster = next(item for item in records if item["position"] == "day")
    observations, exclusions = [], []
    for item in records:
        if item["position"] == "day":
            exclusions.append({"id": item["id"], "reason": "daymaster_is_reference_not_additional_peer"})
            continue
        if item["position"] == "hour" and chart["hour_unknown"]:
            exclusions.append({"id": item["id"], "reason": "hour_unknown"})
            continue
        result = ten_god(daymaster["gan"], item["gan"])
        observations.append({**item, "ten_god": result["ten_god"], "trace": result["trace"]})
    if chart["hour_unknown"] and not any(item["position"] == "hour" for item in records):
        exclusions.append({"position": "hour", "reason": "hour_unknown_not_supplied"})
    return {
        "schema_version": "1.0-pilot",
        "scope": "천간 구조 계산 시범; 생년월일 변환·종합 명리 해석 미구현",
        "daymaster": daymaster,
        "hour_unknown": chart["hour_unknown"],
        "observations": observations,
        "ten_god_counts": dict(Counter(item["ten_god"] for item in observations)),
        "exclusions": exclusions,
        "pattern_checks": [_siksin_saengjae(daymaster, observations, chart["hour_unknown"])],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Input chart JSON, or named examples JSON")
    parser.add_argument("--example", help="Named example to select from examples.json")
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        if args.example:
            if not isinstance(payload, dict) or args.example not in payload:
                raise ValidationError("unknown example: " + args.example)
            payload = payload[args.example]
        result = analyze_chart(payload)
    except (ValidationError, json.JSONDecodeError, OSError) as exc:
        print(json.dumps({"status": "validation_error", "message": str(exc)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
