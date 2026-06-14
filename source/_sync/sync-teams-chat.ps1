<#
  sync-teams-chat.ps1
  ────────────────────────────────────────────────────────────
  팀즈 1:1/그룹 대화를 가져와 ../chats/ 에 저장하고 깃에 올린다.

  · 로그인: "내가 직접 한 번 로그인" 방식(device code). 처음 한 번만 브라우저로
    코드 입력 → 그다음부턴 저장된 토큰으로 자동.
  · 가져오기: 지난번 이후 '바뀐 부분만'(델타) 가져와 중복 없이 쌓는다.
  · 저장: 원본은 JSON 으로, 사람이 읽을 건 월별 마크다운으로.

  ⚠ 처음 쓰는 사람에게: 먼저 같은 폴더의 SETUP.md 를 따라 설정부터 끝내세요.
  ⚠ 이 스크립트는 실제 테넌트에서 한 번 테스트한 뒤 사용하세요.
#>

[CmdletBinding()]
param(
  [string]$ConfigPath = "$PSScriptRoot/config.json"
)

$ErrorActionPreference = 'Stop'
$Graph = 'https://graph.microsoft.com/v1.0'

# ── 0. 설정 읽기 ────────────────────────────────────────────
if (-not (Test-Path $ConfigPath)) {
  throw "설정 파일이 없습니다: $ConfigPath  (config.example.json 을 복사해 config.json 으로 만드세요)"
}
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
foreach ($k in 'tenantId','clientId') {
  if (-not $cfg.$k) { throw "config.json 에 '$k' 값이 비어 있습니다." }
}

$tokenCache = "$PSScriptRoot/token-cache.json"
$statePath  = "$PSScriptRoot/sync-state.json"
$chatsDir   = Resolve-Path "$PSScriptRoot/../chats"

# ── 1. 로그인(토큰 얻기) ────────────────────────────────────
# 저장된 갱신토큰이 있으면 조용히 새 토큰을 받고, 없으면 처음 한 번만 로그인.
function Get-AccessToken {
  $tokenUrl = "https://login.microsoftonline.com/$($cfg.tenantId)/oauth2/v2.0/token"
  $scope    = 'offline_access Chat.Read'

  if (Test-Path $tokenCache) {
    $cached = Get-Content $tokenCache -Raw | ConvertFrom-Json
    try {
      $r = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body @{
        client_id     = $cfg.clientId
        grant_type    = 'refresh_token'
        refresh_token = $cached.refresh_token
        scope         = $scope
      }
      @{ refresh_token = $r.refresh_token } | ConvertTo-Json | Set-Content $tokenCache
      return $r.access_token
    } catch {
      Write-Warning "저장된 로그인이 만료된 것 같아 다시 로그인합니다."
    }
  }

  # 처음 로그인 — 화면에 뜨는 주소로 가서 코드를 입력하면 된다.
  $dc = Invoke-RestMethod -Method Post `
    -Uri "https://login.microsoftonline.com/$($cfg.tenantId)/oauth2/v2.0/devicecode" `
    -Body @{ client_id = $cfg.clientId; scope = $scope }

  Write-Host ""
  Write-Host "  ┌─ 처음 한 번만 로그인이 필요합니다 ─────────────" -ForegroundColor Cyan
  Write-Host "  │ 1) 브라우저에서 열기:  $($dc.verification_uri)"
  Write-Host "  │ 2) 이 코드 입력:       $($dc.user_code)" -ForegroundColor Yellow
  Write-Host "  └────────────────────────────────────────────────" -ForegroundColor Cyan
  Write-Host ""

  $deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds ([int]$dc.interval)
    try {
      $r = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body @{
        client_id   = $cfg.clientId
        grant_type  = 'urn:ietf:params:oauth:grant-type:device_code'
        device_code = $dc.device_code
      }
      @{ refresh_token = $r.refresh_token } | ConvertTo-Json | Set-Content $tokenCache
      Write-Host "로그인 완료 ✓" -ForegroundColor Green
      return $r.access_token
    } catch {
      $err = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).error
      if ($err -ne 'authorization_pending') { throw }   # 아직 입력 안 함 → 계속 기다림
    }
  }
  throw "로그인 시간이 초과됐습니다. 다시 실행해 주세요."
}

$token   = Get-AccessToken
$headers = @{ Authorization = "Bearer $token" }

