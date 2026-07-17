# 60갑자 지신 스티커 에셋

`GapjaSticker` 컴포넌트가 여기의 PNG를 읽는다. **파일명 계약**(고정):

```
{animal}-{element}.png      →  12 동물 × 5 오행 = 60장
```

- animal: `rat ox tiger rabbit dragon snake horse goat monkey rooster dog pig` (자축인묘진사오미신유술해)
- element: `wood fire earth metal water` (목화토화금수 — 천간 오행 = 색)

예) `rat-fire.png` = 병자·무자·… 계열(화 기운 쥐, 빨강 계열).

## 규칙
- **동물 = 지지, 색 = 천간의 오행.** 같은 오행에 각 동물이 정확히 1번 → 60장.
- 색은 앱 정본 팔레트(theme.ts `tokens.ohaeng`)에 맞춘다: 목 `#8FBBA1` · 화 `#E98D8D` · 토 `#F1CE8C` · 금 `#DBDCE0` · 수 `#8FB0CC`.
- 배경 투명 PNG 권장(원형 프레임 안에 `object-fit: contain`).

## 생성
`/playground/gapja-generator.html`(라이브)에서 60칸 각각의 나노바나나2 프롬프트를 복사 → 생성 → 위 파일명으로 저장.
이미지가 없으면 컴포넌트가 **오행색 원 + 이모지**로 폴백하므로 부분만 채워도 앱은 정상 동작한다.
