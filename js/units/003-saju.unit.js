// 003-saju.unit.js — 어휴게소 · 꼬미의 살롱 (미연시 VN 표면)
// 계산 = manse 엔진(원 소스) · 정곡 선별 = 010-jeonggok · 상담 진행 = 009-consult-graph.
// 이 파일은 "무대 연출 + 진행 흐름 + 정확한 표시"만 맡는다(판정·풀이 문구는 knowledge 몫).
// 유닛 소유 문구(도입·접수·크롬)만 꼬미 톤 — 반말·드라이·존댓말 금지(드래프트종합 §4-1).
// 시간(時) 미상 = 시주 의존 판정 정직 보류(설계 §8). ?auto=1 = 검증용 자동 완주 모드.

import { buildSaju } from '../../manse/js/core/002-saju-engine.core.js';
import { STEMS, BRANCHES, ELEMENTS } from '../../manse/js/knowledge/001-ganji.knowledge.js';
import { JIJI_ARCHETYPE, JIJI_ROLE } from '../../manse/js/knowledge/012-jiji-archetype.knowledge.js';
import { createConsult } from '../knowledge/009-consult-graph.knowledge.js';

// 계산 옵션 — 서울·진태양시 보정(만세뷰 기본값 계승). 출생지 선택은 후속.
const OPTS = {
  trueSolar: true, eot: true, apply1954: true, lon: 126.98,
  jasiMode: '야자시', daeunRound: '반올림', sinsalBase: '년지',
  daeunCount: 8, seunCount: 12,
};

const elVar = { 목: 'var(--el-mok)', 화: 'var(--el-hwa)', 토: 'var(--el-to)', 금: 'var(--el-geum)', 수: 'var(--el-su)' };
const CHAPTER_NO = ['序', '一', '二', '三', '四', '五'];

let data;            // {y,mo,d,h,mi,timeUnknown,sex}
let timers = [];
let refs = {};       // 무대 DOM 핸들
let tapResolve = null; // 대사 진행 대기
let typing = null;     // 타자기 진행 중 핸들
let choiceKeys = null; // 숫자키 → 선택지
let errHooked = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
const delay = (ms) => new Promise((res) => after(ms, res));

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

function computeSaju() {
  return buildSaju({ y: data.y, mo: data.mo, d: data.d, h: data.h, mi: data.mi, sex: data.sex }, OPTS);
}

// ═══ 무대 골격 ═══
function render({ mount, params }) {
  clearTimers();
  tapResolve = null; typing = null; choiceKeys = null;
  data = { y: null, mo: null, d: null, h: null, mi: null, timeUnknown: false, sex: null };

  mount.innerHTML = `
    <main class="saju-app">
      <div class="kmi-bg"></div>
      <div class="kmi-grain"></div>
      <div class="kmi-vig"></div>
      <div class="kmi-mark" aria-hidden="true">契路神</div>
      <div class="kmi-scene" id="kmi-scene"></div>
      <section class="kmi-log" id="kmi-log" hidden>
        <div class="l-head"><h3>지난 대사</h3><button class="kmi-ico" id="kmi-log-x" aria-label="닫기">${xIcon()}</button></div>
        <div class="l-body" id="kmi-log-body"></div>
      </section>
      <section class="kmi-log" id="kmi-sheet" hidden>
        <div class="l-head"><h3>원국</h3><button class="kmi-ico" id="kmi-sheet-x" aria-label="닫기">${xIcon()}</button></div>
        <div class="l-body" id="kmi-sheet-body"></div>
      </section>
      <div id="saju-errlog" hidden></div>
    </main>`;

  refs = {
    scene: mount.querySelector('#kmi-scene'),
    log: mount.querySelector('#kmi-log'),
    logBody: mount.querySelector('#kmi-log-body'),
    sheet: mount.querySelector('#kmi-sheet'),
    sheetBody: mount.querySelector('#kmi-sheet-body'),
  };
  mount.querySelector('#kmi-log-x').addEventListener('click', () => { refs.log.hidden = true; });
  mount.querySelector('#kmi-sheet-x').addEventListener('click', () => { refs.sheet.hidden = true; });

  if (!errHooked) { // 헤드리스 검증용 에러 트랩(1회)
    errHooked = true;
    window.addEventListener('error', (e) => {
      const el = document.getElementById('saju-errlog');
      if (el) { el.hidden = false; el.textContent += `ERR:${e.message}`; }
    });
  }

  if (params?.get('auto') === '1') { // 검증용 자동 완주(연출 없음)
    data = { y: 1990, mo: 5, d: 15, h: 12, mi: 30, timeUnknown: params.get('tu') === '1', sex: 1 };
    autoRun();
    return;
  }
  sceneTitle();
}

