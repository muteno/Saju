// ★두뇌 패널 — 정제 지도가 이 사주에 대해 «무엇을, 왜» 아는지 그대로 보여준다.
//
// 운영자 260727: *"앱에 뇌를 달아주셈"* · *"뇌 연결도 한번 다시 띄워주라"*
//
// ⚠이 패널의 설계 원칙 세 가지 (프로젝트 규칙에서 그대로 온다)
//   ①**낭설을 숨기지 않는다.** 「이유를 못 대는 관계」가 몇 개인지 숫자로 띄운다.
//     운영자 축자: *"자미원진이 애증관계예요? 왜요? > 몰라요 > (실패)"*
//     숨기면 앱이 그걸 근거처럼 쓰고, 그게 «낭설»이다.
//   ②**결론을 쓰지 않는다.** 여기 뜨는 건 정의·관계·조건뿐이다.
//     「이러면 이렇게 산다」는 지도에도 없고 화면에도 없다(운영자 1-36).
//   ③**판본이 갈리면 병기한다.** stance가 붙은 관계는 ⚖로 표시한다.

type Rel = {
  a: string; b: string; 관계: string; 층?: string; 부호?: string | null
  효과?: string | null      // 촉진 / 해소 — 부호와 다른 축(발생량의 방향)
  조건?: unknown; 왜?: string | null; 사슬?: string[] | null
  근거?: string; stance?: string | null; 근거유형?: string | null
}
type NodeCard = { 키: string; 노드: string; 대주제?: string; 중주제?: string; 정의?: string; 문단?: number; 출처수?: number }
export type Brain = {
  노드: NodeCard[]; 관계: Rel[]; 조견표: unknown[]; 못맞춘키: string[]
  이유있는관계?: Rel[]; 낭설수?: number; meta?: Record<string, unknown> | null
}

import { tokens } from '../theme'

// 색 = 전부 토큰 계승(T3 게이트) — 결정론=primary · 조건부=lunar · 그 외=inkFaint
const 층색 = (층?: string) =>
  층?.startsWith('L1결정론') ? tokens.color.primary : 층?.startsWith('L1½') ? tokens.color.lunar : tokens.color.inkFaint

const 왜라벨: Record<string, string> = {
  인과닫힘: '이유까지 닿음', 작용까지: '힘이 오간 자리까지', 발현만: '결과만 붙음',
  분류경로: '분류로만 이어짐', 낭설후보: '이유 못 댐',
  // ★260728 — L1 결정론 층의 판정 4종. 그전엔 이 값들이 앱에 아예 안 왔다(전부 null)
  //   = 「글자 → 겪는 일」을 말하는 발현 층이 화면에서 통째로 빠져 있었다.
  //   L1은 검증 «대상»이 아니라 검증의 «바탕»이라 「못 믿을 것」이 아니다.
  공리: '더 물으면 명리 밖', 파생: '공리로 환원됨',
  인과: '그래서 이렇게 된다', 목차: '학습 순서 — 이유 아님',
  미검증: '아직 안 따져봄',
  // ★260728 — 인물·상담화법 접촉. 이유가 없는 게 아니라 애초에 명제가 아니다.
  비명제: '인물·화법 메타 — 명제 아님',
}
// 이유가 단단한 순 — L1 공리·파생·인과는 사슬로 따질 «대상»이 아니라 바탕이므로 위로 온다
const 왜순위: Record<string, number> = {
  인과닫힘: 0, 공리: 1, 파생: 2, 인과: 3, 작용까지: 4, 발현만: 5, 분류경로: 6, 목차: 7, 미검증: 8,
}

