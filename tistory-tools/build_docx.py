# -*- coding: utf-8 -*-
"""posts.json → '현묘의 사주 이야기 글모음.docx'
기존 '자평명리학 게시판 글모음.docx'를 템플릿으로 스타일/넘버링을 그대로 재사용하고
word/document.xml 본문만 새로 생성한다."""
import zipfile, json, re, sys, os

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = r'C:\Users\Hwang\Desktop\새 폴더\자평명리학 게시판 글모음.docx'
OUT = r'C:\Users\Hwang\Desktop\새 폴더\현묘의 사주 이야기 글모음.docx'

_ctrl = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

def esc(t):
    t = _ctrl.sub('', t)
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))

def p_title(t):
    return ('<w:p><w:pPr><w:spacing w:after="200" w:before="2400"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14532D"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_subtitle(t):
    return ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="14532D" w:sz="6" w:space="8"/></w:pBdr>'
            '<w:spacing w:after="600"/></w:pPr>'
            '<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_srcline(t, after):
    return (f'<w:p><w:pPr><w:spacing w:after="{after}"/></w:pPr>'
            '<w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_note(t):
    return ('<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>'
            '<w:r><w:rPr><w:i/><w:iCs/><w:color w:val="888888"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_h2(t, pagebreak=False):
    pb = '<w:pageBreakBefore/>' if pagebreak else ''
    return (f'<w:p><w:pPr><w:pStyle w:val="Heading2"/>{pb}</w:pPr>'
            f'<w:r><w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_h1(t):
    return ('<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:pageBreakBefore/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_toc_item(title, date):
    return ('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="30"/></w:pPr>'
            '<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(title)}</w:t></w:r>'
            '<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
            f'<w:t xml:space="preserve">  ({esc(date)})</w:t></w:r></w:p>')

def p_meta(t):
    return ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="CCCCCC" w:sz="4" w:space="6"/></w:pBdr>'
            '<w:spacing w:after="260"/></w:pPr>'
            '<w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_body(t):
    return (f'<w:p><w:pPr><w:spacing w:after="90"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_quote(t):
    return ('<w:p><w:pPr><w:spacing w:after="90"/><w:ind w:left="360"/></w:pPr>'
            '<w:r><w:rPr><w:i/><w:iCs/><w:color w:val="52525B"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_li(t):
    return ('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="60"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_row(t):
    return ('<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>'
            '<w:r><w:rPr><w:color w:val="444444"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

KIND_MAP = {'p': p_body, 'h': lambda t: p_h2(t), 'q': p_quote,
            'li': p_li, 'row': p_row, 'pre': p_body}

def main():
    data = json.load(open(os.path.join(HERE, 'posts.json'), encoding='utf-8'))
    posts = sorted(data['posts'], key=lambda p: (p['date'], p['id']))
    n = len(posts)
    first, last = posts[0]['date'], posts[-1]['date']

    parts = []
    parts.append(p_title(data['category']))
    parts.append(p_subtitle(f'블로그 글 모음 · 총 {n}개 글 ({first} ~ {last})'))
    parts.append(p_srcline(f"출처: {data['blog']} ({data['host']}) — {data['category']} 카테고리", 60))
    parts.append(p_srcline(f"저장일: {data['saved']}", 500))
    parts.append(p_note('※ 블로그 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'))
    parts.append(p_h2('수록 글 목록', pagebreak=True))
    for p in posts:
        parts.append(p_toc_item(p['title'], p['date']))
    for p in posts:
        parts.append(p_h1(p['title']))
        host_url = p['url'].replace('https://', '')
        parts.append(p_meta(f"작성일 {p['date']} · 원문 {host_url}"))
        for kind, text in p['blocks']:
            parts.append(KIND_MAP.get(kind, p_body)(text))

    tpl = zipfile.ZipFile(TEMPLATE)
    doc = tpl.read('word/document.xml').decode('utf-8')
    prefix = doc[:doc.index('<w:body>') + len('<w:body>')]
    sect = doc[doc.rindex('<w:sectPr'):doc.rindex('</w:body>')]
    new_doc = prefix + ''.join(parts) + sect + '</w:body></w:document>'

    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for item in tpl.infolist():
            if item.filename == 'word/document.xml':
                z.writestr('word/document.xml', new_doc.encode('utf-8'))
            elif item.filename.endswith('/'):
                z.writestr(item, b'')
            else:
                z.writestr(item, tpl.read(item.filename))
    tpl.close()

    # 검증: XML 정합성 + 구조 요약
    import xml.dom.minidom as minidom
    z = zipfile.ZipFile(OUT)
    xml = z.read('word/document.xml').decode('utf-8')
    minidom.parseString(xml)  # raises on malformed XML
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', xml))
    paras = len(re.findall(r'<w:p>', xml))
    total_blocks = sum(len(p['blocks']) for p in posts)
    print(f'[build] OK: {OUT}')
    print(f'[build] posts={n} (heading1={h1}) paragraphs={paras} body_blocks={total_blocks}')
    print(f'[build] range: {first} ~ {last}, size={os.path.getsize(OUT):,} bytes')
    assert h1 == n, 'Heading1 count != post count'
    if data.get('failed'):
        print('[build] WARNING failed posts:', data['failed'])

if __name__ == '__main__':
    main()
