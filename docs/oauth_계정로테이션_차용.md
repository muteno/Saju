# OAuth 계정 로테이션(막힌 키 돌려쓰기) — 노뮤트에디터 차용 (260726)

> 운영자 지시: "특정 키가 막혔을 때 돌려서 쓰게 하는 방식을 nomute-editor에서 그대로 차용."
> 정본 = **nomute-editor** `shared/claude_transient.sh`·`shared/claude_py.py`·`shared/account_failover.py`
> \+ `docs/oauth_승격_타레포_이식팩.md`. 이 문서는 그 이식팩의 **사주(6계정) 완성형**이다 —
> 로직 파일은 축자 사본(갱신 = 정본 diff 후 재복사), 레포 고유값(체인·매핑)만 여기서 관리한다.

## 0. 구조 한 장

```
런타임 폴오버(런 안에서)                     sticky 승격(런을 넘어서)
─────────────────────────                  ─────────────────────────
claude -p 호출                              job 끝 승격 스텝(always)
  └ is_quota? ──예──▶ claude_failover()      └ 신호 파일 있으면 ACTIVE_QUOTA_HITS +1
      · ALT → ALT2 → ALT3 차례 전환             └ 2회 누적 → vars.ACTIVE_ACCOUNT 를
      · 첫 전환 때 신호 파일 기록                     체인 다음 계정으로 전진(순환)
  └ is_transient?(5xx) ─▶ 잠깐 쉬고 재시도    → 다음 런부터 산 계정에서 시작
```

- **한 런** = 활성 + 서브3 = 최대 4계정 시도. **여러 런** = 승격이 체인 6계정을 순환.
- 막혔던 계정은 한도가 풀리면 순환이 자연 복귀시킨다(원복 로직 없음).

## 1. 계정 체인 (이 레포 Actions 시크릿 실측 260726)

```
MUTENO → NOMUTEFB → EMS1130G → MUTENONA → EMS1130M → EMS1130N → (처음으로)
```

- 시크릿 이름 규약 = `CLAUDE_CODE_OAUTH_TOKEN_<계정명>` (6개 등록 확인).
- 체인 SSOT = `shared/account_failover.py`의 `CHAIN`. **체인을 바꾸면 아래 §3 env 매핑도 같이** 바꿔야 정합.

## 2. 운영자가 GitHub UI에서 할 일 (승격 층 켜기 — 안 하면 승격만 no-op, 폴오버는 즉시 동작)

1. Fine-grained PAT 발급: Repository access = **muteno/Saju**만 · Permissions → **Variables: Read and write**
   (⚠ Actions·Secrets 아님 — 이 항목 하나가 핵심. 이식팩 §1-1 실수 사례 참조).
2. 이 레포 Settings → Secrets and variables → Actions → **Secrets** 탭 → `GH_VARS_TOKEN` = 그 PAT.
3. 검증: Actions 탭 → **account-selftest** → Run workflow → 로그에 「🎉 PAT 실측 통과」.

## 3. Claude 호출 워크플로에 붙일 완성형 블록 (복사용)

### 3-a. env 매핑 — 활성 계정 + 서브 3계정(체인 다음 3개)

```yaml
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets[format('CLAUDE_CODE_OAUTH_TOKEN_{0}', inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO')] }}
          # 서브1 = 체인에서 활성 다음 계정 (MUTENO→NOMUTEFB→EMS1130G→MUTENONA→EMS1130M→EMS1130N 순환)
          CLAUDE_CODE_OAUTH_TOKEN_ALT: >-
            ${{ (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENO'   && secrets.CLAUDE_CODE_OAUTH_TOKEN_NOMUTEFB
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'NOMUTEFB' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130G
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130G' && secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENONA
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENONA' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130M
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130M' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130N
             || secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENO }}
          # 서브2 = 체인 두 칸 뒤
          CLAUDE_CODE_OAUTH_TOKEN_ALT2: >-
            ${{ (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENO'   && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130G
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'NOMUTEFB' && secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENONA
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130G' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130M
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENONA' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130N
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130M' && secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENO
             || secrets.CLAUDE_CODE_OAUTH_TOKEN_NOMUTEFB }}
          # 서브3 = 체인 세 칸 뒤
          CLAUDE_CODE_OAUTH_TOKEN_ALT3: >-
            ${{ (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENO'   && secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENONA
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'NOMUTEFB' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130M
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130G' && secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130N
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'MUTENONA' && secrets.CLAUDE_CODE_OAUTH_TOKEN_MUTENO
             || (inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO') == 'EMS1130M' && secrets.CLAUDE_CODE_OAUTH_TOKEN_NOMUTEFB
             || secrets.CLAUDE_CODE_OAUTH_TOKEN_EMS1130G }}
          ACTIVE_ACCOUNT: ${{ inputs.account || vars.ACTIVE_ACCOUNT || 'MUTENO' }}
```

