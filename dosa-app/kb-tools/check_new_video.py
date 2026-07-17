# -*- coding: utf-8 -*-
"""유튜브 신규 지식 판별기 — 링크를 주면 "우리 DB에 없는 정보인지" 자동 판정.

파이프라인:
  1) vid 추출 → 이미 코퍼스(yt_saju/yt_units)에 있으면 그 자막 사용, 없으면 yt-dlp로 자막 수신
  2) 자막을 우리 색인 패턴(상호작용·인상)과 대조 → 다루는 주제 + 기존 커버리지
  3) 신규 신호: (a) 커버리지 얇은 키(<5건) 적중 (b) 우리 용어 사전에 없는 신살/격국 후보 용어
  4) 판정 리포트: 수집 가치 (높음/중간/낮음) + 보강되는 키 목록

사용: python check_new_video.py <URL 또는 vid> [--save]
      --save: 신호 점수≥2일 때만 자막을 fulltext/에 저장. **색인(yt_units/yt_saju) 등록은 하지 않는다**
              — 정식 주입은 ingest_transcript.py 사용(/feed 4-c ⓐ · 평의회 260717 발견① 참조)
"""
import json, os, re, subprocess, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KB = os.path.join(HERE, '..', 'kb')
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
SCRATCH = os.environ.get('TMPDIR', '/tmp')

sys.path.insert(0, HERE)
from scan_interactions import PATTERNS as IX_PATTERNS
from scan_impressions import IMPRESSION, ELEMENT_TERMS

KNOWN_TERMS = set()
for k in list(IX_PATTERNS) + list(ELEMENT_TERMS):
    KNOWN_TERMS.add(k.split('/')[-1])
KNOWN_TERMS |= {'도화살', '역마살', '화개살', '양인살', '홍염살', '괴강살', '백호대살', '귀문관살',
                '천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '문곡귀인', '학당귀인', '삼기귀인',
                '금여록', '암록', '협록', '현침살', '천라지망살', '원진살', '공망', '삼재'}
NEW_TERM_RX = re.compile(r'[가-힣]{1,4}(?:살|귀인)|[가-힣]{2,3}(?:격|귀문|입묘)')

def vid_of(arg):
    m = re.search(r'(?:v=|youtu\.be/|shorts/)([\w-]{11})', arg)
    return m.group(1) if m else (arg if re.fullmatch(r'[\w-]{11}', arg) else None)

def json3_to_text(path):
    d = json.load(open(path, encoding='utf-8'))
    parts = []
    for ev in d.get('events', []):
        for seg in ev.get('segs', []) or []:
            t = seg.get('utf8', '')
            if t.strip():
                parts.append(t)
    text = ''.join(parts)
    return re.sub(r'\n+', ' ', text)

def get_transcript(vid):
    fp = os.path.join(YT_TXT, vid + '.txt')
    if os.path.exists(fp):
        return open(fp, encoding='utf-8', errors='replace').read(), '코퍼스 보유'
    out = os.path.join(SCRATCH, f'nv_{vid}')
    r = subprocess.run(['yt-dlp', '--skip-download', '--write-auto-subs', '--write-subs',
                        '--sub-langs', 'ko', '--sub-format', 'json3', '-o', out + '.%(ext)s',
                        f'https://www.youtube.com/watch?v={vid}'],
                       capture_output=True, text=True, timeout=180)
    subs = glob.glob(out + '*.json3')
    if not subs:
        return None, 'yt-dlp 자막 수신 실패: ' + r.stderr.strip()[-200:]
    return json3_to_text(subs[0]), '신규 수신'

def main():
    args = [a for a in sys.argv[1:] if a != '--save']
    vid = vid_of(args[0]) if args else None
    if not vid:
        print('사용: python check_new_video.py <URL|vid>'); sys.exit(1)

    text, how = get_transcript(vid)
    if not text:
        print(how); sys.exit(1)
    paras = [text[i:i + 800] for i in range(0, len(text), 800)]
    print(f'영상 {vid}: 자막 {len(text):,}자 ({how})\n')

    ix = json.load(open(os.path.join(KB, 'interaction_index.json'), encoding='utf-8'))
    im = json.load(open(os.path.join(KB, 'impression_index.json'), encoding='utf-8'))
    coverage = {**{k: v['count'] for k, v in ix.items()}, **{k: v['count'] for k, v in im.items()}}

    topic_hits = {}
    for key, rx in {**IX_PATTERNS, **ELEMENT_TERMS}.items():
        n = sum(1 for p in paras if rx.search(p))
        if n:
            topic_hits[key] = n
    thin_hits = {k: n for k, n in topic_hits.items() if coverage.get(k, 0) < 5}

    new_terms = {}
    for m in NEW_TERM_RX.finditer(text):
        t = m.group(0)
        if t not in KNOWN_TERMS and len(t) >= 3:
            new_terms[t] = new_terms.get(t, 0) + 1
    new_terms = {t: c for t, c in sorted(new_terms.items(), key=lambda x: -x[1]) if c >= 2}

    print('=== 다루는 주제 (우리 DB 커버리지 대비) ===')
    for k, n in sorted(topic_hits.items(), key=lambda x: -x[1])[:15]:
        print(f'  {n:3d}회  {k}  (DB 기존 {coverage.get(k, 0)}문단)')
    print(f'\n=== 신규 신호 ===')
    print(f'  얇은 키 적중: {list(thin_hits) or "없음"}')
    print(f'  사전에 없는 용어 후보(2회+): {list(new_terms.items())[:10] or "없음"}')

    score = len(thin_hits) * 3 + len(new_terms) * 2 + (1 if len(topic_hits) >= 8 else 0)
    verdict = '높음' if score >= 6 else '중간' if score >= 2 else '낮음(기존과 중복)'
    print(f'\n판정: 수집 가치 {verdict} (신호 점수 {score})')
    if '--save' in sys.argv and how == '신규 수신' and score >= 2:
        open(os.path.join(YT_TXT, vid + '.txt'), 'w', encoding='utf-8').write(text)
        print(f'저장: fulltext/{vid}.txt (yt_filter.py 재실행으로 색인 반영)')

if __name__ == '__main__':
    main()
