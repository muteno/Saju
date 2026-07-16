# -*- coding: utf-8 -*-
"""www.sajustudy.com (다시 배우는 사주명리, 티스토리 커스텀 도메인) 전체 카테고리 수집 → posts.json

tistory-tools/scrape.py 의 get()/BodyParser/extract_content_div 를 재사용하되,
스킨이 달라 목록/글 메타 파싱은 이 파일의 어댑터를 쓴다.
- 목록: JSON-LD BreadcrumbList (fallback: div.post-item)
- 제목: og:title 메타, 날짜: article:published_time 메타, 분류: span.category
- 본문: div.contents_style (동일)
- 블로그 공지(/notice/N)는 카테고리에 안 잡히므로 /notice 목록에서 별도 수집 → '공지'로 편입
"""
import importlib.util, json, os, re, sys, time
from html import unescape

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

T = _load('tt_scrape', os.path.join(os.path.dirname(HERE), 'tistory-tools', 'scrape.py'))

BASE = 'https://www.sajustudy.com'
DELAY = 0.35
SAVED = '2026-07-12'

# 말단 수집 단위: (상위 카테고리, 하위(없으면 None), URL 경로, 사이드바 글 수)
LEAVES = [
    ('공지', None, '/category/%EA%B3%B5%EC%A7%80', 5),
    ('명리 초급', '사주 입문', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89/%EC%82%AC%EC%A3%BC%20%EC%9E%85%EB%AC%B8', 43),
    ('명리 초급', '사주 초급 - 십성', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89/%EC%82%AC%EC%A3%BC%20%EC%B4%88%EA%B8%89%20-%20%EC%8B%AD%EC%84%B1', 7),
    ('명리 초급', '사주 초급 - 형충회합', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89/%EC%82%AC%EC%A3%BC%20%EC%B4%88%EA%B8%89%20-%20%ED%98%95%EC%B6%A9%ED%9A%8C%ED%95%A9', 9),
    ('명리 초급', '사주 초급 - 십이운성', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89/%EC%82%AC%EC%A3%BC%20%EC%B4%88%EA%B8%89%20-%20%EC%8B%AD%EC%9D%B4%EC%9A%B4%EC%84%B1', 14),
    ('명리 초급', '사주 초급 - 행운', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89/%EC%82%AC%EC%A3%BC%20%EC%B4%88%EA%B8%89%20-%20%ED%96%89%EC%9A%B4', 4),
    ('명리 중급', '기초 심화', '/category/%EB%AA%85%EB%A6%AC%20%EC%A4%91%EA%B8%89/%EA%B8%B0%EC%B4%88%20%EC%8B%AC%ED%99%94', 13),
    ('명리 중급', '중급', '/category/%EB%AA%85%EB%A6%AC%20%EC%A4%91%EA%B8%89/%EC%A4%91%EA%B8%89', 16),
    ('신살론', None, '/category/%EC%8B%A0%EC%82%B4%EB%A1%A0', 16),
    ('추명가 강의', '남명(001~230)', '/category/%EC%B6%94%EB%AA%85%EA%B0%80%20%EA%B0%95%EC%9D%98/%EB%82%A8%EB%AA%85%28001%7E230%29', 3),
    ('추명가 강의', '여명(231~480)', '/category/%EC%B6%94%EB%AA%85%EA%B0%80%20%EA%B0%95%EC%9D%98/%EC%97%AC%EB%AA%85%28231%7E480%29', 2),
    ('사주상식', None, '/category/%EC%82%AC%EC%A3%BC%EC%83%81%EC%8B%9D', 3),
    ('사공 저서', '책 오류 및 교정', '/category/%EC%82%AC%EA%B3%B5%20%EC%A0%80%EC%84%9C/%EC%B1%85%20%EC%98%A4%EB%A5%98%20%EB%B0%8F%20%EA%B5%90%EC%A0%95', 3),
    ('사공 저서', '저서 안내', '/category/%EC%82%AC%EA%B3%B5%20%EC%A0%80%EC%84%9C/%EC%A0%80%EC%84%9C%20%EC%95%88%EB%82%B4', 4),
    ('사공 역학 서비스', None, '/category/%EC%82%AC%EA%B3%B5%20%EC%97%AD%ED%95%99%20%EC%84%9C%EB%B9%84%EC%8A%A4', 3),
]

# 하위가 있는 상위 카테고리: 목록을 돌려 하위에 없는 직속 글을 찾는다 (상위, 경로, 사이드바 총수)
PARENTS = [
    ('명리 초급', '/category/%EB%AA%85%EB%A6%AC%20%EC%B4%88%EA%B8%89', 77),
    ('명리 중급', '/category/%EB%AA%85%EB%A6%AC%20%EC%A4%91%EA%B8%89', 29),
    ('추명가 강의', '/category/%EC%B6%94%EB%AA%85%EA%B0%80%20%EA%B0%95%EC%9D%98', 5),
    ('사공 저서', '/category/%EC%82%AC%EA%B3%B5%20%EC%A0%80%EC%84%9C', 14),
]

TOTAL_EXPECTED = 152  # 사이드바 '분류 전체보기 (152)'


def listing(path):
    """카테고리 목록 → [{'id', 'title'}] (최신순). JSON-LD 우선, post-item fallback."""
    items, seen, page = [], set(), 1
    while page <= 60:
        h = T.get(f'{BASE}{path}?page={page}')
        ld = []
        m = re.search(r'"@type":"BreadcrumbList".*?\]\}', h, re.S)
        if m:
            try:
                data = json.loads('{' + m.group(0))
                for it in data.get('itemListElement', []):
                    mid = re.search(r'/(\d+)$', it['item']['@id'])
                    if mid:
                        ld.append((int(mid.group(1)), unescape(it['item']['name'])))
            except Exception:
                ld = []
        if not ld:
            for m2 in re.finditer(r'<div class="post-item">\s*<a href="/(\d+)">(.*?)</a>', h, re.S):
                mt = re.search(r'<span class="title">(.*?)</span>', m2.group(2), re.S)
                t = unescape(re.sub(r'<[^>]+>', '', mt.group(1))).strip() if mt else ''
                ld.append((int(m2.group(1)), t))
        new = [(i, t) for i, t in ld if i not in seen]
        if not new:
            break
        for i, t in new:
            seen.add(i)
            items.append({'id': i, 'title': t})
        page += 1
        time.sleep(DELAY)
    return items


def scrape_post(pid, notice=False):
    url = f'{BASE}/notice/{pid}' if notice else f'{BASE}/{pid}'
    h = T.get(url)
    mt = re.search(r'<meta property="og:title" content="([^"]*)"', h)
    title = unescape(mt.group(1)).strip() if mt else ''
    md = re.search(r'<meta property="article:published_time" content="([^"]+)"', h)
    date, tm = '', ''
    if md:
        mm = re.match(r'(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})', md.group(1))
        if mm:
            date = f'{mm.group(1)}-{mm.group(2)}-{mm.group(3)}'
            tm = mm.group(4)
    mc = re.search(r'<span class="category">(.*?)</span>', h, re.S)
    cat = unescape(re.sub(r'<[^>]+>', '', mc.group(1))).strip() if mc else ''
    frag = T.extract_content_div(h)
    blocks = []
    if frag:
        p = T.BodyParser()
        p.feed(frag)
        p.flush()
        blocks = p.blocks
    return {'id': pid, 'url': url, 'title': title, 'date': date, 'time': tm,
            'category': cat, 'blocks': blocks}


def notice_ids():
    h = T.get(f'{BASE}/notice')
    return sorted({int(m) for m in re.findall(r'href="/notice/(\d+)"', h)}, reverse=True)


def main():
    member = {}   # id → (top, sub)  (말단 우선; 직속은 (top, None))
    order = {}    # id → 목록 내 위치(최신순 index) — 동일 날짜 정렬 보조
    kids_by_top = {}
    for top, sub, path, expect in LEAVES:
        items = listing(path)
        mark = 'OK' if len(items) == expect else f'MISMATCH(기대 {expect})'
        print(f'[list] {top} / {sub or "(직속)"}: {len(items)}개 {mark}', flush=True)
        for idx, it in enumerate(items):
            member.setdefault(it['id'], (top, sub))
            order[it['id']] = idx
        if sub is not None:
            kids_by_top.setdefault(top, set()).update(it['id'] for it in items)
    for top, path, expect in PARENTS:
        items = listing(path)
        direct = [it for it in items if it['id'] not in kids_by_top.get(top, set())]
        mark = 'OK' if len(items) == expect else f'MISMATCH(기대 {expect})'
        print(f'[parent] {top}: 목록 {len(items)}개 {mark}, 직속 {len(direct)}개', flush=True)
        for idx, it in enumerate(direct):
            member.setdefault(it['id'], (top, None))
            order.setdefault(it['id'], idx)

    if len(member) != TOTAL_EXPECTED:
        print(f'[WARN] 수집 대상 {len(member)}개 != 전체보기 {TOTAL_EXPECTED}개', flush=True)

    posts, failed = [], []
    ids = sorted(member)
    for n, pid in enumerate(ids, 1):
        top, sub = member[pid]
        try:
            p = scrape_post(pid)
            p['top'], p['sub'] = top, sub
            p['list_order'] = order.get(pid, 0)
            if not p['blocks']:
                p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
                print(f'[EMPTY] #{pid} {p["title"][:40]}', flush=True)
            posts.append(p)
            if n % 15 == 0 or n == len(ids):
                print(f'[post] {n}/{len(ids)}', flush=True)
        except Exception as e:
            failed.append({'id': pid, 'err': str(e)})
            print(f'[FAIL] #{pid}: {e}', flush=True)
        time.sleep(DELAY)

    for pid in notice_ids():
        try:
            p = scrape_post(pid, notice=True)
            p['top'], p['sub'] = '공지', None
            p['list_order'] = 0
            if not p['blocks']:
                p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
            posts.append(p)
            print(f'[notice] /notice/{pid} {p["title"][:40]} ({p["date"]})', flush=True)
        except Exception as e:
            failed.append({'id': f'notice/{pid}', 'err': str(e)})
            print(f'[FAIL] notice #{pid}: {e}', flush=True)
        time.sleep(DELAY)

    out = {'blog': '다시 배우는 사주명리', 'host': 'www.sajustudy.com', 'saved': SAVED,
           'posts': posts, 'failed': failed}
    with open(os.path.join(HERE, 'posts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'[done] ok={len(posts)} failed={len(failed)}', flush=True)


if __name__ == '__main__':
    main()
