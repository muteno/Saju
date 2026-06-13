// =========================================================
// knowledge/007-reveal.knowledge.js
// 공통 지식 — 스크롤/로드 리빌 "촤르르".
//   minimum-code IX2 재현: 같은 그룹(부모) 내 요소를 100ms 간격
//   stagger 로 순차 등장(translateY 10px→0, .3s ease).
//   prefers-reduced-motion / IO 미지원 시 즉시 표시.
// =========================================================

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const STAGGER = 100; // ms — IX2 공통 stagger 간격
const CAP = 700;     // 최대 누적 지연

let io;
function observer() {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );
  return io;
}

/** 같은 부모 안에서의 reveal 형제 순번 → stagger 지연 */
function siblingDelay(el) {
  const sibs = el.parentElement
    ? [...el.parentElement.children].filter((c) => c.classList.contains("reveal"))
    : [el];
  const i = Math.max(0, sibs.indexOf(el));
  return Math.min(i * STAGGER, CAP);
}

/** root 안의 아직 안 보인 .reveal 요소들을 관찰 */
export function observeReveals(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  if (reduced || typeof IntersectionObserver === "undefined") {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const o = observer();
  els.forEach((el) => {
    if (!el.style.transitionDelay) el.style.transitionDelay = `${siblingDelay(el)}ms`;
    o.observe(el);
  });
}
