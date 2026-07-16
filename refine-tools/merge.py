# -*- coding: utf-8 -*-
r"""정제본 76편 → 통합 docx 1개 ("사주명리 아카이브 통합본 (정제).docx")
구성: 통합 표지 → 통합 목차(부·편) → 제1~6부(사이트별) → 각 편은 원 문서의
표지·수록 글 목록·본문을 그대로 수록. 누락 방지: 파일 목록/글 수를 병합 전후로 대조.
"""
import zipfile, re, sys, os, glob, html
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
REFINED = os.path.join(SRC, '정제본')
OUT = os.path.join(SRC, '사주명리 아카이브 통합본 (정제).docx')
TEMPLATE = os.path.join(REFINED, '자평명리학 게시판 글모음.docx')
SAVED = '2026-07-13'

PARTS = [
 ('제1부 플러스명리학 — 명리학 게시판', 'saju.sajuplus.net', [
   '명리학탐구(기초) 전체 글모음 001-086', '명리학탐구(초급) 게시판 글모음',
   '명리학탐구(중급1) 게시판 글모음', '명리학탐구(중급2) 게시판 글모음',
   '명리학탐구(고급1) 게시판 글모음', '명리학탐구(고급2) 게시판 글모음',
   '명리학입문 게시판 글모음', '자평명리학 게시판 글모음', '사주풀이 게시판 글모음',
   '유명인사주풀이 게시판 글모음', '운세정리게시판 게시판 글모음',
   '기타자료 게시판 글모음', '기타-유용한자료 게시판 글모음']),
 ('제2부 플러스명리학 — 사용설명서·역학 자료실', 'saju.sajuplus.net', [
   '만세력사용설명서 게시판 글모음', '운세력사용설명서 게시판 글모음',
   '플러스작명설명서 게시판 글모음', '택일기타사용설명 게시판 글모음',
   'name-이름게시판 게시판 글모음', 'dang-당사주자료실 게시판 글모음',
   'face-관상학자료실 게시판 글모음', 'gusung-구성학자료실 게시판 글모음',
   'hand-수상학강좌 게시판 글모음', 'hand-용어사전 게시판 글모음', 'hand-지문학 게시판 글모음',
   'mehwa-매화역수자료실 게시판 글모음', 'pungsu-이기풍수 게시판 글모음',
   'pungsu-형기풍수 게시판 글모음', 'pungsu-인테리어풍수 게시판 글모음',
   'pungsu-풍수택일 게시판 글모음', 'pungsu-기타자료 게시판 글모음',
   'taro-타로카드 게시판 글모음', 'tojung-토정비결 게시판 게시판 글모음']),
 ('제3부 안녕, 사주명리 (현묘)', 'yavares.tistory.com', [
   '현묘의 사주 이야기 글모음', '명리교육 글모음', '일주론 글모음', '천간과 지지 글모음',
   '십신과 합충 글모음', '원국 분석 및 용신 글모음', '십이운성 글모음', '신살 글모음',
   '24절기 글모음', '고전읽기 글모음',
   '2020년 경자년 운세 글모음', '2021년 신축년 운세 글모음', '2022년 임인년 운세 글모음',
   '2023년 계묘년 운세 글모음', '2024년 갑진년 운세 글모음', '2025년 을사년 운세 글모음',
   '2026년 병오년 운세 글모음', '이달의 운세(일간별) 글모음',
   '파이브시즌스 글모음', '무료상담 글모음', '미혼모 후원 프로젝트 글모음']),
 ('제4부 초코서당', 'chocosd.com', [
   '초코서당-사주명리 입문 글모음', '초코서당-음양, 오행 글모음', '초코서당-천간, 지지 글모음',
   '초코서당-십성, 육친 글모음', '초코서당-합, 충, 형 글모음', '초코서당-신살 글모음',
   '초코서당-일주론 글모음', '초코서당-사주용어사전 글모음', '초코서당-사주이야기 글모음',
   '초코서당-신년운세 모음 글모음', '초코서당-일상이야기 글모음',
   '초코서당-상담 및 필자 안내 글모음', '초코서당-수강안내 글모음']),
 ('제5부 다시 배우는 사주명리 (사주공부)', 'www.sajustudy.com', [
   '사주공부-공지 글모음', '사주공부-명리 초급 글모음', '사주공부-명리 중급 글모음',
   '사주공부-신살론 글모음', '사주공부-추명가 강의 글모음', '사주공부-사주상식 글모음',
   '사주공부-사공 저서 글모음', '사주공부-사공 역학 서비스 글모음']),
 ('제6부 도화로운 (도화도르)', 'dohwaroun.com', [
   '도화로운 월간운세 글모음', '도화로운 사주 칼럼 글모음']),
]

def esc(t):
    return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

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
            '<w:r><w:t xml:space="preserve">통합 목차</w:t></w:r></w:p>')

def p_toc_part(t):
    return ('<w:p><w:pPr><w:spacing w:after="60" w:before="220"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="166534"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>')

