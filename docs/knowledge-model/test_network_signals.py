"""관계망(정제/_현황판) 결정론 층 회귀 검사 — 명식 신호·운 신호·의미 사전 오탐·전사 교정·개념 가림.

원장(data/망/)은 git 밖이라 여기서는 원장 없이 도는 계산만 본다. 확률·정확도는 망_평가.py가 잰다.
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT / "정제" / "_현황판"))   # 뒤에 붙여 다른 검사의 모듈 이름을 가리지 않는다

import 명식  # noqa: E402
import 의미  # noqa: E402


class ChartSignalTests(unittest.TestCase):
    def test_full_chart_signals(self):
        # 1990-05-15 14:30 남 (앱 만세력) = 경오 신사 경진 계미
        r = 명식.명식_신호(["경오", "신사", "경진", "계미"], "M")
        sig = r["신호"]
        self.assertEqual(r["일간"], "경")
        self.assertIn("월지", sig["편관(칠살)"]["자리"])      # 월지 사 본기 병 = 편관
        self.assertIn("일지", sig["편인"]["자리"])            # 일지 진 본기 무 = 편인
        self.assertIn("시간(時干)", sig["상관"]["자리"])       # 시간 계 = 상관
        self.assertIn("괴강", sig)                           # 경진 괴강
        self.assertEqual(sig["편관(칠살)"]["맥락"], ("월지",))    # 자리 맥락은 그대로
        self.assertEqual(sig["편관(칠살)"]["성맥락"], ("성:남",))  # 성별을 알면 육친 의미만 성별 관점 문단에서
        self.assertEqual(sig["괴강"]["맥락"], ())
        sig2 = 명식.명식_신호(["경오", "신사", "경진", "계미"])["신호"]
        self.assertNotIn("성맥락", sig2["편관(칠살)"])          # 성별을 모르면 자리만

    def test_day_branch_category(self):
        sig = 명식.명식_신호([None, None, "병오", None])["신호"]
        self.assertIn("왕지(도화)", sig)                      # 일지 오 = 왕지 → 도화 자리(일주론 관례)
        self.assertIn("양인", sig)
        self.assertNotIn("신강", sig)                         # 일주만으로는 강약을 안 낸다

    def test_luck_signals(self):
        u = 명식.운_신호(["경오", "신사", "경진", "계미"], "갑신")
        self.assertIn("편재", u)                              # 운 천간 갑 = 편재
        self.assertIn("비견", u)                              # 운 지지 신 본기 경 = 비견
        self.assertIn("천간충", u)                            # 갑경충
        self.assertIn("육합", u)                              # 사신합
        self.assertEqual(set(u["육합"]["맥락"]), {"신금(申)", "사화(巳)"})
        uf = 명식.운_신호(["경오", "신사", "경진", "계미"], "갑신", "대운", "F")
        self.assertEqual(uf["편재"]["성맥락"], ("성:여",))
        self.assertIn("원국과 축미술 삼형 완성", " ".join(명식.운_신호(["을축", "갑신", "병오", "을미"], "병술", "세운")["삼형"]["근거"]))


class MeaningLexiconTests(unittest.TestCase):
    NEG = {  # 낱말 속·전사 오류 오탐 — 다시 잡히면 안 된다
        "공부도 하고": "재물 손실", "받아들이는": "자녀", "해외로 나가": "고독·외로움",
        "높아집니다": "고집·자존심", "찾아내는": "결혼·배우자", "걱정이 많을": "배려·봉사",
        "변화를 잘 이": "급함·분노", "행정직": "책임·원칙", "목적성이": "적성·진로",
        "남자친구가": "형제·친구", "아프리카": "건강·질병", "손재주가": "재물 손실",
        "주입시키는": "학업·시험", "감옥 입장에서": "구설·송사", "이민 대운": "이동·해외",
        "겁재운이": "재물 축적", "업데이트": "연애·이성", "깔끔하게 없는": "깔끔·완벽",
        "번원만큼": "원만·온화", "초코명리의 총명입니다": "지식·탐구", "타고난 명": "고생·고난",
        "고지식하고": "지식·탐구",
        "삶을 이끌어가는": "주도·리더십", "원칙적으로 일주가": "책임·원칙", "정직이 되든지 퇴직": "책임·원칙",
        "자기 말을 잘 따르고": "표현·언변", "혁명성입니다": "명예·체면", "차질을 빚게": "재물 손실",
        "이 친구가 일간을 괴롭히는": "형제·친구",
    }
    POS = {
        "감옥에 갇혔다": "구설·송사", "이민을 갔다": "이동·해외", "카리스마 있는": "주도·리더십",
        "불면증": "불안·우울", "원만한 성격": "원만·온화", "총명한 아이": "지식·탐구",
        "고생을 많이": "고생·고난", "외로움을 탄다": "고독·외로움",
        "사람들을 이끌어 가는": "주도·리더십", "정직하고 반듯한": "책임·원칙", "명성을 얻는다": "명예·체면",
        "빚을 지고": "재물 손실", "친구가 많다": "형제·친구",
    }

    def test_false_positives_stay_blocked(self):
        for text, m in self.NEG.items():
            self.assertNotIn(m, 의미.의미들(text), text)

    def test_true_positives_still_found(self):
        for text, m in self.POS.items():
            self.assertIn(m, 의미.의미들(text), text)


class LedgerTextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import build_망
        cls.B = build_망

    def test_transcript_corrections(self):
        f = self.B.전사_교정
        self.assertEqual(f("평관이 있으면"), "편관이 있으면")
        self.assertEqual(f("감옥 일관의 입장에서"), "갑목 일간의 입장에서")
        self.assertEqual(f("감옥에 갇혔다"), "감옥에 갇혔다")
        self.assertEqual(f("정제된 자료"), "정제된 자료")
        self.assertEqual(f("일관된 태도"), "일관된 태도")

    def test_gender_context(self):
        self.assertEqual(self.B.성별맥락("남자의 경우 재성이 아내"), {"성:남"})
        self.assertEqual(self.B.성별맥락("여자는 관성이 남편"), {"성:여"})
        self.assertEqual(self.B.성별맥락("남자는 그렇고 여자는 이렇다"), set())

    def test_concept_masking_and_supplement(self):
        self.assertNotIn("육해", self.B.개념_가리기("교육해 주시는"))
        self.assertNotIn("도화", self.B.개념_가리기("도화로운 사이트에 정리"))
        self.assertIn("도화", self.B.개념_가리기("도화살이 있으면"))
        g = self.B.개념_가리기
        self.assertNotIn("상관", g("외모하고는 상관이 없어요") + g("상관없이 하는") + g("오행의 상관관계"))
        self.assertIn("상관", g("상관이 있으면 말을 잘한다"))
        self.assertNotIn("비겁", g("비겁한 사람"))
        self.assertIn("비겁", g("비겁하고 편재가 강한"))
        self.assertIn("관대지", self.B.개념_가리기("관대지에 놓인"))
        self.assertEqual(self.B.보충개념("병화 일간이 신월에 태어났다"), {"신금(申)", "월지"})
        self.assertEqual(self.B.보충개념("사월 초파일"), set())
        self.assertEqual(self.B.보충개념("孔子께서"), set())


class AnswerUpdateTests(unittest.TestCase):
    def test_answer_scales_by_share(self):
        """답 반영: 그 의미를 가장 크게 받친 개념이 ×(1±답폭), 덜 받친 개념은 받친 몫만큼, 안 받친 개념은 그대로."""
        import types
        import numpy as np
        import 풀이
        net = types.SimpleNamespace(meanings=["가", "나"])
        기여 = {"A": np.array([1.0, 0.0]), "B": np.array([0.5, 0.2]), "C": np.array([-0.3, 0.4])}
        yes = 풀이._답배수(net, 기여, {"가": True})
        self.assertAlmostEqual(yes["A"], 1 + 풀이.답폭)
        self.assertAlmostEqual(yes["B"], 1 + 풀이.답폭 * 0.5)
        self.assertNotIn("C", yes)
        no = 풀이._답배수(net, 기여, {"가": False})
        self.assertAlmostEqual(no["A"], 1 - 풀이.답폭)


if __name__ == "__main__":
    unittest.main()
