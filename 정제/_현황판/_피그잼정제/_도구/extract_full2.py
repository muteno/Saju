# -*- coding: utf-8 -*-
"""figjam_board_raw.txt → 완전판 md (shape-with-text 661개 포함).
원본 extract_board.py 는 shape-with-text 를 통째로 버렸다. 여기서는 전부 담는다.
출력은 스크래치패드에만 쓴다(원본 무수정).
"""
import xml.etree.ElementTree as ET
import os, re, sys

SRC = r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\4. 구 사주본_Saju-main\dosa-app\methodology\figjam_board_raw.txt"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'board_full2.md')

SKIP_NAME = re.compile(r'^(image \d+|Group \d+|Section \d+|Frame \d+|Vector.*|Rectangle \d+|Ellipse \d+|SQUARE|ROUNDED_RECTANGLE|ELLIPSE|DIAMOND|TRIANGLE_UP|PARALLELOGRAM_RIGHT|ENG_DATABASE|SHIELD)?$')

def fnum(el, attr):
    try: return float(el.get(attr, '0'))
    except ValueError: return 0.0

def emit_table(el, out):
    cells = {}; maxr = maxc = 0
    for c in el.iter('table-cell'):
        r, cc = int(c.get('tableCellRowIndex', 0)), int(c.get('tableCellColumnIndex', 0))
        txt = (c.text or '').strip().replace('\n', ' ').replace('|', '\\|')
        cells[(r, cc)] = txt
        maxr, maxc = max(maxr, r), max(maxc, cc)
    if not cells: return
    for r in range(maxr + 1):
        row = [cells.get((r, c), '') for c in range(maxc + 1)]
        out.append('| ' + ' | '.join(row) + ' |')
        if r == 0: out.append('|' + '---|' * (maxc + 1))
    out.append('')

def walk(el, out, depth):
    kids = sorted(list(el), key=lambda e: (fnum(e, 'y'), fnum(e, 'x')))
    for k in kids:
        tag = k.tag
        name = (k.get('name') or '').strip()
        body = (k.text or '').strip()
        if tag == 'section':
            out.append(''); out.append('#' * min(depth + 1, 6) + ' ' + (name or '(무제 섹션)')); out.append('')
            walk(k, out, depth + 1)
        elif tag == 'table':
            emit_table(k, out)
        elif tag == 'shape-with-text':
            # 내용은 element text 에 있다. name 은 도형 종류(SQUARE 등).
            if body:
                one = body.replace('\n', ' / ')
                out.append('- [S] ' + one); out.append('')
            elif name and not SKIP_NAME.match(name):
                out.append('- [S] ' + name); out.append('')
            walk(k, out, depth)
        elif tag in ('text', 'shape', 'sticky', 'rounded-rectangle', 'widget'):
            if name and not SKIP_NAME.match(name):
                out.append(('- ' if len(name) <= 60 else '') + name); out.append('')
            if body:
                out.append('- [T] ' + body.replace('\n', ' / ')); out.append('')
            walk(k, out, depth)
        elif tag == 'connector':
            if name: out.append(f'- ↔ {name}'); out.append('')
        else:
            walk(k, out, depth)

root = ET.parse(SRC).getroot()
out = ['# FigJam 방법론 보드 — 완전 추출본 v2 (shape-with-text 포함)', '']
walk(root, out, 1)
text = re.sub(r'\n{3,}', '\n\n', '\n'.join(out))
open(OUT, 'w', encoding='utf-8').write(text)
print(f'{len(text):,}자 / {text.count(chr(10))+1:,}줄 → {OUT}')
