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

/** 셰프 전환 스위치 — 캐릭터 교체는 이 한 줄만 바꾼다 */
export const ACTIVE_CHEF_ID = 'default'

export function activeChef(): Chef {
  return CHEFS.find((c) => c.id === ACTIVE_CHEF_ID) ?? CHEFS[0]
}

/** 화면들이 쓰는 현재 플레이트 경로 */
export function chefPlate(): string {
  return activeChef().plate
}
