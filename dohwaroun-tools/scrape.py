# -*- coding: utf-8 -*-
"""도화로운(dohwaroun.com, 아임웹) 무료 게시판 수집 → <board>.json
게시판: monthlylucky(월간운세), saju_column(사주 칼럼). 둘 다 비로그인 공개.
사용법: python scrape.py <board> [출력json]
"""
import urllib.request, re, json, time, sys, os
from html.parser import HTMLParser
from html import unescape

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = 'https://dohwaroun.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}
DELAY = 0.4
# og:title = "<글제목> : <게시판/사이트명>". 게시판마다 접미어가 다름 → 알려진 접미어를 반복 제거.
TITLE_SUFFIXES = [
    ' : 사주운세 : 오늘의 운세보다 정확한 무료운세',  # 사이트 기본(월간운세 등)
    ' : 사주 칼럼',
    ' : 월간운세',
]

def clean_title(t):
    changed = True
    while changed:
        changed = False
        for suf in TITLE_SUFFIXES:
            if t.endswith(suf):
                t = t[:-len(suf)]
                changed = True
    return t.strip()

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

# ---------- 목록 ----------
def scrape_listing(board):
    ids, seen = [], set()
    page = 1
    while page <= 60:
        h = get(f'{BASE}/{board}?page={page}')
        # 카드 onclick 전용 패턴 — 판매버튼(/lecture/?idx=)·타게시판 교차링크 같은 stray 배제
        found = list(dict.fromkeys(re.findall(rf"location\.href='/{board}/\?[^']*?idx=(\d+)", h)))
        new = [i for i in found if i not in seen]
        # 첫 페이지 idx만 반복되면(페이지 초과) 종료
        if not new:
            break
        for i in new:
            seen.add(i)
            ids.append(i)
        print(f'[list] {board} page {page}: +{len(new)} (total {len(ids)})', flush=True)
        page += 1
        time.sleep(DELAY)
    return ids

# ---------- 본문 파서 (froala .fr-view) ----------
BLOCK_TAGS = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre'}
SKIP_TAGS = {'script', 'style', 'figure', 'figcaption', 'img'}

class BodyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.skip = 0
        self.quote = 0
        self.buf = None
        self.kind = None
        self.cells = None
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
            self.flush(); self.quote += 1
        elif tag == 'tr':
            self.flush(); self.cells = []
        elif tag in ('td', 'th'):
            self.cellbuf = []
        elif tag in BLOCK_TAGS:
            self.flush(); self.buf = []
            self.kind = ('h' if tag[0] == 'h' else 'li' if tag == 'li'
                         else 'pre' if tag == 'pre' else 'q' if self.quote else 'p')
        elif tag == 'br':
            if self.cellbuf is not None:
                self.cellbuf.append(' ')
            elif self.buf is not None:
                self.buf.append('\n')

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self.skip = max(0, self.skip - 1); return
        if self.skip:
            return
        if tag == 'blockquote':
            self.flush(); self.quote = max(0, self.quote - 1)
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

def extract_body(h):
    """<div class='board_txt_area fr-view'> ... </div> 를 div 깊이 추적으로 잘라냄"""
    m = re.search(r"<div[^>]*class=['\"][^'\"]*board_txt_area[^'\"]*['\"][^>]*>", h)
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
    m = re.search(r'(\d{4})[-.](\d{1,2})[-.](\d{1,2})', raw or '')
    return f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else ''

def scrape_post(board, idx):
    url = f'{BASE}/{board}/?bmode=view&idx={idx}&t=board'
    h = get(url)
    mt = re.search(r'<meta property="og:title" content="([^"]*)"', h)
    title = clean_title(unescape(mt.group(1))) if mt else ''
    date = ''
    md = re.search(r'"datePublished"\s*:\s*"([^"]+)"', h)
    if md:
        date = norm_date(md.group(1))
    frag = extract_body(h)
    blocks = []
    if frag:
        p = BodyParser()
        p.feed(frag)
        p.flush()
        blocks = p.blocks
    return {'idx': idx, 'url': url, 'title': title, 'date': date, 'blocks': blocks}

BOARD_NAMES = {'monthlylucky': '도화로운 월간운세', 'saju_column': '도화로운 사주 칼럼'}

def main():
    board = sys.argv[1] if len(sys.argv) > 1 else 'monthlylucky'
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, f'{board}.json')
    ids = scrape_listing(board)
    print(f'[list] {board} done: {len(ids)} posts', flush=True)
    posts, failed = [], []
    for n, idx in enumerate(ids, 1):
        try:
            p = scrape_post(board, idx)
            if not p['blocks']:
                p['blocks'] = [['p', '(본문이 공개되어 있지 않거나 텍스트가 없는 글입니다.)']]
                print(f'[EMPTY] {board} idx={idx} {p["title"][:40]}', flush=True)
            posts.append(p)
            if n % 10 == 0 or n == len(ids):
                print(f'[post] {board} {n}/{len(ids)} last="{p["title"][:34]}" ({p["date"]})', flush=True)
        except Exception as e:
            failed.append({'idx': idx, 'err': str(e)})
            print(f'[FAIL] {board} idx={idx}: {e}', flush=True)
        time.sleep(DELAY)
    data = {'site': '도화로운', 'host': 'dohwaroun.com', 'board': board,
            'board_name': BOARD_NAMES.get(board, board), 'saved': '2026-07-12',
            'posts': posts, 'failed': failed}
    json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'[done] {board} ok={len(posts)} failed={len(failed)} → {out}', flush=True)

if __name__ == '__main__':
    main()
