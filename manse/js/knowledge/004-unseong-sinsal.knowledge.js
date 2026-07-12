// 004-unseong-sinsal.knowledge.js — 십이운성·십이신살·공망 규칙 (만세력 지식모듈 SSOT)
// 근거: 십이운성 = 양간 순행·음간 역행 통설(장생 기점표). 십이신살 = 삼합 기준 겁살 기점 순환.
//       공망 = 60갑자 순중공망(旬中空亡). 셋 다 기계 판정 가능한 확정 규칙.

export const UNSEONG_STAGES = Object.freeze([
  '장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양',
]);

// 각 천간의 장생 지지 idx (甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯)
export const UNSEONG_START = Object.freeze([11, 6, 2, 9, 2, 9, 5, 0, 8, 3]);

export function unseongOf(stemIdx, branchIdx) {
  const dir = stemIdx % 2 === 0 ? 1 : -1; // 양간 순행, 음간 역행
  const step = ((branchIdx - UNSEONG_START[stemIdx]) * dir % 12 + 12) % 12;
  return UNSEONG_STAGES[step];
}

// 십이신살: 기준지(년지 또는 일지)의 삼합국 → 겁살 기점에서 순차 12신살
export const SINSAL_ORDER = Object.freeze([
  '겁살', '재살', '천살', '지살', '년살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살',
]);

// 삼합국별 겁살 기점: 申子辰(수국)→巳, 寅午戌(화국)→亥, 巳酉丑(금국)→寅, 亥卯未(목국)→申
const SAMHAP_ANCHOR = Object.freeze({ 8: 5, 0: 5, 4: 5, 2: 11, 6: 11, 10: 11, 5: 2, 9: 2, 1: 2, 11: 8, 3: 8, 7: 8 });

export function sinsalOf(baseBranchIdx, targetBranchIdx) {
  const anchor = SAMHAP_ANCHOR[baseBranchIdx];
  return SINSAL_ORDER[((targetBranchIdx - anchor) % 12 + 12) % 12];
}

// 순중공망: 일주 60갑자 idx → 공망 지지 idx 2개 (갑자순 戌亥 → 순차 2칸씩 당겨짐)
export function gongmangOf(dayIdx60) {
  const decade = Math.floor((((dayIdx60 % 60) + 60) % 60) / 10);
  return [((10 - 2 * decade) % 12 + 12) % 12, ((11 - 2 * decade) % 12 + 12) % 12];
}

export const UNSEONG_SINSAL_SOURCE_NOTE =
  '십이운성 음간 역행은 일부 유파가 화토동법 등 변형을 쓰지만 본표는 수토동법 아닌 고전 기점표(양생음사)를 채택. ' +
  '신살은 년지 기준이 고전, 일지 기준 병용이 현대 관행 — 기준 선택을 UI 옵션으로 노출한다.';
