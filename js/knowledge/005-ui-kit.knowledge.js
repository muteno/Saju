// =========================================================
// knowledge/005-ui-kit.knowledge.js
// 공통 지식 — 아이콘 · 장면 카드 · 섹션 조각.
//   영화 프로모션 톤: 라운드 카드 + 막(Act) 배지 + 시 미리보기(궁서체).
// =========================================================
import { esc, ymd } from "./001-formatters.knowledge.js";

export const ICON = {
  arrow: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  arrowUpRight: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  up: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  film: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/></svg>`,
};

/** WHO'S IT FOR 카드 아이콘 */
export const AUDIENCE_ICON = {
  battery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="16" height="8" rx="2"/><path d="M22 11v2M6 12h2"/></svg>`,
  draft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 13h6M9 16h4"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17l5-5-5-5M21 12H9M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/></svg>`,
};

/** 원문 앞부분 발췌 */
export function excerpt(text = "", n = 64) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/** 시의 첫 의미있는 행 */
export function firstVerse(poem = "") {
  return (poem.split("\n").find((l) => l.trim()) || "").trim();
}

/** 장면 카드 (영화 한 컷 느낌) */
export function sceneCard(s) {
  return `
    <article class="scene-card" data-id="${esc(s.id)}" tabindex="0" role="button"
             aria-label="${esc(s.act)} ${esc(s.title)} 장면 열기">
      <div class="scene-top">
        <span class="act-badge">${esc(s.act)}</span>
        <span class="scene-no">SCENE ${esc(s.id)}</span>
        <span class="scene-open" aria-hidden="true">${ICON.arrowUpRight}</span>
      </div>
      <h3 class="scene-title">${esc(s.title)}</h3>
      <p class="scene-source">${esc(excerpt(s.source, 78))}</p>
      <p class="scene-verse gungseo">“${esc(firstVerse(s.poem))}”</p>
      <div class="scene-foot">
        <span class="tag cat">${esc(s.category)}</span>
        <span class="scene-date">${esc(ymd(s.date))}</span>
      </div>
    </article>`;
}

export function sectionHead(eyebrow, title, lead = "") {
  return `
    <header class="sec-head">
      ${eyebrow ? `<span class="eyebrow reveal">${esc(eyebrow)}</span>` : ""}
      <h2 class="sec-title reveal">${esc(title)}</h2>
      ${lead ? `<p class="sec-lead reveal">${esc(lead)}</p>` : ""}
    </header>`;
}
