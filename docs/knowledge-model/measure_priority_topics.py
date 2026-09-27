"""Measure the priority F02 delta against PR #194, keeping every old ID set.

Regenerate only the corpus inputs if absent; never runs map/edge/D5/P2 outputs.
The 31-row inventory distinguishes explicit aliases, probe hits and research.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import measure_hidden_stages as shared
from foundation_priority import BASE, TOPICS, VOID_ALIASES, load_and_strip

REPO, LEGACY = shared.REPO, shared.LEGACY
REPORT = "정제/문서/설계정본/20260726_사전공백31_코퍼스실측_v1.md"
PROBES = [
    ["합이화", "합이불화", "합화", "화기격", "합화격"], ["합이불합", "합화"],
    ["상형", "부분삼형", "육형", "반형", "인사형", "사인형", "사신형", "신사형", "인신형", "신인형", "축술형", "술축형", "술미형", "미술형", "축미형", "미축형", "인사\n형살", "축술 형살", "자묘형", "자묘상형"],
    ["진방합", "방합"], ["해공", "탈공", "공망 해소"], ["편야도화", "도화격"],
    ["재관인식", "사길신", "4길신"], ["살상겁인", "살상겁효", "사흉신", "4흉신", "사용신", "사형신"],
    ["편인도식", "도식", "탈식", "효신"], ["상관패인", "상관 패인", "상관폐인"],
    ["재생관", "재생生관", "재생관련", "재생관리"], ["관살혼잡", "관살 혼잡", "관성혼잡"],
    ["자매강강", "군겁탈부"], ["재성입묘", "재고귀인"], ["부성입묘"],
    ["전록", "귀록", "호환건록", "전록격", "귀록격"], ["진도화", "가도화"],
    ["삼전공망"], ["록전록후"], ["일귀격"], ["현침살", "현침"],
    ["천문성", "천문살", "술해천문", "수레천문", "술래천문"],
    ["사주풀이 6단계 절차", "통변 순서", "풀이 순서", "사주풀이 순서"],
    ["수승화강"], ["활인업", "활인", "활인성", "활인지명"], ["구류업"],
    ["공망", "천중살", "天中殺", "天中煞"],
    ["천간합", "중정지합", "인의지합", "위엄지합", "음란지합", "무정지합", "인수지합"],
    ["전왕격", "곡직", "염상", "종혁", "윤하", "윤하격", "윤하성", "가색", "일행득기", "일행득기격"],
    ["궁위·자리론", "궁성론", "宮星論", "궁위이론"],
    ["삼형", "무은지형", "지세지형", "무례지형", "시세지형", "무찰지형"],
]


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def pair(baseline):
    old = shared.BASE
    try:
        shared.BASE = BASE
        return shared.load_pair(baseline)
    finally:
        shared.BASE = old


def inventory(before, after, reader):
    from foundation_claims import load_index
    from knowledge_query import query
    graph = json.loads((REPO / "docs/knowledge-model/knowledge_graph.json").read_text())
    index = load_index(graph)
    cards = {r["concept"]: r for r in map(json.loads, (LEGACY / "data/정의카드.jsonl").read_text().splitlines())}
    report = (REPO / REPORT).read_text()
    section = report.split("## 1. ★31행 판정표", 1)[1].split("## 2.", 1)[0]
    original = {int(m[1]): m[2].strip() for m in re.finditer(r"^\| (\d+) \| ([^|]+)\|", section, re.M)}
    if set(original) != set(range(1, 32)) or len(PROBES) != 31:
        raise ValueError("Historical 31-row inventory changed")
    rows = [{"q": {"para_id": str(i)}, "post": {}, "text": term}
            for i, term in enumerate(dict.fromkeys(t for ps in PROBES for t in ps))]
    terms = {r["q"]["para_id"]: r["text"] for r in rows}
    probes = {}
    for label, builders in (("before", before), ("after", after)):
        hits = shared.run_pair(builders, rows, reader, "probes_" + label)
        probes[label] = {term: {b: sorted(c for c, ids in data.items() if pid in ids)
                                for b, data in hits.items()} for pid, term in terms.items()}
    result = []
    for number, ps in enumerate(PROBES, 1):
        queries = {}
        for term in ps:
            q = query(term, graph, claim_index=index)
            queries[term] = {"status": q["status"], "node_id": q.get("node", {}).get("id"),
                             "layer": ("source_claim_review" if q.get("node", {}).get("kind") == "source_review_topic"
                                       else "base_graph" if q["status"] == "found" else "none")}
        entry = {"number": number, "historical_label": original[number], "probes": {}}
        for term in ps:
            owned = {}
            for label, builders in (("before", before), ("after", after)):
                owned[label] = sorted(n for gs in builders[1].TAXONOMY.values() for cs in gs.values()
                                      for n, aa in cs.items() if term == n or term in aa)
            matched = set(probes["after"][term]["neuron"]) | set(probes["after"][term]["concept_map"])
            entry["probes"][term] = {
                "explicit_name_or_alias_owners": owned,
                "literal_probe_hits": {label: data[term] for label, data in probes.items()},
                "research_query": queries[term],
                "existing_cards_for_lexical_hits": {n: {"stored_status": cards[n]["상태"],
                                                        "stored_definitions": len(cards[n]["defs"])}
                                                    for n in sorted(matched & cards.keys())},
            }
        result.append(entry)
    return result


def measure():
    sys.path.insert(0, str(LEGACY))
    import 코퍼스 as reader
    before, after = pair(True), pair(False)
    stripped, extension = load_and_strip(after[1].TAXONOMY)
    if stripped != before[1].TAXONOMY:
        raise ValueError("Priority extension changed old taxonomy")
    rows = list(reader.문단들(제목포함=True))
    previous = json.loads((REPO / "docs/knowledge-model/data/foundation_f02_measurement.json").read_text())
    corpus_hash = shared.sha(json.dumps([[r["q"]["para_id"], r["text"], r["출처종"]] for r in rows],
                                        ensure_ascii=False, separators=(",", ":")).encode())
    if (len(rows) != previous["corpus_rows"] or corpus_hash != previous["corpus_sha256"]
            or len({r["q"]["para_id"] for r in rows}) != len(rows)):
        raise ValueError("Input differs from frozen corpus")
    files = ["build_dashboard.py", "ingest_transcripts.py", "코퍼스.py", "data/posts_all.jsonl",
             "data/paras_all.jsonl", "data/전사_글.jsonl", "data/전사_문단.jsonl", "data/정의카드.jsonl"]
    inputs = {str((LEGACY / p).relative_to(REPO)): shared.sha((LEGACY / p).read_bytes()) for p in files}
    for p in [Path(__file__), Path(shared.__file__), REPO / REPORT,
              REPO / "docs/knowledge-model/foundation_claims.py",
              REPO / "docs/knowledge-model/knowledge_query.py", REPO / "docs/knowledge-model/foundation_priority.py",
              REPO / "docs/knowledge-model/data/foundation_priority_review.json",
              REPO / "docs/knowledge-model/knowledge_graph.json",
              REPO / "docs/knowledge-model/data/foundation_claim_links.json",
              REPO / "docs/knowledge-model/data/context_reviews.json"]:
        inputs[p.relative_to(REPO).as_posix()] = shared.sha(p.read_bytes())
    baseline = shared.run_pair(before, rows, reader, "baseline")
    current = shared.run_pair(after, rows, reader, "current")
    old_names = set(before[0].concept_meta)
    if len(old_names) != 277 or set(after[0].concept_meta) != old_names | TOPICS.keys():
        raise ValueError("Unexpected concept inventory")
    changes = {b: shared.delta(baseline[b], current[b]) for b in baseline}
    old_sets = {}
    for builder in baseline:
        for name in old_names - {"공망"}:
            if baseline[builder].get(name, set()) != current[builder].get(name, set()):
                raise ValueError("Existing concept IDs changed: " + builder + "/" + name)
        void_ids = {r["q"]["para_id"] for r in rows if any(a in r["text"] for a in VOID_ALIASES)}
        if current[builder]["공망"] != baseline[builder]["공망"] | void_ids:
            raise ValueError("Void alias extension differs from literal oracle")
        for name in TOPICS:
            oracle = {r["q"]["para_id"] for r in rows if name in r["text"]}
            if current[builder][name] != oracle:
                raise ValueError("New topic differs from literal oracle")
        if set(changes[builder]) - set(TOPICS) - {"공망"}:
            raise ValueError("Unexpected changed concepts")
        old_sets[builder] = {label: shared.sha(encode({n: sorted(h.get(n, set())) for n in sorted(old_names)}))
                             for label, h in (("before", baseline[builder]), ("after", current[builder]))}
    partial_ids = ["ST-P0332-05", "ST-P1199-12", "T-c0b963860a-0003", "T-4ac66284bb-0006",
                   "T-ae84219fb7-0003", "T-6a38e111e8-0058", "T-ab547d7406-0023", "T-3faedda586-0009",
                   "T-09e2f426c9-0004", "T-09e2f426c9-0007", "T-09e2f426c9-0008"]
    by_id = {r["q"]["para_id"]: r for r in rows}
    if not set(partial_ids) <= by_id.keys() or any(set(partial_ids) & h["삼형"] for h in current.values()):
        raise ValueError("Reviewed partial-punishment omission cases changed")
    matrix = inventory(before, after, reader)
    for p, digest in inputs.items():
        if shared.sha((REPO / p).read_bytes()) != digest:
            raise ValueError("Input changed during measurement: " + p)
    if pair(True)[2] != before[2] or pair(False)[2] != after[2]:
        raise ValueError("Builders changed during measurement")
    return {"schema_version": 1, "base_commit": BASE, "scope": "lexical_retrieval_only",
            "corpus_rows": len(rows), "corpus_sha256": corpus_hash, "title_included": True,
            "gist_included": False, "independent_evidence_count": None,
            "inference_enabled": False, "use_as_training_labels": False, "probability": None,
            "old_concepts_checked": 277, "executable_concepts": 281, "extension": extension,
            "code": {"before": before[2], "after": after[2]}, "inputs": inputs,
            "old_concept_id_set_sha256": old_sets,
            "counts": {b: {n: len(h.get(n, set())) for n in [*TOPICS, "공망", "삼형", "도화"]}
                       for b, h in current.items()},
            "actual_concept_assignment_changes": changes, "gap31_inventory": matrix,
            "reviewed_partial_omissions": [{"para_id": pid, "text_sha256": shared.sha(by_id[pid]["text"].encode()),
                                              "source_file": by_id[pid]["post"].get("file"),
                                              "scope": "reviewed narrow probes, not exhaustive or independent evidence"}
                                             for pid in partial_ids],
            "limits": ["Probe hits are not semantic coverage or approval.",
                       "Stored card status is a historical generated field, not reviewed truth.",
                       "Existing app calculations are audited separately in FOUNDATION_GAP31.md.",
                       "No edge/map/alias-judgment/D5/P2/card/app output is regenerated here."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(json.dumps(measure(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
