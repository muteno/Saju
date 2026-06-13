// =========================================================
// knowledge/006-poem-image.knowledge.js
// 공통 지식 — 시를 1080×1350(세로) 이미지로 렌더 + 다운로드.
//   인스타 세로 규격. 시는 궁서체로, 시네마틱 코발트 배경 위에.
// =========================================================

const W = 1080;
const H = 1350;
const GUNGSEO = `"GungSuh", "궁서", "Batang", "Nanum Myeongjo", serif`;
const SANS = `"Pretendard Variable", Pretendard, sans-serif`;

/** 캔버스 렌더에 필요한 폰트 로드 보장 */
async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`800 52px ${SANS}`),
      document.fonts.load(`400 50px "Nanum Myeongjo"`),
      document.fonts.load(`700 26px ${SANS}`),
    ]);
    await document.fonts.ready;
  } catch { /* 폴백 폰트로 진행 */ }
}

/** 한 행을 최대 폭에 맞춰 줄바꿈(한글: 글자 단위) */
function wrap(ctx, text, maxWidth) {
  const out = [];
  let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) { out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** 시 본문 → 표시 라인(빈 줄 = 연 구분) 배열, 폰트 크기 자동 맞춤 */
function layoutPoem(ctx, poem, maxWidth, top, bottom) {
  const raw = poem.split("\n").map((l) => l.trim());
  for (let size = 52; size >= 30; size -= 2) {
    ctx.font = `400 ${size}px ${GUNGSEO}`;
    const lh = size * 1.95;
    const gap = size * 0.95;
    const lines = [];
    for (const ln of raw) {
      if (ln === "") { lines.push({ gap: true }); continue; }
      for (const sub of wrap(ctx, ln, maxWidth)) lines.push({ text: sub });
    }
    const total = lines.reduce((s, l) => s + (l.gap ? gap : lh), 0);
    if (total <= bottom - top || size === 30) return { size, lh, gap, lines, total };
  }
  return null;
}

/** scene 의 시를 1080×1350 PNG 캔버스로 그린다 */
export async function renderPoemCanvas(scene) {
  await ensureFonts();
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  // 배경: 시네마틱 코발트 → 암청 그라데이션
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1430");
  g.addColorStop(0.5, "#0a0f1f");
  g.addColorStop(1, "#05070f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 상단 글로우
  const rg = ctx.createRadialGradient(W / 2, -120, 60, W / 2, -120, 760);
  rg.addColorStop(0, "rgba(47,107,255,0.38)");
  rg.addColorStop(1, "rgba(47,107,255,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // 외곽 프레임
  ctx.strokeStyle = "rgba(120,150,210,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // 헤더
  ctx.fillStyle = "#5b8cff";
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText("「탈예울」  脫例蔚", W / 2, 152);
  ctx.fillStyle = "#62718f";
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(`${scene.act} · SCENE ${scene.id} · ${scene.category}`, W / 2, 196);

  // 제목 (보통 한 줄)
  ctx.fillStyle = "#eef3fc";
  ctx.font = `800 50px ${SANS}`;
  ctx.fillText(scene.title, W / 2, 296);

  // 구분선
  ctx.strokeStyle = "rgba(120,150,210,0.25)";
  ctx.beginPath(); ctx.moveTo(W / 2 - 50, 340); ctx.lineTo(W / 2 + 50, 340); ctx.stroke();

  // 시 본문 (자동 맞춤)
  const top = 380, bottom = 1130;
  const L = layoutPoem(ctx, scene.poem, W - 220, top, bottom);
  if (L) {
    let y = top + (bottom - top - L.total) / 2 + L.size;
    ctx.fillStyle = "#f4f1e8";
    ctx.font = `400 ${L.size}px ${GUNGSEO}`;
    for (const l of L.lines) {
      if (l.gap) { y += L.gap; continue; }
      ctx.fillText(l.text, W / 2, y);
      y += L.lh;
    }
  }

  // 푸터
  ctx.fillStyle = "#ffcf8a";
  ctx.font = `700 27px ${SANS}`;
  ctx.fillText("그것은 더 이상 권고가 아니다.", W / 2, 1222);
  ctx.fillStyle = "#7e8aa6";
  ctx.font = `700 24px ${SANS}`;
  ctx.fillText("EXIT : MARU", W / 2, 1266);

  return cv;
}

/** 시 이미지를 PNG 로 다운로드 */
export async function downloadPoemImage(scene) {
  const cv = await renderPoemCanvas(scene);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tal-yeul-scene-${scene.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
