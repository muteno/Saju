# -*- coding: utf-8 -*-
"""posts.json → 카테고리(게시판)별 '초코서당-<카테고리> 글모음.docx' 일괄 생성.
tistory-tools와 동일하게 기존 '자평명리학 게시판 글모음.docx'를 zip 템플릿으로 재사용해
word/document.xml만 새로 쓴다 (서식이 기존 글모음 파일들과 일치)."""
import zipfile, json, re, sys, os

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.dirname(HERE)                     # ...\새 폴더
TEMPLATE = os.path.join(OUTDIR, '자평명리학 게시판 글모음.docx')

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

def build(data, cat_name, posts, out_path):
    posts = sorted(posts, key=lambda p: (p['date'], p['id']))
    n = len(posts)
    if n == 0:
        return None
    first, last = posts[0]['date'], posts[-1]['date']
    parts = [p_title(cat_name),
             p_subtitle(f'게시판 글 모음 · 총 {n}개 글 ({first} ~ {last})'),
             p_srcline(f"출처: {data['site']} ({data['host']}) — {cat_name} 게시판", 60),
             p_srcline(f"저장일: {data['saved']}", 500),
             p_note('※ 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'),
             p_h2('수록 글 목록', pagebreak=True)]
    for p in posts:
        parts.append(p_toc_item(p['title'], p['date']))
    for p in posts:
        parts.append(p_h1(p['title']))
        parts.append(p_meta(f"작성일 {p['date']} · 원문 {p['url'].replace('https://', '')}"))
        for kind, text in p['blocks']:
            parts.append(KIND_MAP.get(kind, p_body)(text))

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

    # 검증: XML 정합성 + Heading1 수 == 글 수
    import xml.dom.minidom as minidom
    z = zipfile.ZipFile(out_path)
    xml = z.read('word/document.xml').decode('utf-8')
    minidom.parseString(xml)
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', xml))
    assert h1 == n, f'{out_path}: Heading1 {h1} != posts {n}'
    return n

def safe_name(name):
    return re.sub(r'[\\/:*?"<>|]', '·', name)

def main():
    data = json.load(open(os.path.join(HERE, 'posts.json'), encoding='utf-8'))
    posts = data['posts']
    total_written = 0
    made = []
    for c in data['categories']:
        cat_posts = [p for p in posts if c['name'] in p['categories']]
        if not cat_posts:
            print(f'[skip] {c["name"]}: 글 없음', flush=True)
            continue
        out = os.path.join(OUTDIR, f'초코서당-{safe_name(c["name"])} 글모음.docx')
        n = build(data, c['name'], cat_posts, out)
        total_written += n
        made.append(os.path.basename(out))
        print(f'[cat done] {c["name"]}: {n}개 (선언 count {c["count"]}) → {os.path.basename(out)}'
              f' ({os.path.getsize(out):,} bytes)', flush=True)
        if n != c['count']:
            print(f'  [WARN] 수집 글 수 {n} != 카테고리 count {c["count"]}', flush=True)
    print(f'[ALLDONE] 문서 {len(made)}개, 글 할당 {total_written}건 (원본 글 {len(posts)}개)', flush=True)

if __name__ == '__main__':
    main()
