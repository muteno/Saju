"""Two source-reviewed topics composed with the frozen six-topic index.

Participants and source configurations are navigation records, never executable
chart rules, causal edges, occupation recommendations or training labels.
"""
from copy import deepcopy
import json
from pathlib import Path

from foundation_additions import text_sha
from foundation_partial import load_and_strip as strip_partial
from foundation_priority import REVIEW, validate_and_strip
from foundation_review import TAXONOMY, load_taxonomy
from legacy_import import graph_fingerprint

REPO = Path(__file__).resolve().parents[2]
CATALOG = "docs/knowledge-model/data/foundation_livelihood_links.json"
TOPICS = {"review_활인업": "활인업", "review_재고귀인": "재고귀인"}
# Each claim retains one source profile. Family identifies dependence, not a
# count of independent witnesses; the column and video share the same author.
BINDINGS = {
    "livelihood_board": ("활인업", "live_board", "board_snapshot"),
    "livelihood_hyeonmyo": ("활인업", "live_hyeonmyo", "hyeonmyo"),
    "livelihood_plus": ("활인업", "live_plus_limit", "sajuplus"),
    "livelihood_hyomyeong": ("활인업", "live_hyomyeong", "hyomyeong"),
    "livelihood_ordinary": ("활인업", "ordinary_live", "sajuplus"),
    "treasury_definition": ("재고귀인", "wealth_dohwa", "dohwa_kim_jeonghun"),
    "treasury_configuration": ("재고귀인", "wealth_dohwa", "dohwa_kim_jeonghun"),
    "treasury_effort": ("재고귀인", "wealth_dohwa", "dohwa_kim_jeonghun"),
    "treasury_transcript": ("재고귀인", "wealth_transcript", "dohwa_kim_jeonghun"),
    "treasury_board": ("재고귀인", "wealth_board", "board_snapshot"),
    "treasury_tomb": ("재고귀인", "wealth_tomb", "sajustudy"),
    "treasury_hidden_limit": ("재고귀인", "wealth_hidden_limit", "sajustudy"),
    "treasury_ordinary": ("재고귀인", "ordinary_wealth", "dohwa_kim_jeonghun"),
}


def participant(label, role, node_id=None):
    return {"label": label, "role": role, "node_id": node_id}


# Finite, source-reviewed bindings. Missing concepts remain named and unmapped.
PARTICIPANTS = {
    "livelihood_board": [participant("의사", "직업 예시"), participant("상담사", "직업 예시")],
    "livelihood_hyeonmyo": [participant("신금", "나란함을 논하는 글자", "stem_辛"),
        participant("천간", "나란함의 자리 범위", "heavenly_stems"),
        participant("신신병존", "구조 조건"),
        *[participant(n, "직업 예시") for n in ("의사", "간호사", "약사", "상담사", "역술가")]],
    "livelihood_plus": [participant("다른 사람을 위하는 마음가짐", "업종만으로 복을 얻는다는 주장에 대한 제한")],
    "livelihood_hyomyeong": [participant(n, "넓은 직업 범위의 예시")
        for n in ("교육자", "의사", "사회 지도자", "상업", "농업", "서비스업", "3D 직종")],
    "livelihood_ordinary": [],
    "treasury_definition": [participant("토", "땅과 무덤의 비유", "element_토")],
    "treasury_configuration": [participant("일간", "대응표의 기준 자리", "day_master"),
        participant("지지", "해당 글자 존재 범위", "earthly_branches"),
        participant("천간", "추가 발현 조건의 자리 범위", "heavenly_stems")],
    "treasury_effort": [participant("노력", "장점 활용의 요구")],
    "treasury_transcript": [participant("좋은 운", "시기 주장; 기간·종류 미정")],
    "treasury_board": [participant("재성", "확인 대상", "wealth"),
        participant("지장간", "확인 범위", "hidden_stems"), participant("재성입묘", "보드의 표기; 재고귀인 동의어 아님")],
    "treasury_tomb": [participant("갑목", "일간 글자", "stem_甲"),
        participant("일간", "기준 자리", "day_master"), participant("미토", "시지 글자", "branch_未"),
        participant("시지", "해당 예시의 자리"), participant("재성", "묘지 설명 대상", "wealth"),
        participant("묘지", "자리별 해석; 재고귀인 동의어 아님")],
    "treasury_hidden_limit": [participant("지장간", "입묘 표시 반론의 대상", "hidden_stems"),
        participant("천간", "표시/합거 설명 대상", "heavenly_stems"),
        participant("화개", "반론의 범위"), participant("입묘", "지장간과 동일시하지 않는 작용"),
        participant("충", "입묘처럼 보이는 현상의 설명", "clash"),
        participant("형", "입묘처럼 보이는 현상의 설명"), participant("합거", "저자가 구별한 상실 작용")],
    "treasury_ordinary": [],
}


