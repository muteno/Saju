# -*- coding: utf-8 -*-
"""FigJam 방법론 보드 덤프(figjam_board_raw.txt) → 읽기용 마크다운 (전 텍스트 보존, 요약 없음).

- 섹션 계층 = 헤딩 레벨, 형제 노드는 (y, x) 정렬로 보드 읽기 순서 복원
- text/shape 노드의 name = 실제 내용 → 그대로 수록
- table 은 행/열 인덱스로 마크다운 표 재구성
- connector 라벨은 '↔' 항목으로 수록 (도형 간 연결선 자체는 좌표라 생략)

실행: python extract_board.py  → figjam_board_full.md
"""
import xml.etree.ElementTree as ET
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'figjam_board_raw.txt')
OUT = os.path.join(HERE, 'figjam_board_full.md')

SKIP_NAME = re.compile(r'^(image \d+|Group \d+|Section \d+|Frame \d+|Vector.*|Rectangle \d+|Ellipse \d+)?$')

def fnum(el, attr):
    try:
        return float(el.get(attr, '0'))
    except ValueError:
        return 0.0

def emit_table(el, out, depth):
    cells = {}
    maxr = maxc = 0
    for c in el.iter('table-cell'):
        r, cc = int(c.get('tableCellRowIndex', 0)), int(c.get('tableCellColumnIndex', 0))
        txt = (c.text or '').strip().replace('\n', ' ').replace('|', '\\|')
        cells[(r, cc)] = txt
        maxr, maxc = max(maxr, r), max(maxc, cc)
    if not cells:
        return
    for r in range(maxr + 1):
        row = [cells.get((r, c), '') for c in range(maxc + 1)]
        out.append('| ' + ' | '.join(row) + ' |')
        if r == 0:
            out.append('|' + '---|' * (maxc + 1))
    out.append('')

def walk(el, out, depth):
    kids = sorted(list(el), key=lambda e: (fnum(e, 'y'), fnum(e, 'x')))
    for k in kids:
        tag = k.tag
        name = (k.get('name') or '').strip()
        if tag == 'section':
            out.append('')
            out.append('#' * min(depth + 1, 6) + ' ' + (name or '(무제 섹션)'))
            out.append('')
            walk(k, out, depth + 1)
        elif tag == 'table':
            emit_table(k, out, depth)
        elif tag in ('text', 'shape', 'sticky', 'rounded-rectangle', 'widget'):
            if name and not SKIP_NAME.match(name):
                # 짧은 라벨(제목성)과 긴 본문 구분 없이 전량 보존
                out.append(('- ' if len(name) <= 60 else '') + name)
                out.append('')
            walk(k, out, depth)
        elif tag == 'connector':
            if name:
                out.append(f'- ↔ {name}')
                out.append('')
        else:  # frame, canvas 등 컨테이너
            walk(k, out, depth)

def main():
    root = ET.parse(SRC).getroot()
    out = ['# 사주 해석 방법론 보드 (FigJam 전체 추출)', '',
           '> 원본: figjam_board_raw.txt (Figma board SEEnsqUToHwgVY5QZnYLeU)',
           '> 요약 없음 — 보드의 모든 텍스트·표를 (y,x) 읽기 순서로 보존. 연결선(마인드맵 엣지)은 라벨만 수록.', '']
    walk(root, out, 1)
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    open(OUT, 'w', encoding='utf-8').write(text)
    nchars = len(text)
    print(f'추출 완료: {nchars:,}자 → {os.path.basename(OUT)}')

if __name__ == '__main__':
    main()