function xIcon() { return `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`; }

// ═══ 백로그 ═══
function logPush(who, text, cls = '') {
  const el = document.createElement('div');
  el.className = `l-line ${cls}`;
  if (cls === 'chap') el.textContent = text;
  else { el.innerHTML = `<b>${esc(who)}</b>`; el.appendChild(document.createTextNode(text)); }
  refs.logBody.appendChild(el);
}

/* ─────────────────────────────────────────
   타이틀 씬
───────────────────────────────────────── */
function sceneTitle() {
  clearTimers(); tapResolve = null; typing = null;
  refs.scene.innerHTML = `
    <div class="kmi-title">
      <p class="t-eyebrow">Salon de Kkomi <small>自称 契路神</small></p>
      <h1 class="t-logo">어휴<em>게소</em></h1>
      <p class="t-tag"><b>운명을 점치는 곳 아니야 — 관계를 읽는 곳이지.</b><br>팔자 읽어주는 언니, 꼬미의 살롱.</p>
      <div class="t-cta"><button class="kmi-btn" id="t-start">이야기 시작</button></div>
      <p class="t-foot"><span>양력 · 서울 표준시 기준</span><span>해석은 참고용</span><span>ver 0.1</span></p>
    </div>`;
  refs.scene.querySelector('#t-start').addEventListener('click', () => scenePlay());
}

/* ─────────────────────────────────────────
   플레이 씬 — HUD + 카드 + 다이얼로그
───────────────────────────────────────── */
function buildPlayFrame() {
  refs.scene.innerHTML = `
    <div class="kmi-hud">
      <span class="h-step" id="kmi-step"><b>序</b>접수</span>
      <span class="h-sp"></span>
      <span class="kmi-bond" id="kmi-bond" title="인연">${'<i></i>'.repeat(5)}</span>
      <button class="kmi-ico" id="kmi-chart-btn" aria-label="원국 보기" hidden>
        <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg></button>
      <button class="kmi-ico" id="kmi-log-btn" aria-label="지난 대사">
        <svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg></button>
      <button class="kmi-ico" id="kmi-home" aria-label="처음으로">
        <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg></button>
    </div>
    <div class="kmi-main"><div id="kmi-cards" style="width:100%;max-width:660px;margin-top:auto"></div></div>
    <div class="kmi-dock">
      <div class="kmi-dlg" id="kmi-dlg">
        <i class="skin" aria-hidden="true"></i>
        <span class="kmi-name">꼬미 <small>自称 契路神</small></span>
        <span class="kmi-orb" aria-hidden="true"></span>
        <p class="kmi-text" id="kmi-text"></p>
        <span class="kmi-caret" id="kmi-caret" hidden>▼</span>
        <span class="kmi-hint" id="kmi-hint">탭하여 진행</span>
      </div>
    </div>`;
  refs.cards = refs.scene.querySelector('#kmi-cards');
  refs.dlg = refs.scene.querySelector('#kmi-dlg');
  refs.text = refs.scene.querySelector('#kmi-text');
  refs.caret = refs.scene.querySelector('#kmi-caret');
  refs.step = refs.scene.querySelector('#kmi-step');
  refs.bond = refs.scene.querySelector('#kmi-bond');
  refs.chartBtn = refs.scene.querySelector('#kmi-chart-btn');

  refs.dlg.addEventListener('click', onTap);
  refs.scene.querySelector('#kmi-log-btn').addEventListener('click', () => { refs.log.hidden = false; refs.logBody.scrollTop = 1e9; });
  refs.chartBtn.addEventListener('click', () => { refs.sheet.hidden = false; });
  refs.scene.querySelector('#kmi-home').addEventListener('click', () => sceneTitle());
  if (!refs.keyHooked) {
    refs.keyHooked = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { if (document.getElementById('kmi-dlg')) { e.preventDefault(); onTap(); } }
      if (choiceKeys && /^[1-4]$/.test(e.key)) choiceKeys[+e.key - 1]?.click();
    });
  }
  setBond(0);
}

