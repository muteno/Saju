#!/bin/bash
# 전사 진행보드 — 앱 창으로 띄우기
# 보드 서버가 꺼져 있으면 켜고, 주소창 없는 전용 창(Brave --app)으로 연다.
SKILL="$HOME/.claude/skills/whisper"
PY="$SKILL/.venv/bin/python"
PORT=$("$PY" -c "import json;print(json.load(open('$SKILL/board_config.json')).get('port',8765))" 2>/dev/null || echo 8765)
URL="http://localhost:$PORT"

# 1) 서버 기동 (죽어 있으면)
if ! curl -s --max-time 2 "$URL" >/dev/null 2>&1; then
  pkill -f board_server.py 2>/dev/null
  nohup "$PY" "$SKILL/board_server.py" >/dev/null 2>&1 &
  for i in $(seq 1 20); do
    curl -s --max-time 1 "$URL" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# 2) 전용 창으로 열기 (주소창·탭 없는 앱 모드)
BRAVE="/Applications/Brave Origin.app/Contents/MacOS/Brave Origin"
if [ -x "$BRAVE" ]; then
  "$BRAVE" --app="$URL" --window-size=980,1100 --user-data-dir="$HOME/.whisper_board_profile" >/dev/null 2>&1 &
else
  open "$URL"
fi
