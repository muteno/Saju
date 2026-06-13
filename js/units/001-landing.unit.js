// =========================================================
// units/001-landing.unit.js
// 유닛 — 「탈예울」 영화 프로모션 원페이지. 라우터 view 레이어.
//   히어로 → 마퀴 → 시놉시스 → 관객 → 장면 → FAQ → 크레딧 → 푸터.
//   막(Act) 필터·스크롤 리빌은 유닛 내부에서 관리.
// =========================================================
import { BRAND, CREDITS, CTA, AUDIENCE, FAQ, FOOTER, ACTS } from "../knowledge/002-brand.knowledge.js";
import { getScenes } from "../knowledge/003-scenes.knowledge.js";
import { sceneCard, sectionHead, AUDIENCE_ICON, ICON } from "../knowledge/005-ui-kit.knowledge.js";
import { esc } from "../knowledge/001-formatters.knowledge.js";
import { observeReveals } from "../knowledge/007-reveal.knowledge.js";

const state = { act: "전체" };
let router;

const MARQUEE = ["탈예울 脫例蔚", "그것은 더 이상 권고가 아니다", "전국 동시 퇴사", "COMING SOON", "사직이 아니라 탈출이다"];

const SOCIAL = {
  x: `<svg viewBox="0 0 24 24"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2l7.8-8.9L1.5 2H8l4.7 6.2L18.9 2zm-2.3 18h1.8L7.2 4H5.3l11.3 16z"/></svg>`,
  ig: `<svg viewBox="0 0 24 24"><path d="M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 7.4a2.9 2.9 0 110-5.8 2.9 2.9 0 010 5.8zM17 2H7a5 5 0 00-5 5v10a5 5 0 005 5h10a5 5 0 005-5V7a5 5 0 00-5-5zm3.4 15A3.4 3.4 0 0117 20.4H7A3.4 3.4 0 013.6 17V7A3.4 3.4 0 017 3.6h10A3.4 3.4 0 0120.4 7v10zm-2.9-9.9a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0z"/></svg>`,
  gh: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.3-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.6.9.6 1.9v2.8c0 .3.2.6.7.5A10 10 0 0012 2z"/></svg>`,
};

function scenesFiltered() {
  return getScenes().filter((s) => state.act === "전체" || s.act === state.act);
}

