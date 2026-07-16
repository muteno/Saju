# -*- coding: utf-8 -*-
"""yavares.tistory.com '현묘의 사주 이야기' 카테고리 전체 글 수집 → posts.json"""
import urllib.request, re, json, time, sys, os
from html.parser import HTMLParser
from html import unescape

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

BASE = 'https://yavares.tistory.com'
CAT_PATH = '/category/%ED%98%84%EB%AC%98%EC%9D%98%20%EC%82%AC%EC%A3%BC%20%EC%9D%B4%EC%95%BC%EA%B8%B0'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}
DELAY = 0.35

def get(url, retries=3):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            last = e
            time.sleep(2.0 * (i + 1))
    raise RuntimeError(f'fetch failed: {url}: {last}')

# ---------- 1) 카테고리 목록 수집 ----------
def scrape_listing():
    items = []   # (id, title, date)
    seen = set()
    page = 1
    while page <= 200:   # 안전 상한 (운세 상위 카테고리가 64p — 60이면 잘림)
        url = f'{BASE}{CAT_PATH}?page={page}'
        h = get(url)
        # JSON-LD: 페이지 내 글 id/제목 (순서 보존)
        ld_ids = []
        m = re.search(r'"@type":"BreadcrumbList".*?\]\}', h, re.S)
        if m:
            try:
                data = json.loads('{' + m.group(0))
                for it in data.get('itemListElement', []):
                    iid = re.search(r'/(\d+)$', it['item']['@id'])
                    if iid:
                        ld_ids.append((int(iid.group(1)), it['item']['name']))
            except Exception:
                ld_ids = []
        # li.item_category 블록: id → 날짜
        date_map = {}
        for block in re.findall(r'<li class="item_category">(.*?)</li>', h, re.S):
            mid = re.search(r'href="/(\d+)"', block)
            mdt = re.search(r'class="date">\s*([\d.\s]+?)\s*<', block)
            if mid:
                d = mdt.group(1).strip() if mdt else ''
                date_map[int(mid.group(1))] = d
        page_items = ld_ids if ld_ids else [(i, '') for i in sorted(date_map, reverse=True)]
        new = [(i, t) for i, t in page_items if i not in seen]
        if not new:
            break
        for i, t in new:
            seen.add(i)
            items.append({'id': i, 'title': unescape(t), 'list_date': date_map.get(i, '')})
        print(f'[list] page {page}: +{len(new)} (total {len(items)})', flush=True)
        page += 1
        time.sleep(DELAY)
    return items

# ---------- 2) 본문 파서 ----------
BLOCK_TAGS = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre'}
SKIP_TAGS = {'script', 'style', 'figure', 'figcaption'}

class BodyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []          # (kind, text)
        self.skip = 0
        self.quote = 0
        self.buf = None           # current block buffer (list of str)
        self.kind = None
        self.cells = None         # current table row cells
        self.cellbuf = None

    def flush(self):
        if self.buf is None:
            return
        text = ''.join(self.buf)
        self.buf = None
        kind = self.kind
        self.kind = None
        for seg in text.split('\n'):
            seg = re.sub(r'[ \t\r\f\v\xa0​]+', ' ', seg).strip()
            if seg:
                self.blocks.append((kind, seg))

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == 'blockquote':
            self.flush()
            self.quote += 1
        elif tag == 'tr':
            self.flush()
            self.cells = []
        elif tag in ('td', 'th'):
            self.cellbuf = []
        elif tag in BLOCK_TAGS:
            self.flush()
            self.buf = []
            self.kind = ('h' if tag[0] == 'h' else
                         'li' if tag == 'li' else
                         'pre' if tag == 'pre' else
                         'q' if self.quote else 'p')
            if self.quote and self.kind == 'p':
                self.kind = 'q'
        elif tag == 'br':
            if self.cellbuf is not None:
                self.cellbuf.append(' ')
            elif self.buf is not None:
                self.buf.append('\n')

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag == 'blockquote':
            self.flush()
            self.quote = max(0, self.quote - 1)
        elif tag in ('td', 'th'):
            if self.cells is not None and self.cellbuf is not None:
                c = re.sub(r'[ \t\r\f\v\xa0​]+', ' ', ''.join(self.cellbuf)).strip()
                self.cells.append(c)
            self.cellbuf = None
        elif tag == 'tr':
            if self.cells:
                row = ' | '.join(self.cells).strip(' |')
                if row:
                    self.blocks.append(('row', row))
            self.cells = None
        elif tag in BLOCK_TAGS:
            self.flush()

    def handle_data(self, data):
        if self.skip:
            return
        if self.cellbuf is not None:
            self.cellbuf.append(data)
        elif self.buf is not None:
            self.buf.append(data)
        else:
            # 블록 밖의 직접 텍스트 (div 바로 아래 등)
            t = data.strip()
            if t:
                self.buf = [data]
                self.kind = 'q' if self.quote else 'p'
                self.flush()

