// =========================================================
// app.js — 부트스트랩
//   유닛을 라우터에 등록한다. 새 기능을 추가하려면:
//   units/NNN-xxx.unit.js 를 만들어 아래 register 에 한 줄 매달면 끝.
// =========================================================
import { Router } from "./core/001-router.core.js";
import sajuUnit from "./units/003-saju.unit.js";

// ---- 라우터 구성 (단일 인스턴스) ----
const router = new Router({
  view: document.getElementById("view"),
  overlay: document.getElementById("overlay"),
});

router.register(sajuUnit).start();

// 외부에서 접근 가능하도록(디버그/확장)
window.Yeul = { router };

// ---- PWA: 오프라인 사본 (sw.js) ----
//   설치 버튼·테마 토글·아이콘은 리브랜딩(UI 단계)에서 자산과 함께 복원.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
