// 001-manse-view.unit.js — 새 만세력 UI 유닛 (렌더 + 프리셋 + 튜닝 서랍 + 복사)
// 지식·계산은 전부 knowledge/core에서 가져온다. 이 파일은 "보여주기"만 담당.

import { STEMS, BRANCHES, ELEMENTS } from '../knowledge/001-ganji.knowledge.js';
import { buildSaju, runSelfTest } from '../core/002-saju-engine.core.js';

const $ = (s, el = document) => el.querySelector(s);
const elClass = { 목: 'el-목', 화: 'el-화', 토: 'el-토', 금: 'el-금', 수: 'el-수' };
const elVar = { 목: 'var(--el-mok)', 화: 'var(--el-hwa)', 토: 'var(--el-to)', 금: 'var(--el-geum)', 수: 'var(--el-su)' };

// ── 조절 축 레지스트리(그룹·범위·기본값) — 복사 출력·결정표의 단일 출처 ──
export const CONTROLS = [
  { g: '레이아웃', k: 'maxw', label: '본문 최대폭', type: 'range', min: 360, max: 1280, step: 20, def: 920, unit: 'px', css: '--maxw' },
  { g: '레이아웃', k: 'radius', label: '카드 라운드', type: 'range', min: 0, max: 28, step: 1, def: 16, unit: 'px', css: '--radius' },
  { g: '레이아웃', k: 'gap', label: '카드 간격', type: 'range', min: 8, max: 32, step: 1, def: 16, unit: 'px', css: '--gap' },
  { g: '레이아웃', k: 'cellpad', label: '기둥 내부여백', type: 'range', min: 4, max: 20, step: 1, def: 10, unit: 'px', css: '--cellpad' },
  { g: '레이아웃', k: 'order', label: '기둥 순서', type: 'select', opts: ['전통(시일월년)', '시간순(년월일시)'], def: '전통(시일월년)' },
  { g: '타이포', k: 'hanja', label: '간지 글자 크기', type: 'range', min: 24, max: 64, step: 1, def: 40, unit: 'px', css: '--hanja-size' },
  { g: '타이포', k: 'hanjaW', label: '간지 굵기', type: 'range', min: 400, max: 900, step: 100, def: 700, unit: '', css: '--hanja-weight' },
  { g: '타이포', k: 'label', label: '라벨 크기', type: 'range', min: 9, max: 14, step: 1, def: 11, unit: 'px', css: '--label-size' },
  { g: '타이포', k: 'badge', label: '배지 크기', type: 'range', min: 9, max: 14, step: 1, def: 11, unit: 'px', css: '--badge-size' },
  { g: '타이포', k: 'hanjaFont', label: '간지 서체', type: 'select', opts: ['세리프', '산스'], def: '세리프' },
  { g: '컬러', k: 'theme', label: '테마', type: 'select', opts: ['라이트', '다크'], def: '라이트' },
  { g: '컬러', k: 'palette', label: '오행 팔레트', type: 'select', opts: ['전통', '파스텔', '고대비'], def: '전통' },
  { g: '모션', k: 'reveal', label: '리빌 모션', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '모션', k: 'stagger', label: '스태거', type: 'range', min: 0, max: 200, step: 10, def: 90, unit: 'ms', css: '--stagger' },
  { g: '모션', k: 'dur', label: '지속시간', type: 'range', min: 200, max: 900, step: 50, def: 500, unit: 'ms', css: '--t' },
  { g: '분석 표시', k: 'showJjg', label: '지장간 표시', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '분석 표시', k: 'showUnseong', label: '십이운성', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '분석 표시', k: 'sinsalBase', label: '신살 기준', type: 'select', opts: ['년지', '일지', '끄기'], def: '년지' },
  { g: '분석 표시', k: 'showGongmang', label: '공망 표시', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '분석 표시', k: 'showStrength', label: '신강약 게이지', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '분석 표시', k: 'showYongsin', label: '용신 힌트', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '분석 표시', k: 'daeunCount', label: '대운 개수', type: 'range', min: 6, max: 10, step: 1, def: 8, unit: '개' },
  { g: '분석 표시', k: 'seunCount', label: '세운 개수', type: 'range', min: 8, max: 16, step: 1, def: 12, unit: '개' },
  { g: '분석 표시', k: 'showToday', label: '오늘의 간지', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '계산 옵션', k: 'trueSolar', label: '진태양시 보정', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '계산 옵션', k: 'eot', label: '균시차(EoT)', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '계산 옵션', k: 'apply1954', label: '54~61년 표준시', type: 'select', opts: ['켬', '끔'], def: '켬' },
  { g: '계산 옵션', k: 'city', label: '출생지', type: 'select', opts: ['서울', '부산', '대구', '인천', '광주', '대전', '강릉', '제주'], def: '서울' },
  { g: '계산 옵션', k: 'jasiMode', label: '자시 처리', type: 'select', opts: ['야자시', '정자시'], def: '야자시' },
  { g: '계산 옵션', k: 'daeunRound', label: '대운수 계산', type: 'select', opts: ['반올림', '올림', '버림'], def: '반올림' },
];
const CITY_LON = { 서울: 126.98, 부산: 129.08, 대구: 128.60, 인천: 126.71, 광주: 126.85, 대전: 127.38, 강릉: 128.90, 제주: 126.53 };