export default function BrainPanel({ brain }: { brain?: Brain | null }) {
  if (!brain || !brain.노드?.length) return null
  // ★260728 — «비명제»(인물·화법 메타)도 「이유 있는 것」이 아니다. 갈래만 신설했는데
  //   여기 필터를 안 넓히면 764건이 하루아침에 «이유 있음»으로 둔갑한다(한 군데만 고치기).
  const 없는쪽 = new Set(['낭설후보', '비명제', '미검증'])
  const 이유 = brain.이유있는관계 ?? brain.관계.filter((r) => r.왜 && !없는쪽.has(r.왜))
  const 낭설 = brain.낭설수 ?? brain.관계.length - 이유.length
  // 이유가 가장 단단한 것부터 — 인과닫힘 > 작용까지 > 발현만 > 분류경로
  const 상위 = [...이유].sort((x, y) => (왜순위[x.왜 ?? ''] ?? 9) - (왜순위[y.왜 ?? ''] ?? 9)).slice(0, 24)

  return (
    <section style={{ marginTop: 28, padding: '18px 16px', borderRadius: tokens.radius.lg,
                      border: `1px solid color-mix(in srgb, ${tokens.color.primary} 28%, transparent)`,
                      background: `color-mix(in srgb, ${tokens.color.primary} 5%, transparent)` }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tokens.color.primary }}>
          이 사주에서 읽은 관계
        </h3>
        <span style={{ fontSize: 12, opacity: .7 }}>
          글자 {brain.노드.length} · 관계 {brain.관계.length.toLocaleString()} ·
          {' '}이유 있는 것 {이유.length.toLocaleString()}
        </span>
      </header>

      {/* ⚠«이유 못 대는 것»을 숨기지 않는다 — 이게 이 패널의 핵심 규칙이다 */}
      {낭설 > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, opacity: .8 }}>
          ⚠ 이 중 <b>{낭설.toLocaleString()}개</b>는 아직 <b>왜 그런지 근거를 대지 못합니다.</b>{' '}
          아래에는 <b>이유를 댈 수 있는 것만</b> 띄웁니다 — 못 대는 것을 근거처럼 쓰지 않으려고요.
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
        {상위.map((r, i) => (
          <li key={i} style={{ padding: '10px 12px', borderRadius: tokens.radius.md,
                               background: `color-mix(in srgb, ${tokens.color.ink} 4%, transparent)`,
                               fontSize: 13.5, lineHeight: 1.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <b>{r.a}</b>
              <span style={{ color: 층색(r.층), fontWeight: 700 }}>─{r.관계}→</span>
              <b>{r.b}</b>
              {r.부호 && r.부호 !== '중립' && (
                <span style={{ fontSize: 11, opacity: .65 }}>({r.부호})</span>
              )}
              {/* ★260728 «효과» — 부호와 다른 축이다. 같은 '+'라도 역마→이동은 «촉진»이고
                  천을귀인→구설·송사는 «해소»다. 이 칸이 없으면 앱이 해소를 촉진으로 읽는다. */}
              {r.효과 && (
                <span style={{ fontSize: 11, fontWeight: 700,
                               color: r.효과 === '해소' ? tokens.color.lunar : tokens.color.primary }}>
                  {r.효과 === '해소' ? '덜어냄' : '북돋움'}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: .6 }}>
                {왜라벨[r.왜 ?? ''] ?? r.왜}
              </span>
            </div>
            {Array.isArray(r.조건) && r.조건.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, opacity: .75 }}>
                조건 · {(r.조건 as string[]).slice(0, 2).join(' / ')}
              </div>
            )}
            {/* 사슬 = «왜»의 실물. 이게 있으면 도사가 근거를 말할 수 있다 */}
            {r.사슬 && r.사슬.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, opacity: .7 }}>
                까닭 · {r.사슬.slice(0, 3).join(' → ')}
              </div>
            )}
            {/* ⚖판본 갈림 — 지우지 않고 병기한다(§3) */}
            {r.stance && (
              <div style={{ marginTop: 4, fontSize: 11.5, opacity: .62 }}>
                ⚖ {String(r.stance).slice(0, 110)}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 못 맞춘 키 — 조용히 버리지 않는다 */}
      {brain.못맞춘키?.length > 0 && (
        <p style={{ margin: '12px 0 0', fontSize: 11.5, opacity: .55 }}>
          지도가 아직 못 받은 키 {brain.못맞춘키.length}개 — {brain.못맞춘키.slice(0, 6).join(' · ')}
        </p>
      )}
      <p style={{ margin: '12px 0 0', fontSize: 11.5, opacity: .5, lineHeight: 1.6 }}>
        여기 뜨는 것은 <b>관계와 조건</b>입니다. 「이러면 이렇게 산다」는 담지 않습니다 —
        같은 글자도 놓인 자리와 운에 따라 다르게 나타나기 때문입니다.
      </p>
    </section>
  )
}
