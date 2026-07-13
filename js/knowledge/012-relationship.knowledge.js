// 012-relationship.knowledge.js — 관계 리듀서 (미연시 침전물 v1 · 결정론 · LLM 호출 0)
// 정본 근거 = docs/드래프트종합_마담꼬미미연시_260713.md §4-2(겹침안·운영자 버튼 확정) +
//            docs/성향총추출_포터블.md §8-1(관계의 침전물·레드라인 5)·§8-2(역행 2축).
// 원리: 009 상담의 이벤트·답변 스트림을 순수하게 접어 {LV, yBond, yHurt, 호칭, [★사건], MOOD}를
//       산출한다. 진행 판정용 LLM 호출 0 · 강제 메뉴 0 · 비가역 없음(LV은 오르내리고 회복 가능).
// 저장: 이 기기(localStorage)에만 — 서버 동기화(D1 relationship 테이블)는 후속(서버계정_설정.md 예고).
// 사과=부분 상쇄(완전 리셋 금지, r≈.42) 조항은 사과 채널(자유 발화)이 생기는 LLM 승격 때 배선 — 자리만 예약.

const KEY = 'saju:rel';

// ── 저장/복원 (기기 내 · 실패해도 앱은 동작) ──
export function loadRel() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}
export function saveRel(snap) {
  try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* 사생활 모드 등 — 조용히 통과 */ }
}

// LV 판정: 관계의 질 근사(적중·완주=결속, 어긋남=상처). 세션당 ±1 클램프(포터블 ①§5-a).
function levelOf(bond, hurt, prevLv) {
  const raw = bond - hurt * 1.5;
  const abs = raw >= 18 ? 5 : raw >= 12 ? 4 : raw >= 8 ? 3 : raw >= 4 ? 2 : raw >= 1 ? 1 : 0;
  return Math.max(prevLv - 1, Math.min(prevLv + 1, abs)); // 한 세션에 ±1까지만
}

// 호칭 라더(꼬미 카드 §말투): 손님 → 너 → (이름·별명은 계정 연동·해금 후속)
export function callOf(lv) { return lv >= 1 ? '너' : '손님'; }

// ── 리듀서 팩토리: 상담 1회분을 접는다 ──
// createRelationship(loadRel()) → { lv, visits, call, observe(ev), answered(kind, ring), finish(completed), snapshot() }
export function createRelationship(saved) {
  const base = saved || { v: 1, visits: 0, completes: 0, bond: 0, hurt: 0, lv: 0, stars: [], mood: 'base' };
  // 이번 세션 집계
  let hits = 0, denies = 0, softSeen = 0, completed = false;
  let bond = base.bond, hurt = base.hurt;

  return {
    get lv() { return base.lv; },
    get visits() { return base.visits + 1; },       // 이번 방문 포함(완주해야 침전)
    get call() { return callOf(base.lv); },

    // 009 이벤트 스트림 관찰(순수 집계 — 대사·진행엔 개입 0)
    observe(ev) {
      if (!ev) return;
      if (ev.kind === 'say' && ev.tone === 'SOFT') softSeen++;
      if (ev.kind === 'end') completed = true;
    },

    // 확인 답변 반영: hit=답변지 적중·맞아 / deny=아니야·그런 일 없었어 / 글쎄=중립
    answered(choice, ring, options) {
      const hit = (options && options.includes(choice)) || choice === '맞아';
      const deny = choice === '아니야' || choice === '그런 일 없었어';
      if (hit) {
        hits++; bond += 2;
        if (ring && ring.impact >= 3.6) { // 큰 정곡 적중 = [★] 침전(잊히지 않는 기억)
          if (!base.stars.some((s) => s.key === ring.key)) base.stars.push({ key: ring.key, label: ring.label, at: Date.now() });
        }
      } else if (deny) {
        denies++;
        hurt += bond >= 6 ? 0.5 : 1; // 완충: 관계가 쌓였으면 작은 어긋남은 얕게 벤다(§8-2)
        bond = Math.max(0, bond - 1);
      }
    },

    // 세션 마감 → 새 스냅샷(완주만 침전 — 이탈 세션은 기록하지 않는 게 사람)
    finish() {
      if (!completed) return base;                   // 미완주 = 무침전
      const visits = base.visits + 1;
      bond += 3;                                     // 완주 결속
      const lv = levelOf(bond, hurt, base.lv);
      const mood = denies >= 2 ? 'tense' : hits >= 2 ? 'warm' : softSeen >= 2 && hits === 0 ? 'blue' : 'base';
      return { v: 1, visits, completes: base.completes + 1, bond, hurt, lv, stars: base.stars, mood };
    },

    snapshot() { return this.finish(); },
  };
}
