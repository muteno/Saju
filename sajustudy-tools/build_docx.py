# -*- coding: utf-8 -*-
"""posts.json → 상위 카테고리별 '사주공부-<카테고리> 글모음.docx' (8개)

tistory-tools/build_docx.py 의 문단 빌더(esc, p_* , KIND_MAP)를 재사용하고,
기존 '자평명리학 게시판 글모음.docx'를 zip 템플릿으로 써서 서식을 일치시킨다.
하위 카테고리가 있는 문서는 하위 순서(사이드바 순) → 날짜순으로 배열하고
목차에 하위 카테고리 구분 제목을 넣는다.
"""
import importlib.util, json, os, re, sys, zipfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.dirname(HERE)

def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

B = _load('tt_build', os.path.join(OUTDIR, 'tistory-tools', 'build_docx.py'))

TEMPLATE = os.path.join(OUTDIR, '자평명리학 게시판 글모음.docx')

# 상위 카테고리 순서(사이드바 순)와 하위 순서
TOPS = ['공지', '명리 초급', '명리 중급', '신살론', '추명가 강의', '사주상식', '사공 저서', '사공 역학 서비스']
SUBORDER = {
    '명리 초급': ['사주 입문', '사주 초급 - 십성', '사주 초급 - 형충회합', '사주 초급 - 십이운성', '사주 초급 - 행운'],
    '명리 중급': ['기초 심화', '중급'],
    '추명가 강의': ['남명(001~230)', '여명(231~480)'],
    '사공 저서': ['책 오류 및 교정', '저서 안내'],
}


def p_tocgroup(t):
    return ('<w:p><w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14532D"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{B.esc(t)}</w:t></w:r></w:p>')


def sort_posts(top, posts):
    subs = SUBORDER.get(top, [])
    def key(p):
        sub = p.get('sub')
        si = subs.index(sub) if sub in subs else -1  # 직속 글은 맨 앞
        return (si, p['date'], p['id'] if isinstance(p['id'], int) else 0)
    return sorted(posts, key=key)


def build(data, top, posts, out_path):
    posts = sort_posts(top, posts)
    n = len(posts)
    dates = [p['date'] for p in posts if p['date']]
    first, last = min(dates), max(dates)
    grouped = top in SUBORDER

    parts = [B.p_title(top),
             B.p_subtitle(f'블로그 글 모음 · 총 {n}개 글 ({first} ~ {last})'),
             B.p_srcline(f"출처: {data['blog']} ({data['host']}) — {top} 카테고리", 60),
             B.p_srcline(f"저장일: {data['saved']}", 500),
             B.p_note('※ 블로그 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'),
             B.p_h2('수록 글 목록', pagebreak=True)]
    cur = object()
    for p in posts:
        if grouped and p.get('sub') != cur:
            cur = p.get('sub')
            parts.append(p_tocgroup(cur if cur else f'{top} (직속)'))
        parts.append(B.p_toc_item(p['title'], p['date']))
    for p in posts:
        parts.append(B.p_h1(p['title']))
        path = f"{top} > {p['sub']}" if p.get('sub') else top
        host_url = p['url'].replace('https://', '')
        parts.append(B.p_meta(f"작성일 {p['date']} · 분류 {path} · 원문 {host_url}"))
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
    # 검증: XML 정합성 + Heading1 수 == 글 수
    import xml.dom.minidom as minidom
    z = zipfile.ZipFile(out_path)
    xml = z.read('word/document.xml').decode('utf-8')
    minidom.parseString(xml)
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', xml))
    assert h1 == n, f'{out_path}: Heading1 {h1} != posts {n}'
    return n


def main():
    data = json.load(open(os.path.join(HERE, 'posts.json'), encoding='utf-8'))
    by_top = {}
    for p in data['posts']:
        by_top.setdefault(p['top'], []).append(p)
    total = 0
    for top in TOPS:
        posts = by_top.pop(top, [])
        if not posts:
            print(f'[skip] {top}: 글 없음', flush=True)
            continue
        out = os.path.join(OUTDIR, f'사주공부-{top} 글모음.docx')
        n = build(data, top, posts, out)
        total += n
        print(f'[build] {top}: {n}개 → {os.path.basename(out)} ({os.path.getsize(out):,} bytes)', flush=True)
    assert not by_top, f'TOPS에 없는 상위 카테고리: {list(by_top)}'
    print(f'[ALLDONE] 총 {total}개 글, 문서 생성 완료', flush=True)
    if data.get('failed'):
        print('[WARNING] 실패 글:', data['failed'], flush=True)


if __name__ == '__main__':
    main()
