# -*- coding: utf-8 -*-
"""월운 허브 글(2026.2~7)이 링크하는 /pages/ 문서(일간별 운세)를 수집해
'이달의 운세(일간별)' JSON에 합치고 docx를 다시 생성한다."""
import json, os, re, sys, time
from html import unescape

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scrape
from scrape_all import build, json_path

JP = json_path('이달의 운세(일간별)')
OUT = os.path.join(os.path.dirname(HERE), '이달의 운세(일간별) 글모음.docx')

def page_links(html):
    """본문 영역의 opengraph 카드에서 /pages/ 링크(제목 포함) 추출 (순서 보존)"""
    frag = scrape.extract_content_div(html) or ''
    out = []
    for m in re.finditer(r'<figure[^>]*data-ke-type="opengraph"[^>]*>', frag):
        tag = m.group(0)
        mu = re.search(r'data-og-source-url="([^"]+)"', tag) or re.search(r'data-og-url="([^"]+)"', tag)
        mt = re.search(r'data-og-title="([^"]*)"', tag)
        if mu and '/pages/' in mu.group(1):
            out.append((unescape(mu.group(1)), unescape(mt.group(1)) if mt else ''))
    return out

def scrape_page(url, fallback_title, date):
    h = scrape.get(url)
    mt = re.search(r'property="og:title" content="([^"]*)"', h)
    title = unescape(mt.group(1)).strip() if mt else fallback_title
    frag = scrape.extract_content_div(h)
    blocks = []
    if frag:
        p = scrape.BodyParser()
        p.feed(frag)
        p.flush()
        blocks = p.blocks
    return {'url': url, 'title': title or fallback_title, 'date': date, 'time': '',
            'category': '이달의 운세(일간별)', 'blocks': blocks}

def main():
    d = json.load(open(JP, encoding='utf-8'))
    hubs = [p for p in d['posts'] if p['title'].endswith('월운 모음') and len(p['blocks']) <= 3]
    print(f'허브 글 {len(hubs)}개 처리', flush=True)
    added = 0
    for hub in hubs:
        h = scrape.get(hub['url'])
        links = page_links(h)
        print(f"[hub] #{hub['id']} {hub['title']} → 링크 {len(links)}개", flush=True)
        # 허브 본문을 링크 목록 텍스트로 대체
        hub['blocks'] = ([['p', '이 글은 아래 일간별 운세 문서로 구성된 모음글입니다. (각 문서는 이어서 수록)']] +
                         [['li', t or u] for u, t in links])
        for k, (url, title) in enumerate(links, 1):
            pid = hub['id'] * 1000 + k          # 허브 바로 뒤에 정렬되는 합성 id
            if any(p['id'] == pid for p in d['posts']):
                continue
            try:
                p = scrape_page(url, title, hub['date'])
                p['id'] = pid
                if not p['blocks']:
                    p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
                    print(f'  [EMPTY] {p["title"][:50]}', flush=True)
                d['posts'].append(p)
                added += 1
            except Exception as e:
                print(f'  [FAIL] {url[:80]}: {e}', flush=True)
            time.sleep(0.3)
    json.dump(d, open(JP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n = build(d, OUT)
    print(f'[done] 페이지 {added}개 추가 → 총 {n}개 글로 docx 재생성', flush=True)

if __name__ == '__main__':
    main()
