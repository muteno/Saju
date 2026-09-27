"""Paired peach-blossom source review; no personal or chart inference.

Both names return the complete comparison. Shared claims/evidence are counted
once, while the eight earlier topics keep their own retrieval contracts.
"""
from copy import deepcopy
import json
from pathlib import Path

from foundation_additions import text_sha
from foundation_livelihood import CombinedIndex, participant
from foundation_partial import load_and_strip as strip_partial
from foundation_priority import REVIEW, validate_and_strip
from foundation_review import TAXONOMY, load_taxonomy
from legacy_import import graph_fingerprint

REPO = Path(__file__).resolve().parents[2]
CATALOG = "docs/knowledge-model/data/foundation_peach_links.json"
TOPICS = {"review_진도화": "진도화", "review_가도화": "가도화"}
# Claim ID -> evidence ID, dependent source family, source system, review status.
BINDINGS = {
    "peach_names": ("peach_sagong_definition", "sajustudy", "saju", "attributed"),
    "peach_base": ("peach_sagong_base", "sajustudy", "saju", "attributed"),
    "peach_narrow": ("peach_sagong_narrow", "sajustudy", "saju", "author_does_not_use_origin_unknown"),
    "peach_hamji": ("peach_hamji_limit", "sajustudy", "saju", "attributed"),
    "peach_effect": ("peach_board_effect", "board_snapshot", "saju", "preserved_snapshot"),
    "peach_table": ("peach_board_table", "board_snapshot", "saju", "preserved_snapshot"),
    "peach_dohwa": ("peach_dohwa_definition", "dohwa_kim_jeonghun", "saju", "unverified_asr"),
    "peach_time": ("peach_dohwa_time", "dohwa_kim_jeonghun", "saju", "unverified_asr"),
    "peach_priority": ("peach_dohwa_priority", "dohwa_kim_jeonghun", "saju", "unverified_asr"),
    "peach_other_system": ("peach_ziwei", "dohwa_kim_jeonghun", "ziwei", "not_a_saju_rule"),
}


def branches(chars, role):
    return [participant(c, role, "branch_" + c) for c in chars]


PARTICIPANTS = {
    "peach_names": [participant("왕지", "가도화의 통용 명칭 범위"),
        *branches("子午卯酉", "왕지의 글자"), participant("년살", "진도화로도 부르는 12신살"),
        participant("목욕", "저자가 산정 기준과 사용방법을 구분")],
    "peach_base": [participant("연지", "기준 자리 선택지"), participant("일지", "기준 자리 선택지"),
        participant("삼합국", "기준 지지가 속한 삼합국"),
        participant("지지", "기준과 대상 글자 범위", "earthly_branches")],
    "peach_narrow": [participant("연지", "기준 자리 선택지"), participant("일지", "기준 자리 선택지"),
        participant("삼합 합화 오행", "도화가 있는 주의 천간에 놓는 오행; 천간합화와 구별"),
        participant("천간", "도화 지지와 같은 주의 천간", "heavenly_stems")],
    "peach_hamji": [participant("함지살", "엄격한 조건과 현대 완화 주장이 공존"),
        participant("납음오행", "도화가 있는 주의 비교 대상"), participant("삼합국 오행", "납음오행과의 비교 기준"),
        participant("일지", "본문의 기준"), participant("연지", "고전 기준이라는 주석")],
    "peach_effect": [participant("왕지", "충/형 발현 주장의 범위"),
        *branches("子午卯酉", "보드가 명시한 자오충·묘유충의 글자"),
        participant("충", "왕지 지지충", "clash"), participant("형", "별도 조건; 기본노드 미등록"),
        participant("십신", "왕지가 어떤 십성인지와 운의 균형을 먼저 확인", "ten_gods"),
        participant("재성", "보드가 따로 언급한 왕지의 십성", "wealth")],
    "peach_table": [participant("연지", "표의 기존 명리 기준"), participant("일지", "표의 현대 명리 기준"),
        participant("삼합국", "년살 표의 분류 기준"), participant("충", "표 주석의 지지충", "clash")],
    "peach_dohwa": [participant("일지", "2020년 전사의 기준 자리"),
        participant("외모·매력", "저자의 설명; 개인 평가값 아님")],
    "peach_time": [participant("일지", "2020년 전사의 기준 자리"),
        *branches("亥卯未", "2020년 예시의 일지 선택지"), participant("자수", "경자년에 들어오는 지지", "branch_子"),
        participant("도화운", "원국 보유와 구별하는 시기 주장"), participant("목욕", "전사에서 유사하게 부르는 명칭")],
    "peach_priority": [participant("일지", "2025년 전사가 언급한 관계의 자리"),
        participant("연지", "2025년 전사가 언급한 관계의 자리"),
        participant("합충의 회파", "미검수 전사 표현; 합충형파해로 교정하지 않음"),
        participant("기문원진", "미검수 전사 표현"), participant("운", "우선순위를 논하는 맥락")],
    "peach_other_system": [participant(n, "자미두수의 용어; 사주 기본노드에 대응하지 않음")
        for n in ("자미두수", "탐랑", "명궁", "관록궁", "노복궁")],
}


