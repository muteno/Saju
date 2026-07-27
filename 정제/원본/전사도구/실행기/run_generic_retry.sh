#!/bin/bash
# 범용 채널 작업의 실패 재시도 실행기 — 보드의 [재시도] 버튼이 부른다.
# board_config.json 의 url/folder 를 읽어 generic 엔진을 --only 로 돌린다.
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
PY="$SKILL/.venv/bin/python"
URL=$("$PY" -c "import json;print(json.load(open('$SKILL/board_config.json')).get('url',''))")
OUT=$("$PY" -c "import json;print(json.load(open('$SKILL/board_config.json'))['folder'])")
[ -z "$URL" ] && { echo "config 에 url 없음"; exit 1; }
[ "$1" = "--only" ] || { echo "사용법: run_generic_retry.sh --only <ID,..>"; exit 1; }
exec caffeinate -is "$PY" "$SKILL/whisper_channel_generic.py" "$URL" --out "$OUT" --only "$2"