function onTap() {
  if (typing) { typing.finish(); return; }
  if (tapResolve) { const r = tapResolve; tapResolve = null; r(); }
}

function setBond(trust) {
  const lit = Math.max(1, Math.min(5, 1 + Math.round(Math.max(0, trust) / 2)));
  [...refs.bond.children].forEach((dot, i) => dot.classList.toggle('on', i < lit));
}

function setStep(no, title) { refs.step.innerHTML = `<b>${esc(no)}</b>${esc(title)}`; }

// ═══ 타자기 ═══
function typeInto(el, text) {
  el.textContent = '';
  let i = 0, finished = false, resolveDone;
  const done = new Promise((res) => { resolveDone = res; });
  const finish = () => {
    if (finished) return; finished = true;
    el.textContent = text;
    refs.dlg.classList.remove('talking');
    resolveDone();
  };
  const tick = () => {
    if (finished) return;
    if (i >= text.length) { finish(); return; }
    el.textContent += text[i];
    const ch = text[i]; i++;
    after(/[—…?!.]/.test(ch) ? 150 : /[,·]/.test(ch) ? 70 : 17, tick);
  };
  refs.dlg.classList.add('talking');
  tick();
  return { done, finish };
}

// 대사 한 줄: 타자 → (waitTap이면) 탭 대기
async function say(text, { big = false, waitTap = true } = {}) {
  refs.caret.hidden = true;
  refs.text.classList.toggle('big', big);
  typing = typeInto(refs.text, text);
  await typing.done;
  typing = null;
  logPush('꼬미', text);
  if (!waitTap) return;
  refs.caret.hidden = false;
  await new Promise((res) => { tapResolve = res; });
  refs.caret.hidden = true;
}

// 선택지: main 카드존에 번호 스택 → 답 라벨 resolve
function ask(labels) {
  return new Promise((res) => {
    const wrap = document.createElement('div');
    wrap.className = 'kmi-choices';
    wrap.innerHTML = labels.map((l, i) => `<button class="kmi-choice" data-c="${esc(l)}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(l)}</button>`).join('');
    refs.cards.appendChild(wrap);
    choiceKeys = [...wrap.querySelectorAll('.kmi-choice')];
    choiceKeys.forEach((b) => b.addEventListener('click', () => {
      choiceKeys = null; wrap.remove();
      logPush('나', b.dataset.c, 'me');
      res(b.dataset.c);
    }));
  });
}

// 챕터 인터타이틀
async function chapter(no, title, auto) {
  const [main, sub] = String(title).split(' — ');
  setStep(no, main);
  logPush('', `${no}章 · ${title}`, 'chap');
  if (auto) return;
  const el = document.createElement('div');
  el.className = 'kmi-chapter';
  el.innerHTML = `<div class="c-in"><p class="c-no">第 ${esc(no)} 章</p><h2 class="c-t">${esc(main)}</h2>${sub ? `<p class="c-s">${esc(sub)}</p>` : ''}<div class="c-line"></div></div>`;
  refs.scene.appendChild(el);
  await delay(1500);
  el.classList.add('out');
  await delay(380);
  el.remove();
}

