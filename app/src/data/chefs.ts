/**
 * 셰프단 캐릭터 레지스트리(골격) — 명식당 상담 캐릭터 = 수셰프·셰프들 멀티 페르소나
 * (STATUS 결정 로그 「260721 캐릭터 체제」: 셰프마다 컨셉·상담 스타일이 다름).
 *
 * 규약: 플레이트 = `app/public/assets/chef-<id>.jpg` — 셰프당 1파일, 화면 3개소
 * (로그인 배경·홈 원형 스테이지·분석 스테이지) 공용. 셰프 추가 = ①규약 경로에
 * 플레이트 추가 ②CHEFS에 한 줄 등재. 전환 = ACTIVE_CHEF_ID 한 줄
 * (추후 화면별·상담 주제별 배정으로 확장 — 지금은 단일 기본캐).
 */
export interface Chef {
  id: string
  /** 표시 이름 — 기본캐는 역할·이름 미정(운영자 확정 대기, 연리 관계 = Q.16 미확정 축) */
  name: string
  /** 상담 컨셉 한 줄 — 셰프마다 다르게 채운다 */
  concept: string
  /** 캐릭터 플레이트 경로(public) — chef-<id>.jpg 규약 */
  plate: string
  /** 표정 컷(선택) — 정본 원본 갤러리. 대화 연출(DosaChat) 배선 시 사용 */
  cuts?: Record<string, string>
}

export const CHEFS: readonly Chef[] = [
  {
    id: 'default',
    name: '기본캐(이름 미정)',
    concept: 'lineless painterly 남신(수채 제거·운영자 260722 확정) — 역할 미정',
    plate: '/assets/chef-default.jpg', // = v5 cut4_consult 최적화 사본
    cuts: {
      거만: '/reports/dosa-male-v5/cut1_arrogant.png',
      진지: '/reports/dosa-male-v5/cut2_serious.png',
      허당: '/reports/dosa-male-v5/cut3_clumsy.png',
      상담: '/reports/dosa-male-v5/cut4_consult.png',
      윙크: '/reports/dosa-male-v5/cut5_wink.png',
    },
  },
]

/**
 * 명식당 주인장 도사 이름 — 화자 이름표의 단일 출처.
 * 260721 브랜드 확정값(緣理). 드로어("주인 연리")·홈 카피("연리에게 물어볼까요")가 이미 쓰는 이름이라
 * 리포트·대화 화자도 여기에 맞춘다(그 전엔 리포트만 구 이름 '아이샤'로 남아 한 앱에 이름이 2개였다).
 * ⚠ 연리 ↔ 셰프단(기본캐 포함)의 배치·총칭 관계는 Q.16 미확정 — 확정되면 이 상수와 CHEFS의 관계를 정리한다.
 */
export const HOST_NAME = '연리'

/**
 * 셰프 전환 스위치 — 캐릭터 교체는 이 한 줄만 바꾼다.
 * **`null` = 캐릭터 미배정**(운영자 260725: "기존 여자/남자 이미지는 그냥 없애. 아무 의미가 없음.
 * 나중에 캐릭터 입힐 때 적용하도록") → 화면들이 이미지 레이어를 아예 렌더하지 않는다.
 * 레지스트리·플레이트 파일·표정 컷 경로는 그대로 남아 있으니, 캐릭터가 확정되면
 * 이 값을 `'default'`(또는 새 셰프 id)로 바꾸는 것만으로 3개소가 동시에 되살아난다.
 */
export const ACTIVE_CHEF_ID: string | null = null

export function activeChef(): Chef | null {
  if (!ACTIVE_CHEF_ID) return null
  return CHEFS.find((c) => c.id === ACTIVE_CHEF_ID) ?? null
}

/** 화면들이 쓰는 현재 플레이트 경로 — null이면 캐릭터를 그리지 않는다 */
export function chefPlate(): string | null {
  return activeChef()?.plate ?? null
}

/**
 * 캐릭터 아트가 화면에 있나. 레이아웃 분기용 —
 * 캐릭터가 있으면 스테이지가 상주 크롬(햄버거·아바타) 아래로 콘텐츠를 밀어주지만,
 * 없으면 본문이 직접 크롬을 피해야 한다(안 피하면 카드가 버튼에 깔린다).
 */
export function hasChef(): boolean {
  return chefPlate() !== null
}