function renderScenes(mount) {
  const grid = mount.querySelector("#scene-grid");
  grid.innerHTML = scenesFiltered().map(sceneCard).join("");
  grid.querySelectorAll(".scene-card").forEach((card) => {
    card.classList.add("reveal", "zoom");
    const open = () => router.setQuery({ id: card.dataset.id });
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
  observeReveals(grid);
}

function render({ mount, router: r }) {
  router = r;
  const marqGroup = `<div class="marquee-group">${MARQUEE.map((m) => `<span>${esc(m)}</span>`).join("")}</div>`;

  mount.innerHTML = `
    <!-- HERO -->
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"></div>
      <span class="eyebrow center reveal">전국퇴사자연합 presents</span>
      <h1 class="hero-title reveal">
        <span class="ko">${esc(BRAND.titleKo)}</span>
        <span class="hanja">${esc(BRAND.titleHanja)}</span>
      </h1>
      <p class="hero-roman reveal">${esc(BRAND.titleRoman)}</p>
      <p class="hero-sub reveal">${esc(BRAND.subtitle)}</p>
      <p class="hero-logline reveal">${esc(BRAND.logline)}</p>
      <div class="hero-cta reveal">
        <button class="btn primary" data-scroll="#scenes">${CTA.primary} ${ICON.arrow}</button>
        <button class="btn ghost" data-open="001">${ICON.play} ${CTA.trailer}</button>
      </div>
      <p class="hero-release reveal">${esc(BRAND.release.main)}</p>
      <figure class="poster reveal" role="img" aria-label="메인 포스터">
        <img src="/assets/images/001-hero-poster.webp" alt="" loading="lazy" />
        <div class="poster-inner">
          <span class="poster-tag">KEY ART</span>
          <p class="poster-quote gungseo">“${esc(BRAND.taglines[0])}”</p>
          <span class="poster-note">메인 포스터 (교체 가능)</span>
        </div>
      </figure>
    </section>

    <!-- MARQUEE -->
    <div class="marquee" aria-hidden="true"><div class="marquee-track">${marqGroup}${marqGroup}</div></div>

    <!-- SYNOPSIS -->
    <section class="band" id="synopsis">
      <div>${sectionHead("SYNOPSIS", "시놉시스", "")}</div>
      <p class="synopsis reveal">${esc(BRAND.synopsis)}</p>
      <div class="taglines reveal">
        ${BRAND.taglines.map((t) => `<p class="tagline gungseo">${esc(t)}</p>`).join("")}
      </div>
    </section>

    <!-- WHO'S IT FOR -->
    <section class="band" id="audience">
      <div>${sectionHead("WHO'S IT FOR", "이런 당신에게", "")}</div>
      <div class="aud-grid">
        ${AUDIENCE.map((a) => `
          <article class="aud-card reveal zoom">
            <span class="aud-ico">${AUDIENCE_ICON[a.icon] || ""}</span>
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.desc)}</p>
          </article>`).join("")}
      </div>
    </section>

    <!-- SCENES -->
    <section class="band" id="scenes">
      <div>${sectionHead("SCENES", "원문과 시, 여섯 개의 장면", "직장의 한 컷이 원문이 되고, 그 옆에 시가 선다. 한 장면을 열어 전문을 읽고, 복사하거나 이미지로 저장하세요.")}</div>
      <div class="act-tabs reveal" role="tablist">
        ${ACTS.map((a) => `<button class="act-tab${a === state.act ? " on" : ""}" data-act="${esc(a)}" role="tab">${esc(a)}</button>`).join("")}
      </div>
      <div id="scene-grid" class="scene-grid"></div>
    </section>

    <!-- FAQ -->
    <section class="band" id="faq">
      <div>${sectionHead("FAQ", "자주 묻는 질문", "")}</div>
      <div class="faq reveal">
        ${FAQ.map((f) => `
          <details class="faq-item">
            <summary>${esc(f.q)}</summary>
            <p>${esc(f.a)}</p>
          </details>`).join("")}
      </div>
    </section>

    <!-- CREDITS -->
    <section class="band credits-band" id="credits">
      <div class="credits-bg" aria-hidden="true"></div>
      ${sectionHead("CREDITS", "엔딩 크레딧", "")}
      <ul class="credits">
        ${CREDITS.map((c) => `<li>${esc(c)}</li>`).join("")}
      </ul>
      <p class="rating">${esc(BRAND.release.rating)}</p>
      <p class="rating sub">${esc(BRAND.release.sub)}</p>
    </section>

    <!-- FOOTER -->
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="f-mark">EXIT <b>: MARU</b></div>
          <p>${esc(BRAND.logline)}</p>
          <p class="gungseo">${esc(BRAND.taglines[0])}</p>
        </div>
        <div class="footer-col">
          <h4>작품</h4>
          <a href="#synopsis">시놉시스</a>
          <a href="#scenes">장면</a>
          <a href="#faq">FAQ</a>
        </div>
        <div class="footer-col">
          <h4>바로가기</h4>
          <span data-open="001">예고편 보기</span>
          <a href="#scenes">지금 탈출하기</a>
          <a href="#audience">이런 당신에게</a>
        </div>
        <div class="footer-col">
          <h4>정보</h4>
          <a href="#credits">엔딩 크레딧</a>
          <span>이미지 · 폰트 출처(CC0)</span>
          <span>${esc(BRAND.release.rating)}</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>${esc(FOOTER)}</span>
        <div class="socials">
          <a href="#" aria-label="X">${SOCIAL.x}</a>
          <a href="#" aria-label="Instagram">${SOCIAL.ig}</a>
          <a href="#" aria-label="GitHub">${SOCIAL.gh}</a>
        </div>
      </div>
    </footer>`;

  // 부드러운 스크롤 CTA
  mount.querySelectorAll("[data-scroll]").forEach((b) =>
    (b.onclick = () => mount.querySelector(b.dataset.scroll)?.scrollIntoView({ behavior: "smooth" })));
  // 예고편 = 장면 열기
  mount.querySelectorAll("[data-open]").forEach((b) =>
    (b.onclick = () => router.setQuery({ id: b.dataset.open })));
  // 막 필터
  mount.querySelectorAll(".act-tab").forEach((tab) =>
    (tab.onclick = () => {
      state.act = tab.dataset.act;
      mount.querySelectorAll(".act-tab").forEach((t) => t.classList.toggle("on", t === tab));
      renderScenes(mount);
    }));

  renderScenes(mount);
  observeReveals(mount);
}

export default {
  seq: 1,
  id: "landing",
  layer: "view",
  match: (path) => path === "",
  key: () => "landing",
  render,
};