# ── 2. 어떤 대화를 가져올지 정하기 ──────────────────────────
$chatId = $cfg.chatId
if (-not $chatId) {
  Write-Host "config 에 chatId 가 없어 내 대화 목록을 보여줍니다:" -ForegroundColor Cyan
  $list = Invoke-RestMethod -Headers $headers -Uri "$Graph/me/chats?`$expand=members&`$top=30"
  $i = 0
  foreach ($c in $list.value) {
    $who = ($c.members | ForEach-Object { $_.displayName }) -join ', '
    Write-Host ("  [{0}] {1}  ({2})" -f $i++, $who, $c.id)
  }
  throw "위 목록에서 원하는 대화의 chat ID 를 config.json 의 chatId 에 넣고 다시 실행하세요."
}

# ── 3. 메시지 가져오기(델타: 지난번 이후 바뀐 것만) ─────────
$state = if (Test-Path $statePath) { Get-Content $statePath -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
$deltaLink = $state.$chatId

$next = if ($deltaLink) { $deltaLink } else { "$Graph/chats/$chatId/messages/delta" }
$fetched = @()
while ($next) {
  $page = Invoke-RestMethod -Headers $headers -Uri $next
  if ($page.value) { $fetched += $page.value }
  if     ($page.'@odata.nextLink')  { $next = $page.'@odata.nextLink' }
  elseif ($page.'@odata.deltaLink') { $next = $null; $newDelta = $page.'@odata.deltaLink' }
  else   { $next = $null }
}
Write-Host ("가져온 메시지: {0}건" -f $fetched.Count)

# ── 4. 원본 JSON 에 합치기(ID 기준 → 중복/수정 자동 정리) ────
$ledgerPath = Join-Path $chatsDir "$chatId.json"
$ledger = @{}
if (Test-Path $ledgerPath) {
  (Get-Content $ledgerPath -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $ledger[$_.Name] = $_.Value }
}
foreach ($m in $fetched) { if ($m.id) { $ledger[$m.id] = $m } }

if ($fetched.Count -gt 0) {
  $ledger | ConvertTo-Json -Depth 20 | Set-Content $ledgerPath -Encoding UTF8
}

# ── 5. 사람이 읽을 월별 마크다운으로 정리 ───────────────────
function Strip-Html([string]$s) {
  if (-not $s) { return '' }
  ($s -replace '<br\s*/?>', "`n" -replace '<[^>]+>', '').Trim()
}
$byMonth = @{}
foreach ($m in $ledger.Values) {
  if (-not $m.createdDateTime) { continue }
  $dt    = [datetime]$m.createdDateTime
  $month = $dt.ToString('yyyy-MM')
  $who   = if ($m.from.user.displayName) { $m.from.user.displayName } else { '(시스템)' }
  $text  = Strip-Html $m.body.content
  if (-not $text) { continue }
  if (-not $byMonth.ContainsKey($month)) { $byMonth[$month] = @() }
  $byMonth[$month] += [pscustomobject]@{ At = $dt; Who = $who; Text = $text }
}
foreach ($month in $byMonth.Keys) {
  $lines = @("# 대화 기록 — $month", "")
  foreach ($row in ($byMonth[$month] | Sort-Object At)) {
    $lines += "**[{0:HH:mm} · {1}]** {2}" -f $row.At, $row.Who, ($row.Text -replace "`n", "  `n")
    $lines += ""
  }
  $out = Join-Path $chatsDir "$chatId-$month.md"
  $lines -join "`n" | Set-Content $out -Encoding UTF8
}

# ── 6. 진행 상태 저장(다음엔 바뀐 것만 받게) ────────────────
if ($newDelta) {
  $state | Add-Member -NotePropertyName $chatId -NotePropertyValue $newDelta -Force
  $state | ConvertTo-Json | Set-Content $statePath -Encoding UTF8
}

# ── 7. 깃에 올리기 ──────────────────────────────────────────
if ($cfg.autoCommit -and $fetched.Count -gt 0) {
  Push-Location $chatsDir
  try {
    git add .
    git commit -m ("chore(source): 팀즈 대화 동기화 — {0}건 ({1:yyyy-MM-dd HH:mm})" -f $fetched.Count, (Get-Date)) | Out-Null
    if ($cfg.autoPush) { git push origin $cfg.branch }
    Write-Host "깃에 올렸습니다 ✓" -ForegroundColor Green
  } finally { Pop-Location }
} else {
  Write-Host "새로 올릴 내용이 없습니다."
}