/* ═══ 시나리오 — 접수(입력) ═══ */
async function scenePlay() {
  buildPlayFrame();
  await say('…왔네. 앉아.');
  await say('여긴 어휴게소 — 팔자 읽어주는 데야. 나는 꼬미. 뭐, 신이라고 불러도 되고.');
  await say('네 판부터 세우자. 언제 태어났어? 양력으로.', { waitTap: false });
  await panelBirth();
  await say('태어난 시간은? 모르면 몰라도 돼 — 시(時)만 빼고 셋으로 정확히 봐줄게.', { waitTap: false });
  await panelTime();
  await say('마지막. 대운(10년 흐름) 방향 잡는 데 필요해.', { waitTap: false });
  await panelSex();
  await playChart();
}

function panelBirth() {
  return new Promise((res) => {
    refs.cards.innerHTML = `
      <div class="kmi-panel"><p class="p-label">접수 · 생년월일</p>
        <input type="date" id="f-birth" class="kmi-input" min="1900-01-01" max="2100-12-31">
        <div class="p-row"><button class="kmi-btn" id="f-next" disabled>이걸로</button></div>
      </div>`;
    const inp = refs.cards.querySelector('#f-birth');
    const next = refs.cards.querySelector('#f-next');
    inp.addEventListener('input', () => { next.disabled = !inp.value; });
    next.addEventListener('click', () => {
      const [y, mo, d] = inp.value.split('-').map(Number);
      if (!y || !mo || !d) return;
      data.y = y; data.mo = mo; data.d = d;
      logPush('나', `${y}년 ${mo}월 ${d}일`, 'me');
      refs.cards.innerHTML = '';
      res();
    });
  });
}

function panelTime() {
  return new Promise((res) => {
    refs.cards.innerHTML = `
      <div class="kmi-panel"><p class="p-label">접수 · 태어난 시간</p>
        <input type="time" id="f-time" class="kmi-input">
        <div class="p-row"><button class="kmi-btn" id="f-next" disabled>이 시간이야</button>
        <button class="kmi-btn ghost" id="f-unknown">시간 몰라</button></div>
      </div>`;
    const inp = refs.cards.querySelector('#f-time');
    const next = refs.cards.querySelector('#f-next');
    inp.addEventListener('input', () => { next.disabled = !inp.value; });
    next.addEventListener('click', () => {
      const [h, mi] = inp.value.split(':').map(Number);
      data.h = h; data.mi = mi; data.timeUnknown = false;
      logPush('나', `${h}시 ${String(mi).padStart(2, '0')}분`, 'me');
      refs.cards.innerHTML = '';
      res();
    });
    refs.cards.querySelector('#f-unknown').addEventListener('click', () => {
      data.h = 12; data.mi = 0; data.timeUnknown = true; // 시지 계산용 임시값 — 시주 의존 판정은 보류됨
      logPush('나', '시간 미상', 'me');
      refs.cards.innerHTML = '';
      res();
    });
  });
}

function panelSex() {
  return new Promise((res) => {
    refs.cards.innerHTML = `
      <div class="kmi-panel"><p class="p-label">접수 · 성별</p>
        <div class="p-row"><button class="kmi-btn ghost" data-sex="1">남자</button>
        <button class="kmi-btn ghost" data-sex="2">여자</button></div>
      </div>`;
    refs.cards.querySelectorAll('[data-sex]').forEach((b) => b.addEventListener('click', () => {
      data.sex = +b.dataset.sex;
      logPush('나', b.textContent, 'me');
      refs.cards.innerHTML = '';
      res();
    }));
  });
}