def extract_content_div(h):
    m = re.search(r'<div[^>]*class="[^"]*contents_style[^"]*"[^>]*>', h)
    if not m:
        return None
    start = m.end()
    depth = 1
    for tok in re.finditer(r'<div\b|</div\s*>', h[start:]):
        depth += 1 if tok.group(0).startswith('<div') else -1
        if depth == 0:
            return h[start:start + tok.start()]
    return h[start:]

def norm_date(raw):
    m = re.search(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{1,2}:\d{2}))?', raw or '')
    if not m:
        return '', ''
    d = f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'
    return d, (m.group(4) or '')

def scrape_post(pid):
    h = get(f'{BASE}/{pid}')
    mt = re.search(r'<h1 class="title_post">(.*?)</h1>', h, re.S)
    title = unescape(re.sub(r'<[^>]+>', '', mt.group(1))).strip() if mt else ''
    mi = re.search(r'<p class="info">(.*?)</p>', h, re.S)
    raw_date, cat = '', ''
    if mi:
        spans = re.findall(r'<span[^>]*>(.*?)</span>', mi.group(1), re.S)
        if spans:
            raw_date = unescape(re.sub(r'<[^>]+>', '', spans[0])).strip()
        if len(spans) > 1:
            cat = unescape(re.sub(r'<[^>]+>', '', spans[1])).strip()
    date, tm = norm_date(raw_date)
    frag = extract_content_div(h)
    blocks = []
    if frag:
        p = BodyParser()
        p.feed(frag)
        p.flush()
        blocks = p.blocks
    return {'id': pid, 'url': f'{BASE}/{pid}', 'title': title, 'date': date,
            'time': tm, 'category': cat, 'blocks': blocks}

def main():
    items = scrape_listing()
    print(f'[list] done: {len(items)} posts', flush=True)
    posts, failed = [], []
    for n, it in enumerate(items, 1):
        try:
            p = scrape_post(it['id'])
            if not p['title']:
                p['title'] = it['title']
            if not p['date']:
                d, _ = norm_date(it['list_date'])
                p['date'] = d
            posts.append(p)
            print(f'[post] {n}/{len(items)} #{p["id"]} {p["title"][:40]} ({p["date"]}) blocks={len(p["blocks"])}', flush=True)
        except Exception as e:
            failed.append({'id': it['id'], 'err': str(e)})
            print(f'[FAIL] {n}/{len(items)} #{it["id"]}: {e}', flush=True)
        time.sleep(DELAY)
    out = {'blog': '안녕, 사주명리', 'host': 'yavares.tistory.com',
           'category': '현묘의 사주 이야기', 'saved': '2026-07-12',
           'posts': posts, 'failed': failed}
    with open(os.path.join(HERE, 'posts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'[done] ok={len(posts)} failed={len(failed)}', flush=True)

if __name__ == '__main__':
    main()