def source_table(reference_scope, target_scope, narrow=False):
    # Four rows independently re-read in each bound source. These are recorded
    # alternatives, not executable predicates or source-agreement weights.
    return [{"reference_branch_options": ["branch_" + c for c in group],
             "reference_scope": reference_scope, "target_branch_node_id": "branch_" + target,
             "target_scope": target_scope, "same_pillar_stem_node_id": "stem_" + stem if narrow else None,
             "same_pillar_stem_role": "같은 주의 천간 추가 조건" if narrow else "이 정의에는 추가 천간 조건 없음",
             "application_status": "not_evaluated"}
            for group, target, stem in (("亥卯未", "子", "甲"), ("寅午戌", "卯", "丁"),
                                       ("巳酉丑", "午", "庚"), ("申子辰", "酉", "癸"))]


CONFIGURATIONS = {
    "peach_base": source_table("연지 또는 일지", "다른 지지; 특정 주 한정 없음"),
    "peach_narrow": source_table("연지 또는 일지", "도화 지지와 추가 천간은 같은 주; 일주 한정 아님", True),
    "peach_table": source_table("삼합국 열의 글자 선택지; 연지/일지 헤더·방합국 열의 대응 미검수",
                               "년살 열의 대응 지지; 자리별 적용 계산 안 함"),
    "peach_dohwa": source_table("이 전사에서는 일지", "원국에 해당 글자 존재; 85/87행 모순은 미해결"),
}


def linked_nodes(claim):
    nodes = {p["node_id"] for p in claim["participants"] if p["node_id"] is not None}
    for record in claim["configurations"]:
        nodes.update(record["reference_branch_options"])
        nodes.add(record["target_branch_node_id"])
        if record["same_pillar_stem_node_id"] is not None:
            nodes.add(record["same_pillar_stem_node_id"])
    return nodes


