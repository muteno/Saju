# -*- coding: utf-8 -*-
"""chocosd.com (사주명리의 첫걸음, 초코서당) 전체 글 수집 → posts.json
워드프레스 REST API(/wp-json/wp/v2/)가 완전 공개라 목록/본문을 API로 한 번에 받는다.
글 84개 기준 HTTP 요청 몇 번이면 끝 (2026-07-12 검증)."""
import urllib.request, json, re, sys, os, time
from html.parser import HTMLParser

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

BASE = 'https://chocosd.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}
DELAY = 0.5

def get_json(path, retries=3):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(BASE + path, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read()), dict(r.headers)
        except Exception as e:
            last = e
            time.sleep(2.0 * (i + 1))
    raise RuntimeError(f'fetch failed: {path}: {last}')

# ---------- 본문 HTML → 블록 파서 ----------
# tistory-tools의 BodyParser 기반. 차이점: 워드프레스는 표를
# <figure class="wp-block-table">로 감싸므로 figure를 통째로 스킵하면 표가 사라진다.
# → 이미지/임베드 figure만 스킵하고 표 figure는 살린다.
BLOCK_TAGS = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre'}
SKIP_TAGS = {'script', 'style', 'figcaption'}

class BodyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []          # (kind, text)
        self.skip = 0
        self.quote = 0
        self.buf = None
        self.kind = None
        self.cells = None
        self.cellbuf = None
        self.figstack = []        # figure별 스킵 여부

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
        if tag == 'figure':
            cls = dict(attrs).get('class') or ''
            skipped = 'wp-block-table' not in cls   # 표만 통과
            self.figstack.append(skipped)
            if skipped:
                self.skip += 1
            return
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
        if tag == 'figure':
            if self.figstack and self.figstack.pop():
                self.skip = max(0, self.skip - 1)
            return
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
            t = data.strip()
            if t:
                self.buf = [data]
                self.kind = 'q' if self.quote else 'p'
                self.flush()

def html_to_blocks(html):
    p = BodyParser()
    p.feed(html)
    p.flush()
    # 목차 플러그인의 접기 버튼 라벨('Toggle')은 UI 잔여물이라 제외
    return [b for b in p.blocks if b[1] != 'Toggle']

# ---------- 수집 ----------
def fetch_all(kind):
    """kind: 'posts' | 'pages' — 전 페이지 순회"""
    out, page = [], 1
    while True:
        items, hdr = get_json(f'/wp-json/wp/v2/{kind}?per_page=100&page={page}'
                              '&_fields=id,date,link,title,content,categories')
        out.extend(items)
        total_pages = int(hdr.get('X-WP-TotalPages') or 1)
        print(f'[{kind}] page {page}/{total_pages}: +{len(items)} (total {len(out)})', flush=True)
        if page >= total_pages:
            return out
        page += 1
        time.sleep(DELAY)

def main():
    cats, _ = get_json('/wp-json/wp/v2/categories?per_page=100')
    cat_name = {c['id']: c['name'] for c in cats}
    print(f'[cats] {len(cats)}개: ' + ', '.join(f"{c['name']}({c['count']})" for c in cats), flush=True)

    raw_posts = fetch_all('posts')
    posts, empty = [], []
    for rp in raw_posts:
        blocks = html_to_blocks(rp['content']['rendered'])
        title = re.sub(r'<[^>]+>', '', rp['title']['rendered'])
        title = html_to_blocks(f'<p>{title}</p>')
        title = title[0][1] if title else ''
        if not blocks:
            blocks = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
            empty.append(rp['id'])
        posts.append({
            'id': rp['id'], 'url': rp['link'], 'title': title,
            'date': rp['date'][:10], 'time': rp['date'][11:16],
            'categories': [cat_name.get(c, str(c)) for c in rp['categories']],
            'blocks': blocks,
        })
    print(f'[posts] {len(posts)}개 수집, 본문 없음 {len(empty)}개 {empty}', flush=True)

    out = {
        'site': '사주명리의 첫걸음, 초코서당', 'host': 'chocosd.com',
        'saved': time.strftime('%Y-%m-%d'),
        'categories': [{'id': c['id'], 'name': c['name'], 'count': c['count']} for c in cats],
        'posts': posts, 'empty': empty,
    }
    with open(os.path.join(HERE, 'posts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # 검증: 카테고리 count 합 vs 글별 카테고리 할당 수
    assign = sum(len(p['categories']) for p in posts)
    declared = sum(c['count'] for c in cats)
    print(f'[check] 글 {len(posts)} / 카테고리 할당 {assign} / 카테고리 count 합 {declared}', flush=True)
    uncat = [p['id'] for p in posts if not p['categories']]
    if uncat:
        print(f'[check] 카테고리 없는 글: {uncat}', flush=True)
    print('[done] posts.json 저장', flush=True)

if __name__ == '__main__':
    main()
