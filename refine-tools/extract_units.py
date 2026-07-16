# -*- coding: utf-8 -*-
r"""정제본 76편에서 글 단위(2,504편) 추출 → units.json
각 글: key(문서명#순번), 제목, 본문 첫 부분(분류용 스니펫), 문단 수.
분류 후 재조립은 assemble_book.py가 같은 방식으로 XML을 다시 잘라 쓴다."""
import zipfile, re, glob, os, sys, json, html
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
REFINED = os.path.join(os.path.dirname(HERE), '정제본')
PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)

def txt(p):
    return html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()

def units_of(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    paras = PARA_RX.findall(xml)
    h1s = [i for i, p in enumerate(paras) if 'Heading1' in p]
    out = []
    for n, i in enumerate(h1s):
        j = h1s[n + 1] if n + 1 < len(h1s) else len(paras)
        title = txt(paras[i])
        body = []
        for p in paras[i + 1:j]:
            t = txt(p)
            if t and not t.startswith('작성일 '):
                body.append(t)
            if len(' '.join(body)) > 260:
                break
        out.append({'seq': n, 'title': title, 'snippet': ' '.join(body)[:260], 'nparas': j - i})
    return out

def main():
    docs = sorted(glob.glob(os.path.join(REFINED, '*.docx')))
    units = []
    for f in docs:
        name = os.path.splitext(os.path.basename(f))[0]
        for u in units_of(f):
            u['doc'] = name
            u['key'] = f'{name}#{u["seq"]:04d}'
            units.append(u)
    json.dump(units, open(os.path.join(HERE, 'units.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)
    print('총 글 수:', len(units))
    from collections import Counter
    print('문서 수:', len(set(u['doc'] for u in units)))

if __name__ == '__main__':
    main()
