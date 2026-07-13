// 003-saju.unit.js — 사주 원국 뷰 (입력 흐름 → 만세력 엔진 → 원국 카드 → 상담 고리)
// 계산 = manse 엔진(원 소스) · 정곡 선별 = 010-jeonggok · 상담 진행 = 009-consult-graph.
// 이 파일은 "진행 흐름 + 정확한 표시 + 상담 렌더"만 맡는다(문구·판정은 knowledge 몫).
// 시간(時) 미상 = 시주 의존 판정 정직 보류(설계 §8). ?auto=1 = 검증용 자동 완주 모드.

import { buildSaju } from '../../manse/js/core/002-saju-engine.core.js';
import { STEMS, BRANCHES, ELEMENTS } from '../../manse/js/knowledge/001-ganji.knowledge.js';
import { JIJI_ARCHETYPE, JIJI_ROLE } from '../../manse/js/knowledge/012-jiji-archetype.knowledge.js';
import { createConsult } from '../knowledge/009-consult-graph.knowledge.js';
import { kkomiPack } from '../knowledge/011-kkomi-persona.knowledge.js';

// 계산 옵션 — 서울·진태양시 보정(만세뷰 기본값 계승). 출생지 선택은 후속.
const OPTS = {
  trueSolar: true, eot: true, apply1954: true, lon: 126.98,
  jasiMode: '야자시', daeunRound: '반올림', sinsalBase: '년지',
  daeunCount: 8, seunCount: 12,
};

const elVar = { 목: 'var(--el-mok)', 화: 'var(--el-hwa)', 토: 'var(--el-to)', 금: 'var(--el-geum)', 수: 'var(--el-su)' };

let data;        // {y,mo,d,h,mi,timeUnknown,sex}
let timers = [];
let box;         // 흐름 컨테이너
let errHooked = false; // 에러 트랩 1회 배선 가드

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

// 지지 → 생왕고 라벨 (JIJI_ARCHETYPE.자리 직접 조회 · 신살법 아님 — 감사 확정)
function jijiRole(branchIdx) {
  const arch = JIJI_ARCHETYPE[BRANCHES[branchIdx].han];
  return JIJI_ROLE[arch.자리].sinsal;
}

// 오행 분포 — 시간 미상이면 시주 제외 3기둥 재집계(엔진 counts는 시주 포함)
function ohaengCounts(r, includeHour) {
  const c = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const keys = includeHour ? ['년주', '월주', '일주', '시주'] : ['년주', '월주', '일주'];
  for (const k of keys) {
    const p = r.pillars[k];
    c[STEMS[p.stem].el]++;
    c[BRANCHES[p.branch].el]++;
  }
  return c;
}

// ── 흐름 진입 ──
function render({ mount, params }) {
  clearTimers();
  data = { y: null, mo: null, d: null, h: null, mi: null, timeUnknown: false, sex: null };
  mount.innerHTML = `
    <main class="saju-app" data-theme="light">
      <div class="saju-wrap" id="saju-flow"></div>
      <p class="saju-foot">양력 기준 · 서울 표준시 · 절기 근사 ±수 분 · 신강약·용신·해석은 참고용</p>
      <div id="saju-errlog" hidden></div>
    </main>`;
  box = mount.querySelector('#saju-flow');
  if (!errHooked) { // 헤드리스 검증용 에러 트랩(1회)
    errHooked = true;
    window.addEventListener('error', (e) => {
      const el = document.getElementById('saju-errlog');
      if (el) { el.hidden = false; el.textContent += `ERR:${e.message}`; }
    });
  }

  if (params?.get('auto') === '1') { // 검증용 자동 완주(연출 없음)
    data = { y: 1990, mo: 5, d: 15, h: 12, mi: 30, timeUnknown: params.get('tu') === '1', sex: 1 };
    stepChart(true);
    return;
  }
  stepBirth();
}

function swap(html) {
  box.innerHTML = `<section class="saju-step">${html}</section>`;
  const sec = box.querySelector('.saju-step');
  after(20, () => sec.classList.add('in'));
  return sec;
}

function restart() { stepBirth(); }

// ── 1) 생년월일 ──
function stepBirth() {
  const sec = swap(`
    <p class="saju-eyebrow">사주 원국</p>
    <h1 class="saju-h">생년월일을 알려줘</h1>
    <p class="saju-sub">양력 기준이야.</p>
    <input type="date" id="f-birth" class="saju-input" min="1900-01-01" max="2100-12-31">
    <button class="saju-btn" id="f-next" disabled>다음</button>
  `);
  const inp = sec.querySelector('#f-birth');
  const next = sec.querySelector('#f-next');
  inp.addEventListener('input', () => { next.disabled = !inp.value; });
  next.addEventListener('click', () => {
    if (!inp.value) return;
    const [y, mo, d] = inp.value.split('-').map(Number);
    if (!y || !mo || !d) return;
    data.y = y; data.mo = mo; data.d = d;
    stepTime();
  });
}

