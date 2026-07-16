# -*- coding: utf-8 -*-
"""<board>.json → '<board_name> 글모음.docx'
tistory-tools/build_docx.py 의 문단 빌더를 재사용해 기존 글모음과 동일 서식 생성.
사용법: python build_docx.py <board>.json"""
import zipfile, json, re, sys, os

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.dirname(HERE)
TEMPLATE = os.path.join(OUTDIR, '자평명리학 게시판 글모음.docx')
sys.path.insert(0, os.path.join(OUTDIR, 'tistory-tools'))
import build_docx as B   # p_title, p_subtitle, p_srcline, p_note, p_h2, p_h1, p_toc_item, p_meta, KIND_MAP ...

def build(data, out_path):
    posts = sorted(data['posts'], key=lambda p: (p['date'] or '9999', p['idx']))
    n = len(posts)
    dates = [p['date'] for p in posts if p['date']]
    span = f' ({min(dates)} ~ {max(dates)})' if dates else ''
    parts = [
        B.p_title(data['board_name']),
        B.p_subtitle(f'게시판 글 모음 · 총 {n}개 글{span}'),
        B.p_srcline(f"출처: {data['site']} ({data['host']}) — {data['board_name']}", 60),
        B.p_srcline(f"저장일: {data['saved']}", 500),
        B.p_note('※ 게시판 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'),
        B.p_h2('수록 글 목록', pagebreak=True),
    ]
    for p in posts:
        parts.append(B.p_toc_item(p['title'] or f"(제목 없음 idx={p['idx']})", p['date'] or '-'))
    for p in posts:
        parts.append(B.p_h1(p['title'] or f"(제목 없음 idx={p['idx']})"))
        parts.append(B.p_meta(f"작성일 {p['date'] or '-'} · 원문 {p['url'].replace('https://', '')}"))
        for kind, text in p['blocks']:
            parts.append(B.KIND_MAP.get(kind, B.p_body)(text))

    tpl = zipfile.ZipFile(TEMPLATE)
    doc = tpl.read('word/document.xml').decode('utf-8')
    prefix = doc[:doc.index('<w:body>') + len('<w:body>')]
    sect = doc[doc.rindex('<w:sectPr'):doc.rindex('</w:body>')]
    new_doc = prefix + ''.join(parts) + sect + '</w:body></w:document>'
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for item in tpl.infolist():
            if item.filename == 'word/document.xml':
                z.writestr('word/document.xml', new_doc.encode('utf-8'))
            elif item.filename.endswith('/'):
                z.writestr(item, b'')
            else:
                z.writestr(item, tpl.read(item.filename))
    tpl.close()

    import xml.dom.minidom as minidom
    xml = zipfile.ZipFile(out_path).read('word/document.xml').decode('utf-8')
    minidom.parseString(xml)
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', xml))
    assert h1 == n, f'{out_path}: Heading1 {h1} != posts {n}'
    return n

def main():
    jp = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'monthlylucky.json')
    if not os.path.isabs(jp):
        jp = os.path.join(HERE, jp)
    data = json.load(open(jp, encoding='utf-8'))
    out = os.path.join(OUTDIR, f"{data['board_name']} 글모음.docx")
    n = build(data, out)
    dates = [p['date'] for p in data['posts'] if p['date']]
    print(f'[build] OK {os.path.basename(out)}: {n}글'
          f"{f' ({min(dates)}~{max(dates)})' if dates else ''}, {os.path.getsize(out):,} bytes")
    if data.get('failed'):
        print('[build] WARNING failed:', data['failed'])

if __name__ == '__main__':
    main()