def configuration(day_stems, branch, amplifier, more_effective):
    return {"day_master_options": ["stem_" + s for s in day_stems],
            "branch_node_id": "branch_" + branch, "branch_scope": "지지; 특정 주 한정 없음",
            "additional_stem_node_id": "stem_" + amplifier,
            "additional_stem_scope": "천간; 특정 주 한정 없음",
            "additional_stem_role": "강한 발현의 추가 조건; 기본 해당 조건과 구별",
            "more_effective_day_master": "stem_" + more_effective if more_effective else None,
            "comparison_scope": "해당 지지와 추가 천간을 설명한 이 경우; 수치 미명시",
            "application_status": "not_evaluated"}


# 도화로운 칼럼 1932–1955: five source statements, not five chart evaluators.
CONFIGURATIONS = [configuration("甲乙", "辰", "戊", None), configuration("丙丁", "丑", "辛", "丁"),
                  configuration("戊己", "丑", "癸", "己"), configuration("庚辛", "未", "乙", "辛"),
                  configuration("壬癸", "戌", "丁", "癸")]


def linked_nodes(claim):
    nodes = {p["node_id"] for p in claim["participants"] if p["node_id"] is not None}
    for record in claim["configurations"]:
        nodes.update(record["day_master_options"])
        nodes.update((record["branch_node_id"], record["additional_stem_node_id"]))
    return nodes


def validate(catalog, graph, review, repo=REPO):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def fields(item, names):
        require(isinstance(item, dict) and set(item) == set(names.split()), "Unexpected livelihood fields")

    def strings(value, allow_empty=False):
        require(isinstance(value, list) and (allow_empty or bool(value))
                and all(isinstance(v, str) and v.strip() for v in value)
                and len(set(value)) == len(value), "Invalid livelihood string list")

    fields(catalog, "schema_version scope inference_enabled use_as_training_labels probability graph_fingerprint review_sha256 topics claims")
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1, "Unsupported livelihood schema")
    require(catalog["scope"] == "source_claim_retrieval" and catalog["inference_enabled"] is False
            and catalog["use_as_training_labels"] is False and catalog["probability"] is None,
            "Livelihood layer cannot activate inference or training")
    require(catalog["graph_fingerprint"] == graph_fingerprint(graph), "Stale livelihood graph bindings")
    raw = (repo / REVIEW).read_bytes()
    require(catalog["review_sha256"] == text_sha(raw) and review == json.loads(raw), "Stale priority source review")
    prior_taxonomy, _ = strip_partial(load_taxonomy(repo / TAXONOMY), repo)
    validate_and_strip(review, prior_taxonomy, repo)
    nodes = {n["id"] for n in graph["nodes"]}
    topics, claims = catalog["topics"], catalog["claims"]
    require(isinstance(topics, list) and len(topics) == len(TOPICS)
            and {t["id"] for t in topics} == set(TOPICS), "Missing or duplicate livelihood topic")
    require(isinstance(claims, list) and len(claims) == len(BINDINGS)
            and {c["id"] for c in claims} == set(BINDINGS), "Missing or unreviewed livelihood claim")
    evidence = {e["id"]: e for e in review["evidence"]}
    decisions = {r["concept"]: r for r in review["decisions"]}
    for claim in claims:
        fields(claim, "id topic_id type statement evidence_ids relations participants configurations conditions exceptions chart_scope time_scope unresolved")
        title, eid, _ = BINDINGS[claim["id"]]
        require(claim["topic_id"] == "review_" + title and claim["evidence_ids"] == [eid]
                and eid in decisions[title]["evidence_ids"] and eid in evidence,
                "Livelihood claim attribution changed")
        require(claim["type"] in {"definition", "condition", "exception", "disagreement", "retrieval_limit"}, "Unknown claim type")
        for key in ("statement", "chart_scope", "time_scope"):
            require(isinstance(claim[key], str) and claim[key].strip(), "Missing livelihood context")
        for key in ("conditions", "exceptions"):
            strings(claim[key], allow_empty=True)
        strings(claim["unresolved"])
        require(claim["relations"] == [], "No causal or executable relations in livelihood review")
        require(claim["participants"] == PARTICIPANTS[claim["id"]], "Unreviewed livelihood participant")
        expected = CONFIGURATIONS if claim["id"] == "treasury_configuration" else []
        require(claim["configurations"] == expected, "Unreviewed treasury configuration")
        require(linked_nodes(claim) <= nodes, "Unknown livelihood participant node")
    for topic in topics:
        fields(topic, "id title anchor_node_ids")
        require(topic["title"] == TOPICS[topic["id"]], "Unexpected livelihood topic name")
        require(not any(topic["title"] in [n["id"], n["title"], *n["aliases"]]
                        or topic["id"] == n["id"] for n in graph["nodes"]), "Livelihood topic identity collision")
        strings(topic["anchor_node_ids"])
        linked = set().union(*(linked_nodes(c) for c in claims if c["topic_id"] == topic["id"]))
        require(set(topic["anchor_node_ids"]) == linked, "Livelihood anchors differ from reviewed participants")
    return {"topics": len(topics), "claims": len(claims), "source_relations": 0,
            "source_classifications": 0, "source_configurations": len(CONFIGURATIONS),
            "inference_enabled": False, "probability": None}