export const PRESETS = {
  '모던 라이트 ★': { theme: '라이트', palette: '전통', hanja: 40, radius: 16, maxw: 920, reveal: '켬' },
  '딥 다크': { theme: '다크', palette: '전통', hanja: 40, radius: 16, maxw: 920, reveal: '켬' },
  '클래식 종이': { theme: '라이트', palette: '고대비', hanja: 46, radius: 6, maxw: 820, hanjaFont: '세리프', reveal: '끔' },
  '고밀도 프로': { theme: '라이트', palette: '고대비', hanja: 30, radius: 10, maxw: 1080, cellpad: 6, gap: 10, label: 10, badge: 10, reveal: '끔' },
};

const state = Object.fromEntries(CONTROLS.map((c) => [c.k, c.def]));
const birth = { y: 1990, mo: 5, d: 15, h: 12, mi: 30, sex: 1 };

function applyState() {
  const root = document.documentElement;
  for (const c of CONTROLS) {
    if (c.css) root.style.setProperty(c.css, state[c.k] + (c.unit === 'px' ? 'px' : c.unit === 'ms' ? 'ms' : ''));
  }
  root.dataset.theme = state.theme === '다크' ? 'dark' : 'light';
  root.dataset.palette = state.palette === '전통' ? '' : state.palette;
  root.style.setProperty('--font-hanja', state.hanjaFont === '산스' ? 'var(--font-sans)' : "'Noto Serif KR','Noto Serif TC',serif");
  document.body.dataset.motion = state.reveal === '켬' ? 'on' : 'off';
}

function computed() {
  return buildSaju(birth, {
    trueSolar: state.trueSolar === '켬', eot: state.eot === '켬', apply1954: state.apply1954 === '켬',
    lon: CITY_LON[state.city], jasiMode: state.jasiMode, daeunRound: state.daeunRound,
    sinsalBase: state.sinsalBase === '일지' ? '일지' : '년지',
    daeunCount: +state.daeunCount, seunCount: +state.seunCount,
  });
}

const gj = (p) => {
  const s = STEMS[p.stem], b = BRANCHES[p.branch];
  return `<span class="glyph ${elClass[s.el]}">${s.han}<small>${s.kor} · ${s.el}</small></span>
          <span class="glyph ${elClass[b.el]}">${b.han}<small>${b.kor} · ${b.el}</small></span>`;
};