- `inputs.account` = workflow_dispatch 수동 오버라이드(없는 워크플로면 그 조각은 자연 무시).
- 호출 직전 `unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN` (OAuth와 API키 동시 설정 충돌 방지 — 정본 관례).
- ⚠ 시크릿이 비어 있으면 그 분기는 `||`로 다음 후보로 흘러간다(빠진 계정 = 건너뜀).

### 3-b. bash에서 쓰기 (셸 스크립트 파이프라인)

```bash
source shared/claude_transient.sh
# (선택) 장시간 본선 전 산 계정 선점: claude_preflight <본선과 동일 모델>
out="$(printf '%s' "$PROMPT" | timeout 600 claude -p --model claude-sonnet-5 2>&1)" || true
while :; do
  if claude_failover "$out"; then           # 쿼터( is_quota )면 다음 계정으로 전환 → 재시도
    out="$(printf '%s' "$PROMPT" | timeout 600 claude -p --model claude-sonnet-5 2>&1)" || true; continue
  fi
  if is_transient "$out"; then sleep 20     # 5xx 과부하 = 같은 계정 재시도
    out="$(printf '%s' "$PROMPT" | timeout 600 claude -p --model claude-sonnet-5 2>&1)" || true; continue
  fi
  break
done
```

### 3-c. 파이썬에서 쓰기

```python
import sys; sys.path.insert(0, "shared")
from claude_py import run_claude
p, rc, err = run_claude(["claude", "-p", "--model", "claude-sonnet-5"], prompt, timeout=600)
# 쿼터 시 ALT→ALT2→ALT3 자동 전환 + 첫 전환 때 승격 신호까지 — 호출부 추가 코드 0
```

### 3-d. job 끝 승격 스텝 (Claude를 부르는 워크플로마다 마지막에)

```yaml
      # 활성 계정이 이번 런에 쿼터로 폴오버됐으면 누적 카운트 → 2회+ 면 다음 계정으로 자동 전진.
      # GH_VARS_TOKEN 없으면 no-op = 라이브 무해.
      - name: 활성 계정 자동 승격(쿼터 누적 시)
        if: ${{ always() && !inputs.account }}
        env:
          GH_VARS_TOKEN: ${{ secrets.GH_VARS_TOKEN }}
          ACTIVE_ACCOUNT: ${{ vars.ACTIVE_ACCOUNT || 'MUTENO' }}
        run: python3 shared/account_failover.py
```

## 3-e. 상담 LLM(Cloudflare Pages Function)에서 쓰기 — Q.43 배선 완료

`functions/api/dosa.ts`가 같은 체인을 **서버 런타임 로테이션**으로 쓴다(연리 상담 응답):
- 자격 사다리 = OAuth 6계정(CHAIN 순서·등록된 것만) → 레거시 `ANTHROPIC_API_KEY` → 전부 없으면 L3 폴백.
- 호출 = `Authorization: Bearer` + `anthropic-beta: oauth-2025-04-20`(구독 OAuth 정식 문법) ·
  한도/401/403/429/5xx = 다음 계정 전환(`is_quota` 정규식 서버판).
- 모델 = 화이트리스트 2종(`sonnet`=claude-sonnet-5 effort low · `opus-fast`=claude-opus-5 +
  `speed:"fast"` + 베타 `fast-mode-2026-02-01`) — 선택은 앱 설정(`data/prefs.ts`).
- **운영자 액션**: CF Pages(saju02) → Settings → Environment variables에
  `CLAUDE_CODE_OAUTH_TOKEN_<계정명>` 6개를 등록(Actions 시크릿과 같은 값). 등록 즉시 가동.

## 4. 현황 (260726)

- 이 레포엔 아직 Claude를 부르는 워크플로가 없다 — 이 이식은 **레일 선설치**다. 배치 트레이닝(/feed 파도)
  등 Claude 호출 워크플로를 만들 때 §3 블록 4개를 그대로 붙이면 로테이션이 처음부터 작동한다.
- `GH_VARS_TOKEN` 미등록 상태 = 승격 층만 잠듦(런타임 폴오버·전 계정 시도는 시크릿만으로 동작).

## 5. 롤백

- 승격 완전 정지 = `GH_VARS_TOKEN` 시크릿 삭제(즉시 no-op).
- 코드 제거 = `shared/claude_transient.sh`·`claude_py.py`·`account_failover.py` + selftest 워크플로 + `.gitignore` 1줄.
