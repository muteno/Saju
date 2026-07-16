# -*- coding: utf-8 -*-
r"""분류 라벨(labels/seg_*.json) + 정제본 76편 → 주제별 책 통합본 1개.
"사주명리 대전 — 주제별 통합본 (정제).docx"
누락 방지: 라벨 커버리지(2,504 전건) assert, 조립 후 H1 총수 대조."""
import zipfile, re, glob, os, sys, json, html
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
REFINED = os.path.join(SRC, '정제본')
TEMPLATE = os.path.join(REFINED, '자평명리학 게시판 글모음.docx')
OUT = os.path.join(SRC, '사주명리 대전 — 주제별 통합본 (정제).docx')
SAVED = '2026-07-13'

CHAPTERS = [
 ('C01', '제1장 명리 입문·기초', '음양오행 · 사주팔자 구조 · 만세력 · 절기'),
 ('C02', '제2장 천간과 지지', '10천간 · 12지지 · 지장간 · 물상'),
 ('C03', '제3장 합충형파해', '간지의 상호작용 — 삼합·방합(계절) · 충 · 형 · 파 · 해'),
 ('C04', '제4장 십신·육친론', '비겁 · 식상 · 재성 · 관성 · 인성'),
 ('C05', '제5장 일주론', '60일주 각론과 일간별 특성'),
 ('C06', '제6장 신살론', '귀인 · 도화 · 역마 · 화개 · 괴강 등'),
 ('C07', '제7장 십이운성', '장생에서 양까지, 왕상휴수'),
 ('C08', '제8장 원국 분석', '신강신약 · 용신 · 격국 · 조후'),
 ('C09', '제9장 운 해석 방법론', '대운·세운·월운 보는 법과 원리'),
 ('C10', '제10장 연운 — 신년운세', '연도별 · 일주별 한 해 운세'),
 ('C11', '제11장 월운·일운', '월간운세와 이달의 운세'),
 ('C12', '제12장 실전 풀이·상담 사례', '실제 사주 풀이 · 상담 사례'),
 ('C13', '제13장 명리 칼럼·에세이', '사주와 과학 · 역사 · 생활 속 명리'),
 ('C14', '제14장 고전 강독', '자평류 고전 · 추명가 · 위천리'),
 ('C17', '제15장 재미로 읽는 사주', '유명인 사주 · 로또 · 영화/TV · 신변잡기'),
 ('C15', '제16장 기타 역학', '풍수 · 타로 · 관상 · 수상 · 구성학 · 매화역수 · 당사주 · 토정비결 · 성명학 · 택일'),
 ('C16', '제17장 부록 — 이용 안내', '사용설명서 · 수강/서비스 안내 · 공지 · 후원'),
]
CH_TITLE = {c: (t, s) for c, t, s in CHAPTERS}
# 레벨링(2차) 대상 장 — 연운/월운/기타역학/부록/재미는 규칙 정렬
LEVELED = {'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C12', 'C13', 'C14'}
LEVEL_NAME = {1: '입문', 2: '초급', 3: '중급', 4: '심화'}

# 장 내부 정렬용 문서 우선순위 (커리큘럼 순 = merge.py PARTS 순서)
DOC_ORDER = [
 '명리학탐구(기초) 전체 글모음 001-086', '명리학탐구(초급) 게시판 글모음', '명리학탐구(중급1) 게시판 글모음',
 '명리학탐구(중급2) 게시판 글모음', '명리학탐구(고급1) 게시판 글모음', '명리학탐구(고급2) 게시판 글모음',
 '명리학입문 게시판 글모음', '자평명리학 게시판 글모음', '사주풀이 게시판 글모음', '유명인사주풀이 게시판 글모음',
 '운세정리게시판 게시판 글모음', '기타자료 게시판 글모음', '기타-유용한자료 게시판 글모음',
 '만세력사용설명서 게시판 글모음', '운세력사용설명서 게시판 글모음', '플러스작명설명서 게시판 글모음',
 '택일기타사용설명 게시판 글모음', 'name-이름게시판 게시판 글모음', 'dang-당사주자료실 게시판 글모음',
 'face-관상학자료실 게시판 글모음', 'gusung-구성학자료실 게시판 글모음', 'hand-수상학강좌 게시판 글모음',
 'hand-용어사전 게시판 글모음', 'hand-지문학 게시판 글모음', 'mehwa-매화역수자료실 게시판 글모음',
 'pungsu-이기풍수 게시판 글모음', 'pungsu-형기풍수 게시판 글모음', 'pungsu-인테리어풍수 게시판 글모음',
 'pungsu-풍수택일 게시판 글모음', 'pungsu-기타자료 게시판 글모음', 'taro-타로카드 게시판 글모음',
 'tojung-토정비결 게시판 게시판 글모음',
 '현묘의 사주 이야기 글모음', '명리교육 글모음', '일주론 글모음', '천간과 지지 글모음', '십신과 합충 글모음',
 '원국 분석 및 용신 글모음', '십이운성 글모음', '신살 글모음', '24절기 글모음', '고전읽기 글모음',
 '2020년 경자년 운세 글모음', '2021년 신축년 운세 글모음', '2022년 임인년 운세 글모음', '2023년 계묘년 운세 글모음',
 '2024년 갑진년 운세 글모음', '2025년 을사년 운세 글모음', '2026년 병오년 운세 글모음', '이달의 운세(일간별) 글모음',
 '파이브시즌스 글모음', '무료상담 글모음', '미혼모 후원 프로젝트 글모음',
 '초코서당-사주명리 입문 글모음', '초코서당-음양, 오행 글모음', '초코서당-천간, 지지 글모음',
 '초코서당-십성, 육친 글모음', '초코서당-합, 충, 형 글모음', '초코서당-신살 글모음', '초코서당-일주론 글모음',
 '초코서당-사주용어사전 글모음', '초코서당-사주이야기 글모음', '초코서당-신년운세 모음 글모음',
 '초코서당-일상이야기 글모음', '초코서당-상담 및 필자 안내 글모음', '초코서당-수강안내 글모음',
 '사주공부-공지 글모음', '사주공부-명리 초급 글모음', '사주공부-명리 중급 글모음', '사주공부-신살론 글모음',
 '사주공부-추명가 강의 글모음', '사주공부-사주상식 글모음', '사주공부-사공 저서 글모음',
 '사주공부-사공 역학 서비스 글모음', '도화로운 월간운세 글모음', '도화로운 사주 칼럼 글모음',
]
DOC_PRI = {d: i for i, d in enumerate(DOC_ORDER)}

PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def txt(p):
    return html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()

def load_labels():
    lab = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'labels', 'seg_*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        items = d['items'] if isinstance(d, dict) else d
        for it in items:
            lab[it['key']] = it['cat']
    # 수동 재판정 결과가 있으면 덮어씀
    ov = os.path.join(HERE, 'labels_overrides.json')
    if os.path.exists(ov):
        for k, v in json.load(open(ov, encoding='utf-8')).items():
            lab[k] = v
    return lab

def extract_posts():
    """key → (doc, seq, title, xml문단리스트)"""
    posts = {}
    for f in sorted(glob.glob(os.path.join(REFINED, '*.docx'))):
        name = os.path.splitext(os.path.basename(f))[0]
        xml = zipfile.ZipFile(f).read('word/document.xml').decode('utf-8')
        paras = PARA_RX.findall(xml)
        h1s = [i for i, p in enumerate(paras) if 'Heading1' in p]
        for n, i in enumerate(h1s):
            j = h1s[n + 1] if n + 1 < len(h1s) else len(paras)
            key = f'{name}#{n:04d}'
            posts[key] = (name, n, txt(paras[i]), paras[i:j])
    return posts

def tag_meta(paras, docname):
    """메타줄(작성일 …)에 ' · 출처: 문서명' 회색 런 추가. 없으면 그대로."""
    out = list(paras)
    if len(out) > 1 and txt(out[1]).startswith('작성일'):
        run = ('<w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
               f'<w:t xml:space="preserve"> · {esc(docname)}</w:t></w:r>')
        out[1] = out[1].replace('</w:p>', run + '</w:p>', 1)
    return out