// ── 2) 태어난 시간 (모르면 3기둥) ──
function stepTime() {
  const sec = swap(`
    <p class="saju-eyebrow">${data.y}년 ${data.mo}월 ${data.d}일</p>
    <h1 class="saju-h">태어난 시간은?</h1>
    <p class="saju-sub">모르면 <b>시간 몰라</b>를 눌러 — 시(時)를 빼고 세 기둥으로만 정확히 봐줄게.</p>
    <input type="time" id="f-time" class="saju-input">
    <button class="saju-btn" id="f-next" disabled>다음</button>
    <button class="saju-link" id="f-unknown">시간 몰라</button>
  `);
  const inp = sec.querySelector('#f-time');
  const next = sec.querySelector('#f-next');
  inp.addEventListener('input', () => { next.disabled = !inp.value; });
  next.addEventListener('click', () => {
    if (!inp.value) return;
    const [h, mi] = inp.value.split(':').map(Number);
    data.h = h; data.mi = mi; data.timeUnknown = false;
    stepSex();
  });
  sec.querySelector('#f-unknown').addEventListener('click', () => {
    data.h = 12; data.mi = 0; data.timeUnknown = true; // 시지 계산용 임시값 — 시주 의존 판정은 보류됨
    stepSex();
  });
}

// ── 3) 성별 (대운 방향 필수 — 없으면 대운이 통째로 반대) ──
function stepSex() {
  const sec = swap(`
    <p class="saju-eyebrow">${data.timeUnknown ? '시간 미상' : `${data.h}시 ${String(data.mi).padStart(2, '0')}분`}</p>
    <h1 class="saju-h">성별을 골라줘</h1>
    <p class="saju-sub">대운(10년 단위 큰 흐름)의 방향을 정하는 데 꼭 필요해.</p>
    <div class="saju-pick">
      <button class="saju-btn ghost" data-sex="1">남자</button>
      <button class="saju-btn ghost" data-sex="2">여자</button>
    </div>
  `);
  sec.querySelectorAll('[data-sex]').forEach((b) => b.addEventListener('click', () => {
    data.sex = +b.dataset.sex;
    stepChart(false);
  }));
}

// ── 4) 원국 카드 (계산 완료 화면) ──
function computeSaju() {
  return buildSaju({ y: data.y, mo: data.mo, d: data.d, h: data.h, mi: data.mi, sex: data.sex }, OPTS);
}

function chartHtml(r, known) {
  const keys = ['년주', '월주', '일주', '시주'];
  const pillars = keys.map((k) => {
    if (k === '시주' && !known)
      return `<div class="saju-pil unknown"><div class="pl">시주</div><div class="q">?</div><div class="pn">시간 미상</div></div>`;
    const p = r.pillars[k];
    const s = STEMS[p.stem], b = BRANCHES[p.branch];
    const me = k === '일주';
    return `<div class="saju-pil${me ? ' me' : ''}">
      <div class="pl">${k}${me ? ' · 나' : ''}</div>
      <div class="gz">
        <span class="gch" style="color:${elVar[s.el]}">${s.han}</span>
        <span class="gch" style="color:${elVar[b.el]}">${b.han}</span>
      </div>
      <div class="pn">${s.kor}${b.kor} · ${s.el}${b.el}</div>
      <div class="prole">${jijiRole(p.branch)}</div>
    </div>`;
  }).join('');

  const counts = ohaengCounts(r, known);
  const maxN = Math.max(...ELEMENTS.map((e) => counts[e]), 1);
  const bars = ELEMENTS.map((e) => `
    <div class="saju-bar"><span class="bl">${e}</span>
      <div class="btrack"><div class="bfill" style="width:${(counts[e] / maxN) * 100}%;background:${elVar[e]}"></div></div>
      <b class="bn">${counts[e]}</b></div>`).join('');

  return `<div class="saju-sec"><h2>내 팔자 <small>네 기둥 · 여덟 글자</small></h2><div class="saju-pillars">${pillars}</div></div>
          <div class="saju-sec"><h2>오행 균형 <small>${known ? '네 기둥' : '세 기둥'} 기준</small></h2><div class="saju-bars">${bars}</div></div>`;
}

