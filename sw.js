// =========================================================
// sw.js — 서비스 워커 (PWA 설치·오프라인의 뼈대)
//
//   전략 = 네트워크 우선, 실패하면 캐시 폴백.
//     · 온라인이면 항상 서버의 최신을 보여준다 → 정적 사이트의
//       고질병("옛날 화면이 캐시에 눌어붙어 안 바뀜")을 원천 차단.
//     · 오프라인이거나 서버가 죽으면, 담아둔 사본으로 화면을 연다.
//
//   PRECACHE = 설치 순간 미리 담아두는 "첫 화면 셸" 목록.
//     ⚠ 새 js/css/핵심 이미지 파일을 추가하면 여기에도 한 줄 추가
//       (안 하면 그 파일만 오프라인 첫 화면에서 빠진다).
//     ⚠ 목록의 파일이 하나라도 404면 설치 자체가 실패한다 —
//       파일을 지우면 여기서도 반드시 지울 것.
//   CACHE 버전을 올리면(v5→v6) 옛 캐시는 activate 때 청소된다.
// =========================================================

const CACHE = "yeul-v7";

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/css/003-saju.css",
  "/js/app.js",
  "/js/core/000-convention.core.js",
  "/js/core/001-router.core.js",
  "/js/units/003-saju.unit.js",
  "/js/knowledge/009-consult-graph.knowledge.js",
  "/js/knowledge/010-jeonggok.knowledge.js",
  "/manse/js/knowledge/011-cheongan-archetype.knowledge.js",
  "/manse/js/knowledge/014-special-sinsal.knowledge.js",
  // 사주 코어가 쓰는 만세력 엔진 폐포(10) — 하나라도 빠지면 오프라인 첫 화면 백지
  "/manse/js/core/001-calendar.core.js",
  "/manse/js/core/002-saju-engine.core.js",
  "/manse/js/knowledge/001-ganji.knowledge.js",
  "/manse/js/knowledge/002-jijanggan.knowledge.js",
  "/manse/js/knowledge/003-sipsin.knowledge.js",
  "/manse/js/knowledge/004-unseong-sinsal.knowledge.js",
  "/manse/js/knowledge/005-strength-yongsin.knowledge.js",
  "/manse/js/knowledge/008-hapchung.knowledge.js",
  "/manse/js/knowledge/009-pattern.knowledge.js",
  "/manse/js/knowledge/012-jiji-archetype.knowledge.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // GET + 같은 도메인만 관여 (폰트 CDN 등 외부는 브라우저 기본 동작 그대로)
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // SPA 폴백: 어떤 경로로 열어도 오프라인이면 index.html 을 준다
          if (req.mode === "navigate") return caches.match("/index.html");
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