def p_master_title(t):
    return ('<w:p><w:pPr><w:spacing w:after="200" w:before="2400"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14532D"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_master_sub(t):
    return ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="14532D" w:sz="6" w:space="8"/></w:pBdr>'
            '<w:spacing w:after="600"/></w:pPr>'
            '<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_gray(t, after=60, sz=20):
    return (f'<w:p><w:pPr><w:spacing w:after="{after}"/></w:pPr>'
            f'<w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_note(t):
    return ('<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>'
            '<w:r><w:rPr><w:i/><w:iCs/><w:color w:val="888888"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_toc_head():
    return ('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:pageBreakBefore/></w:pPr>'
            '<w:r><w:t xml:space="preserve">목차</w:t></w:r></w:p>')

def p_toc_row(title, sub, n):
    return ('<w:p><w:pPr><w:spacing w:after="40" w:before="120"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="166534"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(title)}</w:t></w:r>'
            '<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
            f'<w:t xml:space="preserve">  — {esc(sub)} · {n}편</w:t></w:r></w:p>')

def p_chapter_divider(title, sub, n, arc=''):
    out = (('<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:after="200" w:before="3200"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14532D"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(title)}</w:t></w:r></w:p>')
           + ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="14532D" w:sz="6" w:space="8"/></w:pBdr>'
              '<w:spacing w:after="200"/></w:pPr>'
              '<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
              f'<w:t xml:space="preserve">{esc(sub)} · {n}편</w:t></w:r></w:p>'))
    if arc:
        out += ('<w:p><w:pPr><w:spacing w:after="400"/></w:pPr>'
                '<w:r><w:rPr><w:i/><w:iCs/><w:color w:val="777777"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
                f'<w:t xml:space="preserve">진행 방향 — {esc(arc)}</w:t></w:r></w:p>')
    return out

def p_level_divider(name):
    return ('<w:p><w:pPr><w:pageBreakBefore/><w:jc w:val="center"/><w:spacing w:after="300" w:before="300"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="166534"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>'
            f'<w:t xml:space="preserve">· {esc(name)} ·</w:t></w:r></w:p>')

YEAR_RX = re.compile(r'(20\d\d)')
MONTH_RX = re.compile(r'(\d{1,2})\s*월')

def order_key(cat, key, posts, levels):
    doc, seq, title, _ = posts[key]
    pri, lvl = DOC_PRI.get(doc, 999), levels.get(key, 9)
    if cat in LEVELED:
        return (lvl, pri, seq)
    if cat == 'C10':
        y = YEAR_RX.search(title) or YEAR_RX.search(doc)
        return (int(y.group(1)) if y else 9999, pri, seq)
    if cat == 'C11':
        y = YEAR_RX.search(title)
        m = MONTH_RX.search(title)
        return (int(y.group(1)) if y else 9999, int(m.group(1)) if m else 99, pri, seq)
    return (pri, seq)

def main():
    labels = load_labels()
    posts = extract_posts()
    missing = [k for k in posts if k not in labels]
    extra = [k for k in labels if k not in posts]
    assert not missing, f'라벨 누락 {len(missing)}건: {missing[:5]}'
    if extra:
        print(f'[warn] 라벨에만 있는 키 {len(extra)}건 무시')
    bad = {k: v for k, v in labels.items() if v not in CH_TITLE}
    assert not bad, f'잘못된 카테고리: {list(bad.items())[:5]}'
    print(f'[check] 라벨 커버리지 {len(posts)}/{len(posts)} 통과')

    # 레벨/아크 로드 (levels/CH_Cxx.json: {arc, items:[{key, level}]})
    levels, arcs = {}, {}
    for f in glob.glob(os.path.join(HERE, 'levels', 'CH_*.json')):
        d = json.load(open(f, encoding='utf-8'))
        cat = os.path.basename(f)[3:6]
        arcs[cat] = d.get('arc', '')
        for it in d.get('items', []):
            lv = it.get('level')
            if isinstance(lv, int) and 1 <= lv <= 4:
                levels[it['key']] = lv

    by_ch = defaultdict(list)
    for k in posts:
        by_ch[labels[k]].append(k)
    for c in by_ch:
        by_ch[c].sort(key=lambda k: order_key(c, k, posts, levels))

    parts_xml = [
        p_master_title('사주명리 대전'),
        p_master_sub(f'주제별 통합본 · 전 {len(CHAPTERS)}장 · 총 {len(posts):,}편'),
        p_gray('5개 사이트의 글을 주제별로 재분류하고 기초→심화 순으로 엮음 — 플러스명리학 · 안녕, 사주명리 · 초코서당 · 다시 배우는 사주명리 · 도화로운'),
        p_gray(f'저장일: {SAVED}', after=500),
        p_note('※ 원문 텍스트 정제본 기준. 각 글 메타줄에 원문 주소와 출처 문서를 표기했습니다. 이론 장은 입문→초급→중급→심화 순 배열이며 구분선으로 표시됩니다. 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'),
        p_toc_head(),
    ]
    for c, t, s in CHAPTERS:
        parts_xml.append(p_toc_row(t, s, len(by_ch.get(c, []))))
    for c, t, s in CHAPTERS:
        entries = by_ch.get(c, [])
        if not entries:
            continue
        parts_xml.append(p_chapter_divider(t, s, len(entries), arcs.get(c, '')))
        cur_lv = None
        for k in entries:
            if c in LEVELED:
                lv = levels.get(k)
                if lv and lv != cur_lv:
                    parts_xml.append(p_level_divider(LEVEL_NAME.get(lv, str(lv))))
                    cur_lv = lv
            doc = posts[k][0]
            parts_xml.append(''.join(tag_meta(posts[k][3], doc)))

    tpl = zipfile.ZipFile(TEMPLATE)
    doc0 = tpl.read('word/document.xml').decode('utf-8')
    prefix = doc0[:doc0.index('<w:body>') + len('<w:body>')]
    sect = doc0[doc0.rindex('<w:sectPr'):doc0.rindex('</w:body>')]
    new_doc = prefix + ''.join(parts_xml) + sect + '</w:body></w:document>'
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for item in tpl.infolist():
            if item.filename == 'word/document.xml':
                z.writestr('word/document.xml', new_doc.encode('utf-8'))
            elif item.filename.endswith('/'):
                z.writestr(item, b'')
            else:
                z.writestr(item, tpl.read(item.filename))
    tpl.close()

    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', new_doc))
    assert h1 == len(posts), f'H1 {h1} != {len(posts)}'
    dist = Counter(labels[k] for k in posts)
    print('[분포]', {c: dist.get(c, 0) for c, _, _ in CHAPTERS})
    print(f'[done] {OUT} ({os.path.getsize(OUT):,} bytes) · 글 {h1:,}편 검증 통과')

if __name__ == '__main__':
    main()
