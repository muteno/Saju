// =========================================================
// units/002-scene-detail.unit.js
// 유닛 — 장면 상세 모달. 라우터 overlay 레이어(?id=).
//   원문 + 시(궁서체)를 나란히, 각각 복사 가능. 이전/다음 이동.
// =========================================================
import { getScene, adjacentScene } from "../knowledge/003-scenes.knowledge.js";
import { ICON } from "../knowledge/005-ui-kit.knowledge.js";
import { esc, ymd } from "../knowledge/001-formatters.knowledge.js";
import { copyWithToast, toast } from "../knowledge/004-clipboard.knowledge.js";
import { downloadPoemImage } from "../knowledge/006-poem-image.knowledge.js";

let mountedId = null;
let keyHandler = null;

function close(router) { router.setQuery({ id: null }); }

/** 시 본문 -> 행(빈 줄=연 구분) */
function verses(poem = "") {
  return poem.split("\n")
    .map((l) => (l.trim() === "" ? `<div class="v-gap"></div>` : `<p class="v-line">${esc(l.trim())}</p>`))
    .join("");
}

function detachKeys() {
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  keyHandler = null;
  document.body.classList.remove("modal-open");
}

function render({ mount, params, router }) {
  const id = params.get("id");
  const s = id && getScene(id);

  if (!s) {                       // id 없음/오류 → 정리
    if (mount.innerHTML) mount.innerHTML = "";
    mountedId = null;
    detachKeys();
    if (id) router.setQuery({ id: null, replace: true });
    return;
  }
  if (mountedId === id) return;   // 동일 장면 재렌더 방지
  mountedId = id;

  const prev = adjacentScene(id, -1);
  const next = adjacentScene(id, 1);
  const copyPoem = `${s.title}\n\n${s.poem}\n\n— 「탈예울」 ${s.act} · SCENE ${s.id}`;
  const copyAll = `[원문]\n${s.source}\n\n[시]\n${s.poem}\n\n— 「탈예울」 ${s.act} · SCENE ${s.id}`;

  mount.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal glass" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
      <header class="modal-head">
        <div class="modal-head-left">
          <span class="act-badge">${esc(s.act)}</span>
          <span class="scene-no">SCENE ${esc(s.id)} · ${esc(s.category)} · ${esc(ymd(s.date))}</span>
        </div>
        <button class="icon-btn" id="close-btn" aria-label="닫기">${ICON.close}</button>
      </header>

      <div class="modal-body">
        <h1 class="modal-title">${esc(s.title)}</h1>

        <div class="scene-split">
          <section class="pane source-pane">
            <div class="pane-head"><span>원문</span>
              <button class="pill-btn ghost" id="copy-src">${ICON.copy} 복사</button>
            </div>
            <p class="source-text">${esc(s.source)}</p>
          </section>

          <section class="pane poem-pane">
            <div class="pane-head"><span>시</span>
              <div class="pane-actions">
                <button class="pill-btn ghost" id="save-poem">${ICON.download} 이미지</button>
                <button class="pill-btn" id="copy-poem">${ICON.copy} 복사</button>
              </div>
            </div>
            <div class="poem gungseo">${verses(s.poem)}</div>
          </section>
        </div>

        <div class="modal-tags">
          ${(s.hashtags || []).map((h) => `<span class="tag">${esc(h)}</span>`).join("")}
        </div>

        <div class="modal-nav">
          <button class="nav-btn" id="prev-btn" ${prev ? "" : "disabled"}>← ${prev ? esc(prev.title) : "처음"}</button>
          <button class="pill-btn outline" id="copy-all">${ICON.copy} 원문+시 전체 복사</button>
          <button class="nav-btn" id="next-btn" ${next ? "" : "disabled"}>${next ? esc(next.title) : "끝"} →</button>
        </div>
      </div>
    </div>`;

  mount.querySelector("#copy-src").onclick = () => copyWithToast(s.source, "원문을 복사했어요");
  mount.querySelector("#copy-poem").onclick = () => copyWithToast(copyPoem, "시를 복사했어요");
  mount.querySelector("#copy-all").onclick = () => copyWithToast(copyAll, "원문과 시를 복사했어요");
  mount.querySelector("#save-poem").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    toast("이미지 생성 중…");
    const ok = await downloadPoemImage(s).catch(() => false);
    toast(ok ? "시 이미지를 저장했어요 ✓" : "이미지 저장에 실패했어요", ok);
    btn.disabled = false;
  };
  mount.querySelector("#close-btn").onclick = () => close(router);
  mount.querySelector("[data-close]").onclick = () => close(router);
  if (prev) mount.querySelector("#prev-btn").onclick = () => router.setQuery({ id: prev.id });
  if (next) mount.querySelector("#next-btn").onclick = () => router.setQuery({ id: next.id });

  detachKeys();
  keyHandler = (e) => {
    if (e.key === "Escape") close(router);
    else if (e.key === "ArrowLeft" && prev) router.setQuery({ id: prev.id });
    else if (e.key === "ArrowRight" && next) router.setQuery({ id: next.id });
  };
  document.addEventListener("keydown", keyHandler);
  document.body.classList.add("modal-open");
}

export default {
  seq: 2,
  id: "scene-detail",
  layer: "overlay",
  match: () => true,   // 항상 평가 → id 제거 시 정리까지 담당
  render,
};