class LivelihoodIndex:
    def __init__(self, catalog, graph, review, repo=REPO):
        self.counts = validate(catalog, graph, review, repo)
        self._catalog, self._review = deepcopy(catalog), deepcopy(review)

    def check_graph(self, graph):
        if self._catalog["graph_fingerprint"] != graph_fingerprint(graph):
            raise ValueError("Stale livelihood graph bindings")

    def topics(self):
        return [{"id": t["id"], "title": t["title"], "kind": "source_review_topic",
                 "aliases": [], "evidence_ids": [], "inference_enabled": False} for t in self._catalog["topics"]]

    def retrieve(self, node_id):
        topics = [t for t in self._catalog["topics"] if node_id == t["id"] or node_id in t["anchor_node_ids"]]
        if not topics:
            return None
        titles, ids = {t["title"] for t in topics}, {t["id"] for t in topics}
        decisions = [d for d in self._review["decisions"] if d["concept"] in titles]
        refs = {e for d in decisions for e in d["evidence_ids"]}
        evidence = [e for e in self._review["evidence"] if e["id"] in refs]
        by_id = {e["id"]: e for e in evidence}
        claims = [{**c, "source_profile": by_id[c["evidence_ids"][0]]["source_profile"],
                   "source_family": BINDINGS[c["id"]][2], "status": "source_claim",
                   "application_status": "not_evaluated", "inference_enabled": False, "probability": None}
                  for c in self._catalog["claims"] if c["topic_id"] in ids]
        return deepcopy({"scope": "source_claim_retrieval", "topics": topics, "claims": claims,
                         "lexical_reviews": decisions, "evidence": evidence,
                         "selection_basis": "explicit_topic_or_anchor_identity; complete_topic_context",
                         "application_status": "not_evaluated", "inference_enabled": False,
                         "use_as_training_labels": False, "probability": None})


class CombinedIndex:
    """Join explicit anchor matches only; never traverse newly returned nodes."""
    def __init__(self, base, extension):
        self._indexes = (base, extension)
        self.counts = {key: sum(i.counts.get(key, 0) for i in self._indexes)
                       for key in ("topics", "claims", "source_relations", "source_classifications", "source_configurations")}
        self.counts.update(inference_enabled=False, probability=None)
        # Prevent conflicting identities before any consumer can query the join.
        for key, identity in (("topics", "id"), ("claims", "id"), ("lexical_reviews", "concept"), ("evidence", "id")):
            sets = [{r[identity] for t in i.topics() for r in i.retrieve(t["id"])[key]} for i in self._indexes]
            if sets[0] & sets[1]:
                raise ValueError("Claim layers have overlapping " + key)

    def check_graph(self, graph):
        for index in self._indexes:
            index.check_graph(graph)

    def topics(self):
        return [t for index in self._indexes for t in index.topics()]

    def retrieve(self, node_id):
        records = [r for index in self._indexes if (r := index.retrieve(node_id)) is not None]
        if not records:
            return None
        result = records[0]
        for record in records[1:]:
            for field in ("topics", "claims", "lexical_reviews", "evidence"):
                result[field].extend(record[field])
        return result


def extend_index(base, graph, repo=REPO):
    catalog = json.loads((repo / CATALOG).read_text(encoding="utf-8"))
    review = json.loads((repo / REVIEW).read_text(encoding="utf-8"))
    return CombinedIndex(base, LivelihoodIndex(catalog, graph, review, repo))
