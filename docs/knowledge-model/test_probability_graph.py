"""문헌 관계 확률·맥락·홀드아웃·도식의 계약. 작은 원장으로 실제 망 생성자를 실행한다."""
import copy
import json
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

import numpy as np
from scipy import sparse

sys.path.append(str(Path(__file__).resolve().parents[2] / "정제" / "_현황판"))
import 망 as M
from 관계도 import 관계망
from 개념카드 import 카드


class ProbabilityGraphTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        nodes = ["A", "B", "조건", "동일", "없음"]
        meanings = ["긍정", "다른"]
        cols = nodes + ["의:" + m for m in meanings]
        # A↔동일은 완전히 같은 출현. 조건·관법별 B/긍정 비율은 서로 반대다.
        blocks = [(120, ["A", "B", "동일", "조건"], "긍정", 0),
                  (40, ["A", "동일", "조건"], "다른", 0),
                  (80, ["A", "동일"], "다른", 0),
                  (60, ["B"], "다른", 0),
                  (20, ["A", "B", "동일", "조건"], "다른", 1),
                  (120, ["A", "동일", "조건"], "다른", 1)]
        Q, S, post, kw = [], [], [], []
        for i, (count, cs, meaning, school) in enumerate(blocks):
            for _ in range(count):
                Q.append([int(c in cs) for c in nodes])
                S.append([int(c in cs or c == "의:" + meaning) for c in cols])
                post.append(i)
                kw.append(school)
        self.q = np.array(Q, dtype=np.uint8)
        meta = {"nodes": nodes, "meanings": meanings, "cols": cols,
                "관법": ["K", "L"], "post_ids": ["p" + str(i) for i in range(len(blocks))]}
        (self.path / "meta.json").write_text(json.dumps(meta))
        for name, values in (("S", S), ("C", Q), ("Q", Q)):
            sparse.save_npz(self.path / (name + ".npz"), sparse.csc_matrix(values, dtype=np.uint8))
        np.savez(self.path / "rows.npz", post=post, kw=kw, para=np.arange(len(post)))
        np.savez(self.path / "paras.npz", post=post, kw=kw)
        sparse.save_npz(self.path / "T.npz", sparse.csc_matrix(([1], ([3], [0])), shape=(6, len(nodes))))
        self.patch = patch.object(M, "D", self.path)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.net = M.망()

    def test_directed_counts_and_probability(self):
        ab = self.net.개념분포("A")["B"]
        ba = self.net.개념분포("B")["A"]
        self.assertEqual(ab[3:], (380, 140))
        self.assertEqual(ba[3:], (200, 140))
        self.assertLess(ab[0], ba[0])
        self.assertAlmostEqual(self.net.강도("A", "B"), self.net.강도("B", "A"))
        self.assertNotAlmostEqual(ab[0], self.net.강도("A", "B"))
        for p, lo, hi, _, _ in (ab, ba):
            self.assertLess(lo, p)
            self.assertLess(p, hi)
            self.assertTrue(0 <= lo < hi <= 1)

    def test_same_school_different_context_and_same_context_different_school(self):
        plain = self.net.개념분포("A", "K")["B"]
        chosen = self.net.개념분포("A", "K", ("조건",))["B"]
        other = self.net.개념분포("A", "L", ("조건",))["B"]
        self.assertEqual(chosen[3:], (160, 120))
        self.assertGreater(chosen[0], plain[0])
        self.assertGreater(chosen[0], other[0])
        self.assertNotIn("A", self.net.개념분포("A"))
        self.assertNotIn("조건", self.net.개념분포("A", 맥락=("조건",)))
        self.assertEqual(chosen, self.net.개념분포("A", "K", ("A", "조건", "조건"))["B"])
        self.assertEqual(self.net.의미분포("A"), self.net.의미분포("A", 맥락=("A",)))
        self.assertEqual(self.net.의미분포("A", "K", ("조건",)),
                         self.net.의미분포("A", "K", ("A", "조건", "조건")))

    def test_holdout_applies_to_counts_prior_and_graph(self):
        net = M.망(제외_글={"p0"})
        d = net.개념분포("A", "K", ("조건",))["B"]
        self.assertEqual(d[3:], (40, 0))
        self.assertLess(d[0], self.net.개념분포("A", "K", ("조건",))["B"][0])
        graph = 관계망(net, "K", ("조건",), ["A"])
        self.assertFalse(any(e["끝"] in ("B", "의:긍정") for e in graph["관계"]))

    def test_empty_context_is_not_observed_evidence(self):
        d = self.net.개념분포("A", 맥락=("없음",))["B"]
        self.assertEqual(d[3:], (0, 0))
        self.assertAlmostEqual(d[0], self.net.개념분포("A")["B"][0])
        graph = 관계망(self.net, 맥락=("없음",))
        self.assertEqual(graph["선택문단"], 0)
        self.assertEqual(graph["관계"], [])
        self.assertGreater(graph["표시"]["숨김"]["근거부족"], 0)
        json.dumps(graph, allow_nan=False)
        with self.assertRaises(ValueError):
            관계망(M.망(제외_글=set(self.net.post_ids)))

    def test_title_evidence_keeps_source_paragraph_filter(self):
        net = M.망(제목무게=1)
        # p3의 제목은 A지만 본문에는 B만 있다. 맥락 A를 요구하면 이 60문장을 포함하면 안 된다.
        self.assertEqual(net.의미분포("A")["다른"][3], 440)
        self.assertEqual(net.의미분포("A", 맥락=("A",))["다른"][3], 380)

    def test_zero_distance_edge_is_not_deleted(self):
        self.assertEqual(self.net.강도("A", "동일"), 1)
        self.assertEqual(self.net.거리("A", "동일"), 0)
        self.assertEqual(self.net.경로("A", "동일"), [("A", 1), ("동일", 1)])
        self.assertTrue(np.isinf(self.net.거리("A", "없음")))
        self.assertEqual(self.net.경로("A", "없음"), [])

    def test_card_context_reaches_conditions_school_comparison_similarity_and_baseline(self):
        chosen = ("조건",)
        c = 카드(self.net, "A", "K", chosen, 근거=False)
        expected = self.net.의미분포("A", "K", chosen)["긍정"][0]
        self.assertEqual(c["관법별"]["긍정"]["K"], expected)
        self.assertAlmostEqual(c["개념확률"][0]["분모"], 160)
        self.assertFalse(any(e["조건"] == "조건" for v in c["조건"].values() for es in v.values() for e in es))
        n = self.net.카드("A", "K", chosen)
        r = next(r for r in n["의미"] if r[0] == "긍정")
        self.assertAlmostEqual(r[4], expected / self.net.기준률("K", chosen)[0])
        # 맥락을 바꾸면 닮음의 최소 문장수도 그 맥락에서 센다.
        self.assertEqual(self.net.닮은개념("A", 맥락=("없음",)), [])

    def test_graph_matches_engine_and_accounts_for_display_filter(self):
        graph = 관계망(self.net, "K", ("조건",), ["A"], 이웃=1)
        self.assertEqual(len(graph["관계"]), 2)
        self.assertGreater(graph["표시"]["숨김"]["표시상한"], 0)
        self.assertEqual(graph["선택문단"], 160)
        self.assertEqual(next(n["문장"] for n in graph["노드"] if n["id"] == "의:긍정"), 120)
        for e in graph["관계"]:
            if e["종류"] == "개념":
                d = self.net.개념분포("A", "K", ("조건",))[e["끝"]]
                self.assertEqual(e["단위"], "문단")
            else:
                d = self.net.의미분포("A", "K", ("조건",))[e["끝"][2:]]
                self.assertEqual(e["단위"], "문장")
            self.assertEqual((e["확률"], *e["구간90"], e["분모"], e["동시"]), d)
        json.dumps(graph, allow_nan=False)

    def test_invalid_queries_fail_explicitly(self):
        for kwargs in ({"맥락": ["오타"]}, {"관법": "오타"}, {"개념": []}, {"이웃": 0}, {"최소동시": 0}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                관계망(self.net, **kwargs)

    def test_evaluation_holds_out_whole_posts_and_excludes_given_answers(self):
        from 관계검증 import 실행
        r = 실행(self.net, 겹=2, 조건=[("조건", None, ("조건",))])
        self.assertEqual(sum(f["평가문단"] for f in r["분할크기"]), 440)
        self.assertTrue(all(f["학습문단"] + f["평가문단"] == 440 for f in r["분할크기"]))
        self.assertEqual(r["결과"]["전체"]["판정수"], 5040)
        self.assertEqual(r["결과"]["조건"]["판정수"], 3420)
        json.dumps(r, allow_nan=False)

    def test_meaning_evaluation_matches_query_engine_with_redundant_context(self):
        import 조건검증 as V
        with patch.object(M, "망", return_value=self.net), patch.object(V, "조건들", {"맥락": ["조건"]}):
            result = V.실행(보기=False, 겹=2)["맥락"]
        fold = np.array([zlib.crc32(p.encode()) % 2 for p in self.net.post_ids])
        score, pairs = 0.0, 0
        for f in range(2):
            train = copy.copy(self.net)
            train._cache = {}
            train.base = self.net.base & (fold[self.net.post] != f)
            train.qbase = self.net.qbase & (fold[self.net.qpost] != f)
            rows = self.net.행(맥락=("조건",)) & (fold[self.net.post] == f)
            for A in self.net.nodes:
                selected = np.flatnonzero(rows & self.net._col(self.net.S, self.net.ci[A]))
                if not len(selected):
                    continue
                d = train.의미분포(A, 맥락=("조건",))
                p = np.array([d[m][0] for m in self.net.meanings])
                k = np.asarray(self.net.Sm[selected].sum(0)).ravel()
                score += (k * np.log(p) + (len(selected) - k) * np.log1p(-p)).sum()
                pairs += len(selected)
        self.assertAlmostEqual(result["조건"], score / pairs)


if __name__ == "__main__":
    unittest.main()
