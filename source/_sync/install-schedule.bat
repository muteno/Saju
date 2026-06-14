@echo off
rem ============================================================
rem  install-schedule.bat  —  더블클릭하면 "2시간마다 자동 실행"을 등록
rem  (작업 스케줄러를 손으로 안 만져도 됨)
rem  해제하려면: uninstall-schedule.bat 더블클릭
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"
set "PS=%~dp0sync-teams-chat.ps1"

echo 2시간마다 자동 실행을 등록합니다...
echo.

schtasks /Create /TN "yeul-chat-sync" /SC HOURLY /MO 2 /F ^
 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"%PS%\""

echo.
if %errorlevel%==0 (
  echo [성공] 작업 이름 "yeul-chat-sync" 로 2시간마다 자동 실행됩니다.
) else (
  echo [실패] 권한 문제일 수 있습니다. 이 파일을 마우스 오른쪽 클릭 -^> "관리자 권한으로 실행" 해보세요.
)
echo.
pause
