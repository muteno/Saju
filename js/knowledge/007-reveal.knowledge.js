// =========================================================
// knowledge/007-reveal.knowledge.js
// 공통 지식 — 스크롤/로드 리빌 "촤르르".
//   같은 그룹(부모) 내 요소를 90ms 간격으로 순차 등장.
//   stagger 는 setTimeout 으로 .in 부여 시점만 늦춘다
//   (transition-delay 를 인라인으로 남기지 않아 hover 등 다른
//    트랜지션에 지연이 새지 않음).
//   prefers-reduced-motion / IO 미지원 시 즉시 표시.
// =========================================================

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const STAGGER = 90; // ms
const CAP = 720;

let io;
function observer() {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const d = Number(e.target.dataset.revealDelay || 0);
          if (d) setTimeout(() => e.target.classList.add("in"), d);
          else e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );
  return io;
}

/** 같은 부모 안에서의 reveal 형제 순번 → stagger 지연(ms) */
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
    el.dataset.revealDelay = String(siblingDelay(el));
    o.observe(el);
  });
}