/* ═══ 원국 카드 ═══ */
function chartHtml(r, known) {
  const keys = ['년주', '월주', '일주', '시주'];
  const pillars = keys.map((k) => {
    if (k === '시주' && !known)
      return `<div class="kmi-pil unknown"><div class="pl">시주</div><div class="q">?</div><div class="pn">시간 미상</div></div>`;
    const p = r.pillars[k];
    const s = STEMS[p.stem], b = BRANCHES[p.branch];
    const me = k === '일주';
    return `<div class="kmi-pil${me ? ' me' : ''}">
      <div class="pl">${k}</div>
      <div class="gz">
        <span class="gch" style="color:${elVar[s.el]}">${s.han}</span>
        <span class="gch" style="color:${elVar[b.el]}">${b.han}</span>
      </div>
      <div class="pn">${s.kor}${b.kor} · ${s.el}${b.el}</div>
      <div class="prole">${jijiRole(p.branch)}</div>
    </div>`;
  }).join('');

  const counts = ohaengCounts(r, known);
  const bars = ELEMENTS.map((e) => `
    <div class="kmi-bar"><span class="bl" style="color:${elVar[e]}">${e}</span>
      <div class="segs">${Array.from({ length: 8 }, (_, i) => `<span class="seg${i < counts[e] ? ' on' : ''}" style="--c:${elVar[e]}"></span>`).join('')}</div>
      <b class="bn">${counts[e]}</b></div>`).join('');

  return `<div class="kmi-chart">
    <div class="kmi-sec"><h2><b>八字</b>내 팔자 — 네 기둥 여덟 글자</h2><div class="kmi-pillars">${pillars}</div></div>
    <div class="kmi-sec"><h2><b>五行</b>오행 균형 — ${known ? '네 기둥' : '세 기둥'} 기준</h2><div class="kmi-bars">${bars}</div></div>
  </div>`;
}

async function playChart() {
  let r;
  try { r = computeSaju(); } catch (e) {
    await say(`…판이 안 세워지네. ${e.message || e}`, { waitTap: false });
    refs.cards.innerHTML = `<div class="kmi-panel"><p class="p-label">접수 오류</p><div class="p-row"><button class="kmi-btn" id="f-restart">처음부터</button></div></div>`;
    refs.cards.querySelector('#f-restart').addEventListener('click', () => scenePlay());
    return;
  }
  const known = !data.timeUnknown;

  // 판 세우기 연출 — 계산은 이미 끝(정직한 지연 세탁, §VN 페이싱)
  refs.cards.innerHTML = `<div class="kmi-cast"><div class="ring"></div></div>`;
  await say('좋아. 판 세운다 — 잠깐 숨 참아.', { waitTap: false });
  await delay(1400);

  refs.cards.innerHTML = chartHtml(r, known);
  refs.sheetBody.innerHTML = chartHtml(r, known); // HUD 원국 시트에도 상주
  refs.chartBtn.hidden = false;

  const day = STEMS[r.pillars.일주.stem];
  const meta = `${data.y}.${String(data.mo).padStart(2, '0')}.${String(data.d).padStart(2, '0')} · ${data.sex === 1 ? '남' : '여'}${known ? '' : ' · 시간 미상'}`;
  logPush('', `원국 — ${meta}`, 'chap');
  await say(`나왔다. 네 판 — ${meta}.`);
  await say(`한가운데 금박 두른 게 너야. ${day.han}(${day.kor}) 일간 — 이 여덟 글자가 무슨 얘길 하는지, 지금부터 하나씩 짚어줄게.`, { waitTap: false });

  refs.cards.insertAdjacentHTML('beforeend', `
    <div class="kmi-panel"><p class="p-label">준비됐어?</p>
      <div class="p-row"><button class="kmi-btn" id="f-consult">이야기로 풀어줘</button></div>
      <button class="kmi-link" id="f-restart">아니, 처음부터 다시 쓸래</button>
    </div>`);
  refs.cards.querySelector('#f-restart').addEventListener('click', () => scenePlay());
  refs.cards.querySelector('#f-consult').addEventListener('click', () => {
    refs.cards.innerHTML = '';
    playConsult(r, known);
  });
}

/* ═══ 상담 — 고리 이벤트를 VN으로 상연 ═══ */
async function playConsult(r, known) {
  const consult = createConsult(r, { timeKnown: known, nowYear: new Date().getFullYear() });
  for (;;) {
    const ev = consult.next();
    if (ev === null || !ev) break; // null = 확인 대기(아래 confirm에서 즉시 처리) · undefined = 소진
    if (ev.kind === 'sep') continue;
    if (ev.kind === 'step') { await chapter(CHAPTER_NO[ev.step] || ev.step, ev.title, false); continue; }
    if (ev.kind === 'say') { await say(ev.text, { big: !!ev.big }); continue; }
    if (ev.kind === 'confirm') {
      await say(ev.prompt, { waitTap: false });
      const labels = ev.options ? [...ev.options, '그런 일 없었어'] : ['맞아', '글쎄', '아니야'];
      const pick = await ask(labels);
      consult.answer(pick);
      setBond(consult.trust);
      continue;
    }
    if (ev.kind === 'end') { await playEnding(consult, ev.ending); return; }
  }
}

