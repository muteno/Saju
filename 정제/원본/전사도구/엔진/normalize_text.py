# -*- coding: utf-8 -*-
"""normalize_text.py — 전사 폴더의 모든 .md 를 '어디서나 깨지지 않는 규격'으로 통일

규격: UTF-8 + BOM + CRLF
  - BOM  : 구형 윈도우 메모장·엑셀이 UTF-8 을 CP949 로 오판해 한글이 깨지는 것을 원천 차단
  - CRLF : 가장 오래된 윈도우 앱까지 줄바꿈 인식 (맥·iOS·안드로이드는 어느 쪽이든 잘 읽음)
  - 폴더의 다수(윈도우 생성분 247개)가 이미 CRLF 라 이 규격이 기존과도 일치

안전장치:
  - 전사가 아직 안 끝난 대상(머리말에 Whisper 없는 공개영상)은 건너뜀 — 실행 중인 엔진과 충돌 방지.
    완료 후 한 번 더 돌리면 그 파일들까지 통일된다 (멱등: 몇 번 돌려도 같은 결과).
  - 원자적 쓰기(.enc.tmp → 교체), _versions/_raw 는 손대지 않음(보관 원본).

사용: ~/.claude/skills/whisper/.venv/bin/python ~/.claude/skills/whisper/normalize_text.py
"""
import os, sys

SKILL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SKILL)
_argv = sys.argv; sys.argv = ["x"]
import whisper_saju_mac as W
sys.argv = _argv

BOM = b"\xef\xbb\xbf"


def normalize_bytes(b):
    had_bom = b.startswith(BOM)
    if had_bom:
        b = b[len(BOM):]
    # 줄바꿈 통일: 어떤 혼합이든 → CRLF (멱등)
    b = b.replace(b"\r\n", b"\n").replace(b"\r", b"\n").replace(b"\n", b"\r\n")
    return BOM + b, had_bom


def main():
    state = W.scan_folder()
    pub = set(W.public_targets())
    pending = {v for v in pub if not state.get(v, (None, False))[1]}   # 아직 전사 안 끝난 것

    changed = skipped_pending = already = 0
    for f in sorted(os.listdir(W.FOLDER)):
        if not f.endswith(".md"):
            continue
        p = os.path.join(W.FOLDER, f)
        m = W.ID_RE.search(f)
        if m and m.group(1) in pending:
            skipped_pending += 1
            continue
        raw = open(p, "rb").read()
        new, had_bom = normalize_bytes(raw)
        if new == raw:
            already += 1
            continue
        tmp = p + ".enc.tmp"
        with open(tmp, "wb") as fh:
            fh.write(new)
        os.replace(tmp, p)
        changed += 1
    print("규격 통일(UTF-8+BOM+CRLF): 변환 %d개 · 이미 규격 %d개 · 전사 대기라 건너뜀 %d개"
          % (changed, already, skipped_pending))
    if skipped_pending:
        print("→ 전사가 끝난 뒤 이 스크립트를 한 번 더 실행하면 남은 %d개까지 통일됩니다." % skipped_pending)


if __name__ == "__main__":
    main()