function render() {
  applyState();
  const r = computed();
  const keys = state.order.startsWith('전통') ? ['시주', '일주', '월주', '년주'] : ['년주', '월주', '일주', '시주'];
  $('#pillars').innerHTML = keys.map((k) => {
    const p = r.pillars[k];
    return `<div class="pillar">
      <div class="plabel">${k}</div>
      <div class="sipsin">${p.stemSipsin}</div>
      ${gj(p)}
      <div class="sipsin">${p.branchSipsin}</div>
      ${state.showJjg === '켬' ? `<div class="jjg">지장간 ${p.jijanggan.map((j) => j.stem).join('·')}</div>` : ''}
      <div>${state.showUnseong === '켬' ? `<span class="badge">${p.unseong}</span>` : ''}${state.sinsalBase !== '끄기' ? `<span class="badge">${p.sinsal}</span>` : ''}</div>
    </div>`;
  }).join('');

  const corr = Math.round(r.ts.corrMin);
  $('#meta').innerHTML = [
    `<span class="chip">보정 <b class="tnum">${corr >= 0 ? '+' : ''}${corr}분</b></span>`,
    state.showGongmang === '켬' ? `<span class="chip">공망 <b>${r.gongmang.map((i) => BRANCHES[i].han + BRANCHES[i].kor).join(' · ')}</b></span>` : '',
    `<span class="chip">대운수 <b class="tnum">${r.daeunSu}</b> · ${r.forward ? '순행' : '역행'}</span>`,
    state.showYongsin === '켬' ? `<span class="chip accent">격국 ${r.yongsin.gyeokguk}</span>` : '',
  ].join('');

  const maxN = Math.max(...ELEMENTS.map((e) => r.counts[e]), 1);
  $('#bars').innerHTML = ELEMENTS.map((e) => `
    <div class="bar"><span>${e}</span>
      <div class="track"><div class="fill" style="width:${(r.counts[e] / maxN) * 100}%;background:${elVar[e]}"></div></div>
      <b class="tnum">${r.counts[e]}</b></div>`).join('');

  $('#strength').style.display = state.showStrength === '켬' ? '' : 'none';
  $('#strengthGauge').innerHTML = `
    <b>${r.strength}</b>
    <div class="track"><div class="fill" style="width:${Math.min(100, (r.score / 90) * 100)}%"></div></div>
    <span class="tnum">${r.score}/90</span>`;
  $('#yongsinChips').innerHTML = state.showYongsin === '켬' ? [
    r.yongsin.eokbu ? `<span class="chip accent">억부 후보 <b>${r.yongsin.eokbu}</b></span>` : '<span class="chip">억부: 중화(보류)</span>',
    r.yongsin.johu ? `<span class="chip accent">조후 후보 <b>${r.yongsin.johu}</b></span>` : '<span class="chip">조후: 해당 없음</span>',
    '<span class="chip">통관: 차기 배선</span>',
  ].join('') : '';

  $('#daeun').innerHTML = r.daeun.map((d) => `
    <div class="tl-item"><div class="age tnum">${d.age}세</div>
      <div class="gj"><span style="color:${elVar[STEMS[d.stem].el]}">${STEMS[d.stem].han}</span><span style="color:${elVar[BRANCHES[d.branch].el]}">${BRANCHES[d.branch].han}</span></div>
      <div class="ss">${d.stemSipsin}·${d.branchSipsin}</div></div>`).join('');
  const nowY = new Date().getFullYear();
  $('#seun').innerHTML = r.seun.map((s) => `
    <div class="tl-item${s.year === nowY ? ' now' : ''}"><div class="age tnum">${s.year}</div>
      <div class="gj"><span style="color:${elVar[STEMS[s.stem].el]}">${STEMS[s.stem].han}</span><span style="color:${elVar[BRANCHES[s.branch].el]}">${BRANCHES[s.branch].han}</span></div>
      <div class="ss">${s.stemSipsin}</div></div>`).join('');

  $('#todayCard').style.display = state.showToday === '켬' ? '' : 'none';
  const t = r.today;
  $('#todayChips').innerHTML = [
    `<span class="chip">년운 <b>${STEMS[t.year.stem].han}${BRANCHES[t.year.branch].han}</b></span>`,
    `<span class="chip">월운 <b>${STEMS[t.month.stem].han}${BRANCHES[t.month.branch].han}</b></span>`,
    `<span class="chip">일운 <b>${STEMS[t.day.stem].han}${BRANCHES[t.day.branch].han}</b></span>`,
  ].join('');

  reveal();
}

function reveal() {
  if (state.reveal !== '켬') return;
  document.querySelectorAll('.rv').forEach((el, i) => {
    el.classList.remove('in');
    setTimeout(() => el.classList.add('in'), 40 + i * +state.stagger);
  });
}

