# -*- coding: utf-8 -*-
"""나머지 카테고리 일괄 수집 → 카테고리별 JSON + docx.
이미 수집된 cat_*.json은 건너뛰므로 중단돼도 재실행하면 이어서 진행된다.
사용법: python scrape_all.py [그룹...]   (그룹: theory | unse | counsel | 생략시 전부)"""
import json, os, re, sys, time, zipfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scrape          # 목록/본문 파서 재사용
import build_docx as B  # 문단 빌더 재사용

OUTDIR = os.path.dirname(HERE)          # ...\새 폴더
TEMPLATE = os.path.join(OUTDIR, '자평명리학 게시판 글모음.docx')
SAVED = '2026-07-12'
DELAY = 0.3

# (그룹, 파일/문서 제목용 이름, URL 경로)
CATS = [
    ('theory', '명리교육', '/category/%EB%AA%85%EB%A6%AC%EA%B5%90%EC%9C%A1'),
    ('theory', '일주론', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%9D%BC%EC%A3%BC%EB%A1%A0'),
    ('theory', '천간과 지지', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%B2%9C%EA%B0%84%EA%B3%BC%20%EC%A7%80%EC%A7%80'),
    ('theory', '십신과 합충', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%8B%AD%EC%8B%A0%EA%B3%BC%20%ED%95%A9%EC%B6%A9'),
    ('theory', '원국 분석 및 용신', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%9B%90%EA%B5%AD%20%EB%B6%84%EC%84%9D%20%EB%B0%8F%20%EC%9A%A9%EC%8B%A0'),
    ('theory', '십이운성', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%8B%AD%EC%9D%B4%EC%9A%B4%EC%84%B1%28%E5%8D%81%E4%BA%8C%E9%81%8B%E6%98%9F%29'),
    ('theory', '신살', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EC%8B%A0%EC%82%B4%28%E7%A5%9E%E7%85%9E%29'),
    ('theory', '24절기', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/24%EC%A0%88%EA%B8%B0'),
    ('theory', '고전읽기', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0/%EA%B3%A0%EC%A0%84%EC%9D%BD%EA%B8%B0'),
    ('unse', '이달의 운세(일간별)', '/category/%EC%9A%B4%EC%84%B8/%EC%9D%B4%EB%8B%AC%EC%9D%98%20%EC%9A%B4%EC%84%B8%28%EC%9D%BC%EA%B0%84%EB%B3%84%29'),
    ('unse', '2026년 병오년 운세', '/category/%EC%9A%B4%EC%84%B8/2026%EB%85%84%20%EB%B3%91%EC%98%A4%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2025년 을사년 운세', '/category/%EC%9A%B4%EC%84%B8/2025%EB%85%84%20%EC%9D%84%EC%82%AC%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2024년 갑진년 운세', '/category/%EC%9A%B4%EC%84%B8/2024%EB%85%84%20%EA%B0%91%EC%A7%84%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2023년 계묘년 운세', '/category/%EC%9A%B4%EC%84%B8/2023%EB%85%84%20%EA%B3%84%EB%AC%98%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2022년 임인년 운세', '/category/%EC%9A%B4%EC%84%B8/2022%EB%85%84%20%EC%9E%84%EC%9D%B8%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2021년 신축년 운세', '/category/%EC%9A%B4%EC%84%B8/2021%EB%85%84%20%EC%8B%A0%EC%B6%95%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('unse', '2020년 경자년 운세', '/category/%EC%9A%B4%EC%84%B8/2020%EB%85%84%20%EA%B2%BD%EC%9E%90%EB%85%84%20%EC%9A%B4%EC%84%B8'),
    ('counsel', '파이브시즌스', '/category/%EC%82%AC%EC%A3%BC%EC%83%81%EB%8B%B4/%ED%8C%8C%EC%9D%B4%EB%B8%8C%EC%8B%9C%EC%A6%8C%EC%8A%A4'),
    ('counsel', '무료상담', '/category/%EC%82%AC%EC%A3%BC%EC%83%81%EB%8B%B4/%EB%AC%B4%EB%A3%8C%EC%83%81%EB%8B%B4'),
    ('counsel', '미혼모 후원 프로젝트', '/category/%EB%AF%B8%ED%98%BC%EB%AA%A8%20%ED%9B%84%EC%9B%90%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8'),
]

# 부모 카테고리(하위 합계와 대조해 직속 글 누락 검증)
PARENTS = [
    ('unse', '운세', '/category/%EC%9A%B4%EC%84%B8',
     ['이달의 운세(일간별)', '2026년 병오년 운세', '2025년 을사년 운세', '2024년 갑진년 운세',
      '2023년 계묘년 운세', '2022년 임인년 운세', '2021년 신축년 운세', '2020년 경자년 운세']),
    ('counsel', '사주상담', '/category/%EC%82%AC%EC%A3%BC%EC%83%81%EB%8B%B4', ['파이브시즌스', '무료상담']),
    ('theory', '사주명리이론', '/category/%EC%82%AC%EC%A3%BC%EB%AA%85%EB%A6%AC%EC%9D%B4%EB%A1%A0',
     ['일주론', '천간과 지지', '십신과 합충', '원국 분석 및 용신', '십이운성', '신살', '24절기', '고전읽기']),
]

def slug(name):
    return re.sub(r'[^0-9A-Za-z가-힣]+', '_', name).strip('_')

def json_path(name):
    return os.path.join(HERE, f'cat_{slug(name)}.json')

def scrape_category(name, path):
    """목록+본문 수집 → dict (cat_*.json 캐시 사용)"""
    jp = json_path(name)
    if os.path.exists(jp):
        d = json.load(open(jp, encoding='utf-8'))
        print(f'[skip] {name}: 캐시 {len(d["posts"])}개', flush=True)
        return d
    scrape.CAT_PATH = path
    items = scrape.scrape_listing()
    posts, failed = [], []
    for n, it in enumerate(items, 1):
        try:
            p = scrape.scrape_post(it['id'])
            if not p['title']:
                p['title'] = it['title']
            if not p['date']:
                p['date'] = scrape.norm_date(it['list_date'])[0]
            if not p['blocks']:
                p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
                print(f'[EMPTY] {name} #{p["id"]} {p["title"][:40]}', flush=True)
            posts.append(p)
            if n % 10 == 0 or n == len(items):
                print(f'[post] {name} {n}/{len(items)}', flush=True)
        except Exception as e:
            failed.append({'id': it['id'], 'err': str(e)})
            print(f'[FAIL] {name} #{it["id"]}: {e}', flush=True)
        time.sleep(DELAY)
    d = {'blog': '안녕, 사주명리', 'host': 'yavares.tistory.com', 'category': name,
         'saved': SAVED, 'posts': posts, 'failed': failed}
    json.dump(d, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return d

def build(data, out_path):
    posts = sorted(data['posts'], key=lambda p: (p['date'], p['id']))
    n = len(posts)
    if n == 0:
        return None
    first, last = posts[0]['date'], posts[-1]['date']
    parts = [B.p_title(data['category']),
             B.p_subtitle(f'블로그 글 모음 · 총 {n}개 글 ({first} ~ {last})'),
             B.p_srcline(f"출처: {data['blog']} ({data['host']}) — {data['category']} 카테고리", 60),
             B.p_srcline(f"저장일: {data['saved']}", 500),
             B.p_note('※ 블로그 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.'),
             B.p_h2('수록 글 목록', pagebreak=True)]
    for p in posts:
        parts.append(B.p_toc_item(p['title'], p['date']))
    for p in posts:
        parts.append(B.p_h1(p['title']))
        parts.append(B.p_meta(f"작성일 {p['date']} · 원문 {p['url'].replace('https://', '')}"))
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
    # 검증
    import xml.dom.minidom as minidom
    z = zipfile.ZipFile(out_path)
    xml = z.read('word/document.xml').decode('utf-8')
    minidom.parseString(xml)
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"/>', xml))
    assert h1 == n, f'{out_path}: Heading1 {h1} != posts {n}'
    return n

def listing_ids(path):
    scrape.CAT_PATH = path
    return {it['id']: it for it in scrape.scrape_listing()}

def main():
    groups = set(sys.argv[1:]) or {'theory', 'unse', 'counsel'}
    done = {}
    for grp, name, path in CATS:
        if grp not in groups:
            continue
        d = scrape_category(name, path)
        out = os.path.join(OUTDIR, f'{name} 글모음.docx')
        n = build(d, out)
        done[name] = d
        print(f'[cat done] {name}: {n}개 → {os.path.basename(out)} (실패 {len(d["failed"])})', flush=True)
    # 부모 직속 글 검증(하위 카테고리에 없는 글)
    for grp, pname, ppath, children in PARENTS:
        if grp not in groups:
            continue
        kids = set()
        for c in children:
            jp = json_path(c)
            if os.path.exists(jp):
                kids |= {p['id'] for p in json.load(open(jp, encoding='utf-8'))['posts']}
        pl = listing_ids(ppath)
        extra_ids = [i for i in pl if i not in kids]
        print(f'[parent] {pname}: 목록 {len(pl)} / 하위합 {len(kids)} / 직속 {len(extra_ids)}', flush=True)
        if extra_ids:
            posts = []
            for pid in extra_ids:
                try:
                    p = scrape.scrape_post(pid)
                    if not p['blocks']:
                        p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
                    posts.append(p)
                except Exception as e:
                    print(f'[FAIL] {pname} 직속 #{pid}: {e}', flush=True)
                time.sleep(DELAY)
            d = {'blog': '안녕, 사주명리', 'host': 'yavares.tistory.com',
                 'category': f'{pname}(직속)', 'saved': SAVED, 'posts': posts, 'failed': []}
            json.dump(d, open(json_path(f'{pname}_직속'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            out = os.path.join(OUTDIR, f'{pname}(직속) 글모음.docx')
            build(d, out)
            print(f'[cat done] {pname}(직속): {len(posts)}개 → {os.path.basename(out)}', flush=True)
    total = sum(len(d['posts']) for d in done.values())
    print(f'[ALLDONE] 카테고리 {len(done)}개, 글 {total}개', flush=True)

if __name__ == '__main__':
    main()
