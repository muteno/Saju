# -*- coding: utf-8 -*-
"""사주플러스 게시판 익명 크롤러.

사용법:
    python crawl_board.py boards.json [out_prefix]

boards.json 형식:
    [{"slug": "chogeup", "name": "명리학탐구(초급)", "url": "http://saju.sajuplus.net/?mnuid=2&idcnt=3&curjong=saju001011&cstyle=4"}, ...]
    (jong은 url의 curjong에서 자동 추출)

출력:
    <out_prefix>_data.json  — {slug: [글 전문, ...]}
    <out_prefix>_meta.json  — [{slug, name, jong}, ...]  (build_from_json.js 입력용)
주의: 익명은 게시판당 앞 1~2페이지만 나올 수 있음(로그인 게이트). README.md 참고.
"""
import re, time, sys, json, os
from urllib.parse import urljoin, parse_qs, urlparse
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

boards_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'boards.json')
prefix = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'boards_out')
BOARDS = json.load(open(boards_file, encoding='utf-8'))

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
})
# 로그인 크롤: 브라우저에서 document.cookie를 파일로 저장(Blob 다운로드)한 뒤 그 경로를
# SAJU_COOKIE_FILE 환경변수로 넘기면 .sajuplus.net 전 서브도메인에 로그인 적용됨.
_ck = os.environ.get('SAJU_COOKIE_FILE')
if _ck and os.path.exists(_ck):
    s.headers['Cookie'] = open(_ck, encoding='utf-8').read().strip()
    print('[cookie loaded — logged-in crawl]', flush=True)

def get_soup(url):
    r = s.get(url, timeout=25)
    m = re.search(rb'charset=["\']?([\w-]+)', r.content[:3000], re.I)
    r.encoding = (m.group(1).decode() if m else None) or r.apparent_encoding or 'utf-8'
    return BeautifulSoup(r.text, 'html.parser')

def extract(url):
    soup = get_soup(url)
    for tag in soup(['script', 'style', 'noscript']):
        tag.decompose()
    bc = soup.find(id='boardContent')
    if not bc:
        return None
    for br in bc.find_all('br'):
        br.replace_with('\n')
    for el in bc.find_all(['p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'table']):
        el.append('\n')
    txt = bc.get_text()
    txt = re.sub(r'https?://\S+', '', txt)
    txt = re.sub(r'[ \t\xa0]+', ' ', txt)
    txt = re.sub(r'\n[ \t]+', '\n', txt)
    txt = re.sub(r'\n{3,}', '\n\n', txt)
    return txt.strip()

data, meta = {}, []
for b in BOARDS:
    url = b['url']
    jong = re.search(r'curjong=([A-Za-z]+\d+)', url).group(1)
    soup = get_soup(url)
    area = soup.find(id='jb-content') or soup
    pm = re.search(r'페이지\s*:\s*1\s*/\s*(\d+)', area.get_text())
    npages = int(pm.group(1)) if pm else 1
    arts, page, empty = {}, 1, 0
    while page <= npages + 2 and page <= 130:
        sp = soup if page == 1 else get_soup(url + f'&page={page}')
        ar = sp.find(id='jb-content') or sp
        fresh = 0
        for a in ar.find_all('a'):
            t = a.get_text(strip=True)
            h = a.get('href') or ''
            if 'acmode=b_s' in h and f'curjong={jong}' in h and t and len(t) > 3:
                no = (parse_qs(urlparse(urljoin(url, h)).query).get('no') or [h])[0]
                if no not in arts:
                    arts[no] = (t, h)
                    fresh += 1
        if fresh == 0:
            empty += 1
            if empty >= 2:
                break
        else:
            empty = 0
        page += 1
        time.sleep(0.12)
    items = list(arts.values())
    chunks, fails = [], 0
    for t, h in items:
        try:
            txt = extract(urljoin(url, h))
        except Exception:
            txt = None
        if not txt or len(txt) < 60:
            fails += 1
            txt = f"▽{t}\n\n(본문 추출 실패)"
        chunks.append(txt)
        time.sleep(0.12)
    data[b['slug']] = chunks
    meta.append({'slug': b['slug'], 'name': b['name'], 'jong': jong})
    expected = npages * 10
    status = 'FULL?' if len(items) >= expected - 5 else f'PARTIAL ({len(items)}/{expected} 추정) -> 로그인 크롤 필요'
    print(f"{b['name']}: pages={npages} got={len(items)} fails={fails}  [{status}]", flush=True)

json.dump(data, open(prefix + '_data.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(meta, open(prefix + '_meta.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('WROTE', prefix + '_data.json', prefix + '_meta.json')
