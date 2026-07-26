/**
 * 셰프단 캐릭터 레지스트리(골격) — 연식당 상담 캐릭터 = 수셰프·셰프들 멀티 페르소나
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

/**
 * 두 상담 도사의 이름은 **아직 없다**(운영자 미확정). 화자 이름표를 비울 수는 없어서
 * 미연시 관례대로 `???`로 뜬다 — 이름이 정해지면 각 항목의 `name`만 갈아 끼운다
 * (§B4 신규 요소 · 확인 대상).
 */
const UNNAMED = '???'

export const CHEFS: readonly Chef[] = [
  /**
   * 260726 캐릭터 4인 확정(운영자 첨부 레퍼런스 7컷 실측 · `app/public/reports/chef-refs/`).
   * 배정 = 상담 상대의 성별. 여성 도사 2인은 결이 다르다 — noona는 "좀 뱀파이어 느낌",
   * baekui는 "정통 일본식"(운영자 구술). 플레이트는 아직 0장이라 화면은 폴백으로 뜨고,
   * `chef-<id>.jpg`가 들어오면 코드 변경 없이 그림으로 바뀐다.
   */
  {
    id: 'noona',
    name: UNNAMED,
    concept: '은백발 · 서늘한 뱀파이어 결의 여성 도사 — 남성 사용자 상담. 먼저 찌르고 본다',
    plate: '/assets/chef-noona.jpg',
  },
  {
    id: 'baekui',
    name: UNNAMED,
    concept: '흰 도복 · 정통 일본식 결의 여성 도사 — 단정하고 기품 있다. 말수가 적고 정확하다',
    plate: '/assets/chef-baekui.jpg',
  },
  {
    id: 'doryeong',
    name: UNNAMED,
    concept: '갓 쓴 흑발 도령 — 여성 사용자 상담. 능청스럽게 웃으며 파고든다',
    plate: '/assets/chef-doryeong.jpg',
  },
  {
    id: 'dongja',
    name: UNNAMED,
    concept: '음양 반반(흑백) 동자승 — 어리지만 말은 어른보다 정확하다. 흑백 어느 쪽도 편들지 않는다',
    plate: '/assets/chef-dongja.jpg',
  },
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
 * 연식당 주인장 도사 이름 — 화자 이름표의 단일 출처.
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

/**
 * 상담 상대의 성별 → 무대에 서는 도사(운영자 260726: "남자를 상대할땐 이 캐릭터 / 여자를 상대할땐 이 캐릭터").
 * 성별 값은 사주 입력의 `gender`(대운 순역 계산에 쓰는 그 값)를 그대로 읽는다.
 */
export const chefForGender = (g?: 'M' | 'F'): Chef => CHEFS.find((c) => c.id === (g === 'M' ? 'noona' : 'doryeong'))!

/** 맞은편 도사 — 빗맞혔을 때 밀고 들어오는 쪽(교체 연출) */
export const counterpartChef = (id: string): Chef => CHEFS.find((c) => c.id === (id === 'noona' ? 'doryeong' : 'noona'))!

/**
 * 교체 난입 대사 — 운영자 구술 정본:
 * "다른 애가 자연스럽게 촤르륵하면서 사진 보이면서 끼어들면서 '거 보쇼 쉬고 계시오 내가 하려니까'"
 * (여→남 교체의 경우). 반대 방향은 같은 뜻을 언니 말투로 뒤집었다.
 */
export const BARGE_LINE: Record<string, string> = {
  // 도령이 밀고 들어옴(언니가 빗맞힌 뒤)
  doryeong: '거 보쇼. 쉬고 계시오, 내가 하려니까.',
  // 언니가 밀고 들어옴(도령이 빗맞힌 뒤)
  noona: '됐고. 비켜 봐, 내가 볼게.',
}
