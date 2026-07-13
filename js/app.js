// =========================================================
// app.js — 부트스트랩
//   유닛을 라우터에 등록하고, 전역 UI(테마·스크롤탑)를 연결한다.
//   새 기능을 추가하려면: units/NNN-xxx.unit.js 를 만들어
//   아래 register 에 한 줄 매달면 끝.
// =========================================================
import { Router } from "./core/001-router.core.js";
import { toast } from "./knowledge/004-clipboard.knowledge.js";
import sajuUnit from "./units/003-saju.unit.js";
import sceneDetailUnit from "./units/002-scene-detail.unit.js";

// 리빌 활성화(렌더 전에 켜야 첫 화면도 숨김→등장). 이 줄이 안 돌면 .reveal 은 그냥 보임.
document.documentElement.classList.add("reveal-ready");

// ---- 라우터 구성 (단일 인스턴스) ----
const router = new Router({
  view: document.getElementById("view"),
  overlay: document.getElementById("overlay"),
});

router
  .register(sajuUnit)
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
// (구 랜딩의 nav-cta→#scenes 스크롤 핸들러는 랜딩 제거로 함께 제거. 헤더 리브랜딩은 UI 단계에서.)

// ---- PWA: 앱 설치 + 오프라인 (sw.js) ----

// 서비스 워커 등록 — 오프라인 사본을 만들고, 브라우저 설치 요건을 채운다
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// 설치 버튼: 브라우저가 "설치 가능" 신호(beforeinstallprompt)를 주면 켠다.
//   이미 앱 창(standalone)으로 열렸으면 켜지 않는다.
//   아이폰 사파리는 이 신호가 없어 버튼 대신 FAQ 안내(공유 → 홈 화면에 추가)로 커버.
const installBtn = document.getElementById("pwa-install");
const inApp =
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let installEvt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // 브라우저 미니 배너 대신 우리 버튼으로
  installEvt = e;
  if (!inApp && installBtn) installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!installEvt) return;
  const evt = installEvt;
  installEvt = null; // prompt() 는 이벤트당 1회만 허용
  installBtn.hidden = true;
  evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome !== "accepted") toast("설치를 취소했어요 — 버튼은 다음 방문에 다시 떠요", false);
});

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.hidden = true;
  toast("앱 설치 완료 — 바탕화면·홈 화면에 바로가기가 생겼어요 ✓");
});