def p_toc_doc(name, posts):
    return ('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="30"/></w:pPr>'
            '<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(name)}</w:t></w:r>'
            '<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
            f'<w:t xml:space="preserve">  ({posts}편)</w:t></w:r></w:p>')

def p_part_divider(title, host, ndocs, nposts):
    return (('<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:after="200" w:before="3200"/></w:pPr>'
             '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14532D"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>'
             f'<w:t xml:space="preserve">{esc(title)}</w:t></w:r></w:p>')
            + ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="14532D" w:sz="6" w:space="8"/></w:pBdr>'
               '<w:spacing w:after="400"/></w:pPr>'
               '<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
               f'<w:t xml:space="preserve">{esc(host)} · {ndocs}편 · {nposts}개 글</w:t></w:r></w:p>'))

def doc_inner(path):
    """문서의 <w:body> 내부(sectPr 제외)와 Heading1 수 반환"""
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    body = xml[xml.index('<w:body>') + len('<w:body>'):xml.rindex('<w:sectPr')]
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', body))
    # 첫 문단(편 표지 제목)에 pageBreakBefore 삽입 → 편이 새 페이지에서 시작
    m = re.search(r'<w:pPr>', body)
    if m:
        body = body[:m.end()] + '<w:pageBreakBefore/>' + body[m.end():]
    return body, h1

def main():
    files = {os.path.splitext(os.path.basename(f))[0]: f for f in glob.glob(os.path.join(REFINED, '*.docx'))}
    ordered = [n for _, _, docs in PARTS for n in docs]
    missing = [n for n in ordered if n not in files]
    extra = [n for n in files if n not in ordered]
    assert not missing, f'목록에 있으나 파일 없음: {missing}'
    assert not extra, f'파일은 있으나 목록에 누락: {extra}'
    print(f'[check] 76개 대조 통과 (목록 {len(ordered)} == 파일 {len(files)})', flush=True)

    # 1) 각 편 내용/글수 수집
    part_data = []
    grand_posts = 0
    for title, host, docs in PARTS:
        entries = []
        for n in docs:
            body, h1 = doc_inner(files[n])
            entries.append((n, body, h1))
            grand_posts += h1
        part_data.append((title, host, entries))
        print(f'[read] {title}: {len(entries)}편 {sum(e[2] for e in entries)}글', flush=True)

    # 2) 통합 표지 + 목차
    parts_xml = []
    parts_xml.append(p_master_title('사주명리 아카이브 통합본'))
    parts_xml.append(p_master_sub(f'정제본 전체 통합 · {len(PARTS)}부 {len(ordered)}편 · 총 {grand_posts:,}개 글'))
    parts_xml.append(p_gray('수록 사이트: 플러스명리학(saju.sajuplus.net) · 안녕, 사주명리(yavares.tistory.com) · '
                            '초코서당(chocosd.com) · 다시 배우는 사주명리(www.sajustudy.com) · 도화로운(dohwaroun.com)'))
    parts_xml.append(p_gray(f'저장일: {SAVED}', after=500))
    parts_xml.append(p_note('※ 각 사이트 원문 텍스트를 정제(광고·후원·구독 유도·반복 인사말·링크 잔재·이모지 제거)해 수록했습니다. '
                            '그림·도표 이미지와 댓글은 포함되어 있지 않습니다. 세부 제거 내역은 "정제본\\정제 리포트.md" 참조.'))
    parts_xml.append(p_toc_head())
    for title, host, entries in part_data:
        parts_xml.append(p_toc_part(f'{title} — {sum(e[2] for e in entries)}글'))
        for n, _, h1 in entries:
            parts_xml.append(p_toc_doc(n, h1))

    # 3) 본문: 부 구분 페이지 + 편들
    for title, host, entries in part_data:
        parts_xml.append(p_part_divider(title, host, len(entries), sum(e[2] for e in entries)))
        for n, body, h1 in entries:
            parts_xml.append(body)

    # 4) 패키지 조립
    tpl = zipfile.ZipFile(TEMPLATE)
    doc = tpl.read('word/document.xml').decode('utf-8')
    prefix = doc[:doc.index('<w:body>') + len('<w:body>')]
    sect = doc[doc.rindex('<w:sectPr'):doc.rindex('</w:body>')]
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

    # 5) 검증
    h1_total = len(re.findall(r'<w:pStyle w:val="Heading1"/>', new_doc))
    assert h1_total == grand_posts, f'글 수 불일치: 통합 {h1_total} != 개별 합 {grand_posts}'
    opens, closes = new_doc.count('<w:p>') + len(re.findall(r'<w:p [^>]*>', new_doc)), new_doc.count('</w:p>')
    print(f'[verify] H1(글) {h1_total:,} == 개별 합 / <w:p> 짝 {opens}=={closes}', flush=True)
    print(f'[done] {OUT} ({os.path.getsize(OUT):,} bytes, XML {len(new_doc)/1e6:.1f} MB)', flush=True)

if __name__ == '__main__':
    main()
