// =========================================================
// app.js — 부트스트랩
//   유닛을 라우터에 등록하고, 전역 UI(테마·스크롤탑)를 연결한다.
//   새 기능을 추가하려면: units/NNN-xxx.unit.js 를 만들어
//   아래 register 에 한 줄 매달면 끝.
// =========================================================
import { Router } from "./core/001-router.core.js";
import landingUnit from "./units/001-landing.unit.js";
import sceneDetailUnit from "./units/002-scene-detail.unit.js";

// 리빌 활성화(렌더 전에 켜야 첫 화면도 숨김→등장). 이 줄이 안 돌면 .reveal 은 그냥 보임.
document.documentElement.classList.add("reveal-ready");

// ---- 라우터 구성 (단일 인스턴스) ----
const router = new Router({
  view: document.getElementById("view"),
  overlay: document.getElementById("overlay"),
});

router
  .register(landingUnit)
  .register(sceneDetailUnit)
  .start();

// 외부에서 접근 가능하도록(디버그/확장)
window.Yeul = { router };

// ---- 전역 UI ----

// 테마
const themeBtn = document.getElementById("theme-btn");
const savedTheme = localStorage.getItem("yeul.theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
themeBtn?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("yeul.theme", next);
});

// 스크롤 탑 (우하단 플로팅). 상단 내비는 항상 고정 표시.
const topBtn = document.getElementById("scroll-top");
const onScroll = () => topBtn?.classList.toggle("show", window.scrollY > 320);
window.addEventListener("scroll", onScroll, { passive: true });
topBtn?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
onScroll();

// 브랜드(.brand[data-route])는 라우터의 링크 위임이 처리한다.

// 내비 CTA → 장면 섹션으로 스크롤
document.getElementById("nav-cta")?.addEventListener("click", () => {
  router.navigate("/");
  requestAnimationFrame(() =>
    document.getElementById("scenes")?.scrollIntoView({ behavior: "smooth" }));
});