def validate(catalog, graph, review, repo=REPO):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def fields(item, names):
        require(isinstance(item, dict) and set(item) == set(names.split()), "Unexpected peach fields")

    def strings(value):
        require(isinstance(value, list) and bool(value)
                and all(isinstance(v, str) and v.strip() for v in value)
                and len(set(value)) == len(value), "Invalid peach context list")

    fields(catalog, "schema_version scope inference_enabled use_as_training_labels probability graph_fingerprint review_sha256 topics claims")
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1, "Unsupported peach schema")
    require(catalog["scope"] == "source_claim_retrieval" and catalog["inference_enabled"] is False
            and catalog["use_as_training_labels"] is False and catalog["probability"] is None,
            "Peach review cannot activate inference or training")
    require(catalog["graph_fingerprint"] == graph_fingerprint(graph), "Stale peach graph bindings")
    raw = (repo / REVIEW).read_bytes()
    require(catalog["review_sha256"] == text_sha(raw) and review == json.loads(raw), "Stale peach source review")
    prior_taxonomy, _ = strip_partial(load_taxonomy(repo / TAXONOMY), repo)
    validate_and_strip(review, prior_taxonomy, repo)
    evidence = {e["id"]: e for e in review["evidence"]}
    decisions = {d["concept"]: d for d in review["decisions"]}
    topics, claims = catalog["topics"], catalog["claims"]
    require(isinstance(topics, list) and len(topics) == 2
            and {t["id"] for t in topics} == set(TOPICS), "Missing or duplicate peach topic")
    require(isinstance(claims, list) and len(claims) == len(BINDINGS)
            and {c["id"] for c in claims} == set(BINDINGS), "Missing or unreviewed peach claim")
    node_ids = {n["id"] for n in graph["nodes"]}
    for c in claims:
        fields(c, "id topic_ids type statement evidence_ids source_system source_status relations participants configurations conditions exceptions chart_scope time_scope unresolved")
        eid, _, system, status = BINDINGS[c["id"]]
        require(c["topic_ids"] == list(TOPICS) and c["evidence_ids"] == [eid]
                and all(eid in decisions[title]["evidence_ids"] for title in TOPICS.values())
                and eid in evidence, "Peach claim attribution changed")
        require(c["source_system"] == system and c["source_status"] == status, "Peach source boundary changed")
        require(c["type"] in {"definition", "condition", "disagreement"}, "Unknown peach claim type")
        for key in ("statement", "chart_scope", "time_scope"):
            require(isinstance(c[key], str) and c[key].strip(), "Missing peach scope")
        for key in ("conditions", "exceptions", "unresolved"):
            strings(c[key])
        require(c["relations"] == [], "Peach claims are not causal edges")
        require(c["participants"] == PARTICIPANTS[c["id"]], "Unreviewed peach participant")
        require(c["configurations"] == CONFIGURATIONS.get(c["id"], []), "Unreviewed peach configuration")
        require(linked_nodes(c) <= node_ids, "Unknown peach graph node")
    identities = {v for n in graph["nodes"] for v in (n["id"], n["title"], *n["aliases"])}
    linked = set().union(*(linked_nodes(c) for c in claims))
    for t in topics:
        fields(t, "id title anchor_node_ids")
        require(t["title"] == TOPICS[t["id"]], "Unexpected peach topic name")
        require(t["id"] not in identities and t["title"] not in identities, "Peach identity collision")
        strings(t["anchor_node_ids"])
        require(set(t["anchor_node_ids"]) == linked, "Peach anchors differ from reviewed participants")
    return {"topics": 2, "claims": len(claims), "source_relations": 0,
            "source_classifications": 0, "source_configurations": sum(map(len, CONFIGURATIONS.values())),
            "inference_enabled": False, "probability": None}


class PeachIndex:
    def __init__(self, catalog, graph, review, repo=REPO):
        self.counts = validate(catalog, graph, review, repo)
        self._catalog, self._review = deepcopy(catalog), deepcopy(review)

    def check_graph(self, graph):
        if self._catalog["graph_fingerprint"] != graph_fingerprint(graph):
            raise ValueError("Stale peach graph bindings")

    def topics(self):
        return [{"id": t["id"], "title": t["title"], "kind": "source_review_topic",
                 "aliases": [], "evidence_ids": [], "inference_enabled": False} for t in self._catalog["topics"]]

    def retrieve(self, node_id):
        topics = [t for t in self._catalog["topics"] if node_id == t["id"] or node_id in t["anchor_node_ids"]]
        if not topics:
            return None
        titles, ids = {t["title"] for t in topics}, {t["id"] for t in topics}
        decisions = [d for d in self._review["decisions"] if d["concept"] in titles]
        refs = {eid for d in decisions for eid in d["evidence_ids"]}
        evidence = [e for e in self._review["evidence"] if e["id"] in refs]
        by_id = {e["id"]: e for e in evidence}
        claims = [{**c, "source_profile": by_id[c["evidence_ids"][0]]["source_profile"],
                   "source_family": BINDINGS[c["id"]][1], "status": "source_claim",
                   "application_status": "not_evaluated", "inference_enabled": False, "probability": None}
                  for c in self._catalog["claims"] if ids.intersection(c["topic_ids"])]
        return deepcopy({"scope": "source_claim_retrieval", "topics": topics, "claims": claims,
                         "lexical_reviews": decisions, "evidence": evidence,
                         "selection_basis": "explicit_topic_or_anchor_identity; complete_topic_context",
                         "application_status": "not_evaluated", "inference_enabled": False,
                         "use_as_training_labels": False, "probability": None})


def extend_index(base, graph, repo=REPO):
    catalog = json.loads((repo / CATALOG).read_text(encoding="utf-8"))
    review = json.loads((repo / REVIEW).read_text(encoding="utf-8"))
    return CombinedIndex(base, PeachIndex(catalog, graph, review, repo))