function buildDrawer() {
  const box = $('#ctls');
  const groups = [...new Set(CONTROLS.map((c) => c.g))];
  box.innerHTML = groups.map((g) => `<h3>${g}</h3>` + CONTROLS.filter((c) => c.g === g).map((c) => {
    if (c.type === 'range') return `<div class="ctl"><span>${c.label}</span><span><input type="range" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${state[c.k]}"><span class="val tnum" id="v-${c.k}">${state[c.k]}${c.unit}</span></span></div>`;
    return `<div class="ctl"><span>${c.label}</span><select data-k="${c.k}">${c.opts.map((o) => `<option${o === state[c.k] ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
  }).join('')).join('');
  box.addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    state[k] = e.target.type === 'range' ? +e.target.value : e.target.value;
    const v = $(`#v-${k}`); if (v) v.textContent = e.target.value + (CONTROLS.find((c) => c.k === k).unit || '');
    render();
  });
}

function copyValues() {
  const star = PRESETS['모던 라이트 ★'];
  const out = CONTROLS.map((c) => {
    const cur = state[c.k], base = c.k in star ? star[c.k] : c.def;
    return `${c.g} · ${c.label}(${c.k}) = ${cur}${c.unit || ''} ${String(cur) === String(base) ? '[계승]' : '[갱신 후보]'}`;
  }).join('\n');
  const text = `[플러스만세력→새UI 선택값]\n출생 ${birth.y}-${birth.mo}-${birth.d} ${birth.h}:${String(birth.mi).padStart(2, '0')} ${birth.sex === 1 ? '남' : '여'}\n${out}`;
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(
    () => toast('선택값을 복사했어요'),
    () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('선택값을 복사했어요'); },
  );
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1600); }

export function mount() {
  // 입력 바인딩
  const map = { y: '#in-y', mo: '#in-mo', d: '#in-d', h: '#in-h', mi: '#in-mi', sex: '#in-sex' };
  for (const [k, sel] of Object.entries(map)) {
    const el = $(sel); el.value = birth[k];
    el.addEventListener('change', () => { birth[k] = +el.value; render(); });
  }
  $('#btnCalc').addEventListener('click', render);
  $('#btnDrawer').addEventListener('click', () => { $('#drawer').classList.add('open'); $('#scrim').classList.add('on'); });
  $('#scrim').addEventListener('click', () => { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('on'); });
  $('#btnCopy').addEventListener('click', copyValues);
  $('#btnTheme').addEventListener('click', () => { state.theme = state.theme === '라이트' ? '다크' : '라이트'; buildDrawer(); render(); });
  $('#presets').innerHTML = Object.keys(PRESETS).map((p) => `<button class="pill small" data-p="${p}">${p}</button>`).join('');
  $('#presets').addEventListener('click', (e) => {
    const p = e.target.dataset.p; if (!p) return;
    Object.assign(state, Object.fromEntries(CONTROLS.map((c) => [c.k, c.def])), PRESETS[p]);
    buildDrawer(); render(); toast(`프리셋: ${p}`);
  });

  // URL 파라미터(스크린샷·검증용): ?theme=dark&preset=…
  const q = new URLSearchParams(location.search);
  if (q.get('theme') === 'dark') state.theme = '다크';
  if (q.get('preset') && PRESETS[q.get('preset')]) Object.assign(state, PRESETS[q.get('preset')]);

  buildDrawer();
  render();

  // 자기검증 푸터 — 헤드리스 검증이 data-pass를 읽는다
  const tests = runSelfTest();
  const bad = tests.filter((t) => !t.pass);
  const st = $('#selftest');
  st.dataset.pass = bad.length === 0 ? 'true' : 'false';
  st.innerHTML = bad.length === 0
    ? `<span class="ok">자기검증 ${tests.length}/${tests.length} 통과</span> — 일진 앵커·기두법·운성·신살·공망 규칙 일치`
    : `<span class="bad">자기검증 실패 ${bad.length}건</span> ${bad.map((b) => `${b.name}: ${b.got}≠${b.want}`).join(' / ')}`;
}
