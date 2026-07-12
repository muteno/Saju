// 005-strength-yongsin.knowledge.js — 신강신약 가중치·용신 힌트 규칙 (만세력 지식모듈 SSOT)
// 근거: 억부(득령·득지·득세) 통설을 "점수화한 간이 모델". 수치 가중치 자체는 유파 합의가 없는
//       휴리스틱이므로 반드시 '참고용' 라벨과 함께 노출한다(정본 아님 — 이 모듈의 정직성 계약).
// 참조 사이트(manse.sajuplus.net)의 분석 방향: 용신찾기 = 억부·조후·통관 3축 — 여기선 억부+조후 구현, 통관은 차기.

export const STRENGTH_WEIGHTS = Object.freeze({
  월지: 30, 일지: 15, 시지: 10, 년지: 5, 년간: 10, 월간: 12, 시간: 8, // 총 90
});
export const STRENGTH_THRESHOLDS = Object.freeze({ 신강: 45, 중화: 35 }); // 이상=신강, 이상=중화, 미만=신약

// 일간을 돕는 오행인가(비겁 = 동일 오행, 인성 = 나를 생하는 오행)
import { generates } from './001-ganji.knowledge.js';
export const isHelper = (dayEl, otherEl) => dayEl === otherEl || generates(otherEl, dayEl);

// 억부 힌트: 신강 → 식상·재성·관성(설기/분산/제어) 중 부족 오행, 신약 → 인성·비겁 중 부족 오행
export function eokbuHint(strengthLabel, dayElIdx, elementCounts, ELEMENTS) {
  const pick = (idxList) => idxList
    .map((i) => ({ el: ELEMENTS[i], n: elementCounts[ELEMENTS[i]] || 0 }))
    .sort((a, b) => a.n - b.n)[0].el;
  if (strengthLabel === '신강') return pick([(dayElIdx + 1) % 5, (dayElIdx + 2) % 5, (dayElIdx + 3) % 5]);
  if (strengthLabel === '신약') return pick([(dayElIdx + 4) % 5, dayElIdx]);
  return null; // 중화 = 억부 지정 보류
}

// 조후 힌트: 겨울생(亥子丑월) → 화, 여름생(巳午未월) → 수 (궁통보감 계열의 최소 축약)
export function johuHint(monthBranchIdx) {
  if ([11, 0, 1].includes(monthBranchIdx)) return '화';
  if ([5, 6, 7].includes(monthBranchIdx)) return '수';
  return null;
}

// 격국 간이 표기: 월지 본기 십신 → '~격' (건록·양인 특수 케이스 포함, 참고용)
export function gyeokgukOf(monthMainSipsin, dayStemYang) {
  if (monthMainSipsin === '비견') return '건록격(참고)';
  if (monthMainSipsin === '겁재') return dayStemYang ? '양인격(참고)' : '월겁격(참고)';
  return `${monthMainSipsin}격(참고)`;
}

export const YONGSIN_SOURCE_NOTE =
  '억부 점수 가중치(월지30 등)는 계산 가능성을 위한 본 모듈의 명시적 휴리스틱이며 고전 정본이 아니다. ' +
  '조후는 궁통보감 계열의 최소 축약(동생→화·하생→수)만 반영. 통관용신·전왕격 등은 미구현(차기 배선 지점).';
