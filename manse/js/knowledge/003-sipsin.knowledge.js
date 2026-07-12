// 003-sipsin.knowledge.js — 십신(十神)·육친 판정 규칙 (만세력 지식모듈 SSOT)
// 근거: 자평명리 공통 규칙 — 아생자 식상 / 아극자 재성 / 극아자 관성 / 생아자 인성 / 동아자 비겁.
//       음양 동성 = 편(偏)측, 이성 = 정(正)측. (식신·상관은 동성=식신, 이성=상관)
// 입력 계약: 일간 STEMS idx, 대상 STEMS idx → 십신 이름. 지지는 본기 천간으로 환산 후 호출.

import { STEMS, generates, controls } from './001-ganji.knowledge.js';

export const TEN_GODS = Object.freeze([
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
]);

export function sipsinOf(dayStemIdx, targetStemIdx) {
  if (dayStemIdx === targetStemIdx) return '비견';
  const me = STEMS[dayStemIdx], other = STEMS[targetStemIdx];
  const same = me.yang === other.yang;
  if (me.el === other.el) return same ? '비견' : '겁재';
  if (generates(me.el, other.el)) return same ? '식신' : '상관';
  if (controls(me.el, other.el))  return same ? '편재' : '정재';
  if (controls(other.el, me.el))  return same ? '편관' : '정관';
  if (generates(other.el, me.el)) return same ? '편인' : '정인';
  return '?'; // 도달 불가(오행 5분류 완전 분할)
}

// 육친 대응(참고 표기) — 남녀 공통 주류 표기만 담는다
export const YUKCHIN = Object.freeze({
  비견: '형제·동료', 겁재: '이복형제·경쟁자',
  식신: '남:장인/여:딸', 상관: '남:조모/여:아들',
  편재: '부친·애인', 정재: '남:처/공통:재물',
  편관: '남:아들/여:정부 외 남', 정관: '남:딸/여:남편',
  편인: '계모·이모', 정인: '모친',
});

export const SIPSIN_SOURCE_NOTE =
  '십신 판정은 유파 무관 공통 공식. 육친 대응은 표기 차가 있어 주류 표기만 채택(해석 문장은 싣지 않음 — 저작권·검증불가 영역).';
