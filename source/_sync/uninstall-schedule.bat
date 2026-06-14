@echo off
rem ============================================================
rem  uninstall-schedule.bat  —  더블클릭하면 자동 실행 예약을 해제
rem ============================================================
chcp 65001 >nul

echo 자동 실행 예약(yeul-chat-sync)을 해제합니다...
echo.

schtasks /Delete /TN "yeul-chat-sync" /F

echo.
echo 완료. (다시 켜려면 install-schedule.bat 더블클릭)
echo.
pause