function endingHtml(ending, edgeColor) {
  return `
    <div class="kmi-end" style="--edge:${edgeColor}">
      <p class="e-tag">오늘의 풀이</p>
      <h3 class="e-h">판은 지도, 길은 네 것</h3>
      <div class="e-row"><span class="k">처방</span><p>${esc(ending.prescription)}</p></div>
      <div class="e-row"><span class="k">시기</span><p>${esc(ending.timing)}</p></div>
      ${ending.held ? `<div class="e-row"><span class="k">보류</span><p>${esc(ending.held)}</p></div>` : ''}
      <p class="e-cheer">${esc(ending.cheer)}</p>
      <p class="e-foot">양력 · 서울 표준시 · 절기 근사 ±수 분 · 신강약·용신·해석은 참고용</p>
    </div>`;
}

function edgeOf(consult) {
  const y = consult.context?.yongsin || {};
  const hit = ['목', '화', '토', '금', '수'].find((el) => String(y.eokbu || y.johu || '').includes(el));
  return hit ? elVar[hit] : 'var(--gold)';
}

async function playEnding(consult, ending) {
  setStep('終', '오늘의 풀이');
  refs.cards.innerHTML = endingHtml(ending, edgeOf(consult));
  logPush('', '終章 · 오늘의 풀이', 'chap');
  logPush('꼬미', `${ending.prescription} / ${ending.timing}${ending.held ? ` / ${ending.held}` : ''} / ${ending.cheer}`);
  await say('…오늘 장사는 여기까지. 판은 안 변하니까, 궁금해지면 또 와.', { waitTap: false });
  refs.cards.insertAdjacentHTML('beforeend', `
    <div class="kmi-panel"><p class="p-label">살롱 문 앞</p>
      <div class="p-row"><button class="kmi-btn" id="c-again">다른 판 세우기</button>
      <button class="kmi-btn ghost" id="c-title">타이틀로</button></div>
    </div>`);
  refs.cards.querySelector('#c-again').addEventListener('click', () => scenePlay());
  refs.cards.querySelector('#c-title').addEventListener('click', () => sceneTitle());
}

/* ═══ ?auto=1 — 검증용 자동 완주(연출·대기 0) ═══ */
function autoRun() {
  buildPlayFrame();
  refs.log.hidden = false; // 백로그를 무대로 사용 — DOM 검증 표적
  let r;
  try { r = computeSaju(); } catch (e) {
    const el = document.getElementById('saju-errlog');
    el.hidden = false; el.textContent += `ERR:${e.message || e}`;
    return;
  }
  const known = !data.timeUnknown;
  refs.cards.innerHTML = chartHtml(r, known);
  refs.sheetBody.innerHTML = chartHtml(r, known);
  refs.chartBtn.hidden = false;

  const consult = createConsult(r, { timeKnown: known, nowYear: new Date().getFullYear() });
  let guard = 400;
  while (guard-- > 0) {
    const ev = consult.next();
    if (ev === undefined) break;
    if (ev === null) continue;
    if (ev.kind === 'step') { logPush('', `${CHAPTER_NO[ev.step] || ev.step}章 · ${ev.title}`, 'chap'); continue; }
    if (ev.kind === 'say') { logPush('꼬미', ev.text); continue; }
    if (ev.kind === 'confirm') {
      logPush('꼬미', ev.prompt);
      const pick = ev.options?.[0] ?? '맞아';
      logPush('나', pick, 'me');
      consult.answer(pick);
      setBond(consult.trust);
      continue;
    }
    if (ev.kind === 'end') {
      refs.cards.insertAdjacentHTML('beforeend', endingHtml(ev.ending, edgeOf(consult)));
      logPush('꼬미', ev.ending.cheer);
      break;
    }
  }
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