function stepChart(auto) {
  let r;
  try { r = computeSaju(); } catch (e) {
    swap(`<h1 class="saju-h">계산 중 문제가 생겼어</h1><p class="saju-sub">${esc(e.message || e)}</p><button class="saju-btn" id="f-restart">처음부터</button>`)
      .querySelector('#f-restart').addEventListener('click', restart);
    return;
  }
  const known = !data.timeUnknown;
  const day = STEMS[r.pillars.일주.stem];
  const sec = swap(`
    <p class="saju-eyebrow">${data.y}.${String(data.mo).padStart(2, '0')}.${String(data.d).padStart(2, '0')} · ${data.sex === 1 ? '남' : '여'}${known ? '' : ' · 시간 미상'}</p>
    <h1 class="saju-h">나는 <span style="color:${elVar[day.el]}">${day.han}${day.kor}</span> <span class="saju-day">일간</span></h1>
    <p class="saju-sub">판이 세워졌어. 이제 이 판이 무슨 얘길 하는지 하나씩 짚어줄게.</p>
    ${chartHtml(r, known)}
    <button class="saju-btn" id="f-consult">이야기로 풀어줄게</button>
    <button class="saju-link" id="f-restart">처음부터</button>
  `);
  sec.querySelector('#f-restart').addEventListener('click', restart);
  const go = () => stepConsult(r, known, auto);
  if (auto) { go(); return; }
  sec.querySelector('#f-consult').addEventListener('click', go);
}

// ── 5) 상담 고리 (append 로그 · 탭 진행 · 확인 분기) ──
function stepConsult(r, known, auto) {
  // 화자 = 꼬미(011 페르소나 팩·D5 도킹). ?plain=1 = 중립 문구 비교 모드(검증용).
  const plain = new URLSearchParams(location.search).get('plain') === '1';
  const consult = createConsult(r, { timeKnown: known, nowYear: new Date().getFullYear(), persona: plain ? null : kkomiPack() });
  box.innerHTML = `<section class="saju-step in">
    <div class="saju-log" id="c-log"></div>
    <button class="saju-btn ghost" id="c-adv">계속 ›</button>
  </section>`;
  const log = box.querySelector('#c-log');
  const adv = box.querySelector('#c-adv');

  const push = (html, cls = '') => {
    const el = document.createElement('div');
    el.className = `saju-line ${cls}`;
    el.innerHTML = html;
    log.appendChild(el);
    if (!auto) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el;
  };

  const renderEnd = (ending) => {
    adv.remove();
    const parts = [
      `<div class="saju-sec note"><h2>마무리</h2>
        <p class="saju-sub">${esc(ending.prescription)}</p>
        <p class="saju-sub">${esc(ending.timing)}</p>
        ${ending.held ? `<p class="saju-sub">${esc(ending.held)}</p>` : ''}
        <p class="saju-sub"><b>${esc(ending.cheer)}</b></p></div>`,
      `<button class="saju-btn" id="c-restart">처음부터 다시</button>`,
    ].join('');
    const wrap = document.createElement('div');
    wrap.innerHTML = parts;
    log.appendChild(wrap);
    wrap.querySelector('#c-restart').addEventListener('click', restart);
  };

  const renderConfirm = (ev) => {
    adv.hidden = true;
    // 답변지(계산된 보기)면 보기+[그런 일 없었어], 아니면 기본 3버튼
    const labels = ev.options ? [...ev.options, '그런 일 없었어'] : ['맞아', '글쎄', '아니야'];
    const cols = ev.options ? '' : ' three';
    const row = push(`<p class="cq">${esc(ev.prompt)}</p><div class="saju-pick${cols}" id="c-choices" style="${ev.options ? 'grid-template-columns:1fr' : ''}">
      ${labels.map((l) => `<button class="saju-btn ghost" data-c="${esc(l)}">${esc(l)}</button>`).join('')}
    </div>`, 'ask');
    row.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
      row.querySelector('#c-choices').remove();
      row.insertAdjacentHTML('beforeend', `<p class="ca">→ ${esc(b.dataset.c)}</p>`);
      consult.answer(b.dataset.c);
      adv.hidden = false;
      advance();
    }));
  };

  const advance = () => {
    const ev = consult.next();
    if (ev === null) return;               // 확인 대기
    if (!ev) return;                        // 소진(end에서 이미 마감)
    if (ev.kind === 'step') { push(`<span class="cstep">${esc(ev.title)}</span>`, 'step'); advance(); return; }
    if (ev.kind === 'sep') { advance(); return; }
    if (ev.kind === 'say') { push(`<p>${esc(ev.text)}</p>`, ev.big ? 'big' : ''); if (auto) advance(); return; }
    if (ev.kind === 'confirm') { if (auto) { consult.answer(ev.options?.[0] ?? '맞아'); advance(); } else renderConfirm(ev); return; }
    if (ev.kind === 'end') { renderEnd(ev.ending); return; }
  };

  adv.addEventListener('click', advance);
  advance(); // 첫 줄
  if (auto) { let guard = 200; while (guard-- > 0) { const before = log.childElementCount; advance(); if (log.childElementCount === before) break; } }
}

// 라우터 계약: '/' view 유닛. 상수 key로 재렌더 억제(내부 상태 자체 관리).
export default {
  seq: 3,
  id: 'saju',
  layer: 'view',
  match: (path) => path === '',
  key: () => 'saju',
  render,
};
