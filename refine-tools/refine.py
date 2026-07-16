# -*- coding: utf-8 -*-
r"""글모음 docx 정제기 — 원본은 그대로 두고 ..\정제본\ 에 정제본 생성.

제거 대상(본문 문단만; 표지/목차/글제목(Heading1)/소제목(Heading2)/메타줄은 유지):
  greeting  반복 인사말·맺음말 (안녕하세요/현묘 올림/에디터 초명/감사합니다 등)
  donate    후원·기부 안내 블록 (계좌/기부명세서/정성 호소)
  promo     강의 판매·수강 모집·할인·프로모션·이벤트
  subscribe 뉴스레터·멤버십·채널 구독 유도
  share     하트·공감·좋아요 클릭 유도
  linkjunk  관련글 날짜링크·URL 단독 라인·"관련자료링크"류·이미지 클릭 안내
이모지: 전체 텍스트에서 제거(★☆·화살표·원문자·한자는 보존). 제거 후 빈 문단은 삭제.

안전장치: 본문 제거율 40% 초과 문서(안내문 성격)는 light 모드(이모지+URL 잔재만)로 재처리하고 리포트에 표시.

사용법: python refine.py [--dry]   (--dry: 파일 생성 없이 제거 내역만 리포트)
"""
import zipfile, re, sys, os, glob, html
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)                     # ...\새 폴더
OUT = os.path.join(SRC, '정제본')
REPORT = os.path.join(OUT, '정제 리포트.md')

# ---------------- 제거 패턴 ----------------
P = [
 # greeting -----------------------------------------------------------------
 ('greeting', r'^안녕하세요[.,!~\s]*$'),
 ('greeting', r'^[\"“”\']*안녕,?\s*사주명리[\"“”\']*의\s*[\'"]?현묘[\'"]?입니다'),
 ('greeting', r'^(그 빛이 길이 되는 )?명리상담센터.{0,15}(상담사)?.{0,10}(북극성|도화도르).{0,5}입니다'),
 ('greeting', r'^.{0,20}(현묘|도화도르|북극성)[\'"]?\s?(올림|입니다|이었습니다)[.,!\s]*$'),
 ('greeting', r'^안녕하세요[.,]?\s*사주공부입니다'),
 ('greeting', r'^[\"“”\']*사주명리의 첫걸음,?\s*초코서당[\"“”\']*의?\s*$'),
 ('greeting', r'^에디터 초명(입니다|이었습니다)[.,!\s]*$'),
 ('greeting', r'^지금까지,$'),
 ('greeting', r'^감사합니다[.,!\s]*$|^고맙습니다[.,!\s]*$'),
 ('greeting', r'^두\s?손 모아[.,\s]*$'),
 ('greeting', r'^(모두 |저와 같이 모두 )?파이팅입니다[.!\s]*$'),
 ('greeting', r'^이번 \S{1,6}월?[,\s].{0,10}(모두 )?파이팅'),
 ('greeting', r'^오늘도 저와 함께 사주명리를 공부하.{0,20}감사드립니다'),
 ('greeting', r'^혹시라도 글에 오타가 있거나'),
 ('greeting', r'^오늘은 여기까지'),
 ('greeting', r'^다음 (글|편|시간)(에서|에)? (또 )?(뵙|만나|찾아뵙)'),
 # donate --------------------------------------------------------------------
 ('donate', r'후원\s?계좌|기부명세서|후원내역|후원금|후원 방법'),
 ('donate', r'^글을 재밌게 읽으셨다면'),
 ('donate', r'^현묘와 함께 덕을 쌓고'),
 ('donate', r'한국미혼모지원네트워크'),
 # promo ---------------------------------------------------------------------
 ('promo', r'수강생 모집|수강 ?신청|수강 ?연장|수강권|모집합니다|모집 중'),
 ('promo', r'\d기 (기본과정|수강|모집|파이팅)'),
 ('promo', r'셀프 ?사주 ?리딩 (클래스|하세요)|사주 ?리딩 클래스|클래스메이트|얼리버드|커리큘럼 확인'),
 ('promo', r'강의 (구매|신청|바로가기|보러가기|오픈|안내)|클래스 (신청|오픈)'),
 ('promo', r'프로모션|할인|특가|쿠폰|이벤트 (참여|안내|중)|재고 (수량 )?소진|한정 수량'),
 ('promo', r'Mega\s?Big|Big ?4|역대급 혜택|큰 혜택|혜택 [①-⑳\d]'),
 ('promo', r'^[①-⑳✨▶\-\s]*(매일 )?(한정|특가|할인|증정|무료 (제공|증정)|혜택|사은품)'),
 ('promo', r'VOD 수강|개강\)|안내문\(|수강후기 모음'),
 ('promo', r'베이비페어|굿즈|박람회 (안내|참가)'),
 # subscribe -------------------------------------------------------------------
 ('subscribe', r'뉴스레터|도화지 (신청|구독)|무료 구독|막차 놓치'),
 ('subscribe', r'메일로 (직접 )?(보내|받아)'),
 ('subscribe', r'멤버십'),
 ('subscribe', r'(카카오|카톡) ?(플러스)?(채널|친구)|오픈채팅'),
 ('subscribe', r'(유튜브|인스타(그램)?|블로그) ?(채널)? ?(구독|팔로우)'),
 ('subscribe', r'^1초 회원가입|회원 ?가입 시'),
 # share -----------------------------------------------------------------------
 ('share', r'하트[♡♥]?를? 클릭|공감.{0,4}(버튼|클릭)|좋아요와 구독|구독과 좋아요'),
 ('share', r'^↓아래에 있는'),
 ('share', r'이 글이 알려질 수 있습니다'),
 # linkjunk ----------------------------------------------------------------------
 ('linkjunk', r'^\d{4}[./-]\s?\d{1,2}[./-]\s?\d{1,2}\s*-\s*\['),      # 2019/06/19 - [카테고리] - 제목
 ('linkjunk', r'^(→\s*)?https?://\S+$'),
 ('linkjunk', r'^관련\s?(자료\s?링크|링크|동영상( ?자료)?|유튜브 동영상( ?자료)?)$'),
 ('linkjunk', r'^\[?이미지 클릭|이미지를? 클릭|클릭 시 .{0,12}(이동|신청)'),
 ('linkjunk', r'^▶.{0,30}(가기|후기|신청|보기|클릭|링크)'),
 ('linkjunk', r'^(위의?|아래의?)?\s?그림(으로|에서)?\s?(보면|살펴보면)[,.\s]*$'),
 ('linkjunk', r'^그림으로 보면 아래와 같습니다[.\s]*$'),
]
PATTERNS = [(c, re.compile(rx)) for c, rx in P]
LIGHT_ONLY = {'linkjunk'}   # light 모드에서 유지할 제거 카테고리 (URL 잔재만)
LIGHT_RX = [(c, rx) for c, rx in PATTERNS if c in LIGHT_ONLY and 'https?' in rx.pattern]

# 이모지 제거 (★☆ U+2605/6, 화살표, 원문자, 한자 보존)
EMOJI_RX = re.compile(
    '[' '\U0001F000-\U0001FAFF' '\U0001FB00-\U0001FFFF'
        '☀-☄' '☇-⛿' '✀-➿'
        '⬀-⬃' '⬅-⯿'   # ⬆⬇⭐⭕ 등 (2B04 보존할 이유 없음, 통째로)
        '️‍⃣' '‼⁉' '❤♡♥❣'
    ']+')

def strip_emoji(t):
    t = EMOJI_RX.sub('', t)
    return re.sub(r'  +', ' ', t)

PARA_RX = re.compile(r'<w:p\b.*?</w:p>', re.S)
T_RX = re.compile(r'(<w:t[^>]*>)([^<]*)(</w:t>)')

def para_text(p):
    return html.unescape(''.join(m.group(2) for m in T_RX.finditer(p)))

def strip_emoji_in_para(p):
    def fix(m):
        return m.group(1) + strip_emoji(m.group(2)) + m.group(3)
    return T_RX.sub(fix, p)

def classify(text):
    for cat, rx in PATTERNS:
        if rx.search(text):
            return cat
    return None

def refine_doc(path, light=False, exclude=()):
    """returns (new_xml, stats, removed_samples, body_count) — 문단만 제자리 치환, 그 외 노드 보존"""
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    state = {'h1': False}
    removed = Counter()
    samples = defaultdict(Counter)
    body_cnt = [0]
    rules = LIGHT_RX if light else [(c, rx) for c, rx in PATTERNS if c not in exclude]

    def repl(m):
        p = m.group(0)
        if 'Heading1' in p:
            state['h1'] = True
        text = para_text(p).strip()
        is_struct = (not state['h1']) or ('Heading1' in p) or ('Heading2' in p) or text.startswith('작성일 ')
        if state['h1'] and not is_struct:
            body_cnt[0] += 1
            for c, rx in rules:
                if rx.search(text):
                    removed[c] += 1
                    samples[c][text[:70]] += 1
                    return ''
        q = strip_emoji_in_para(p)
        if state['h1'] and not is_struct and not para_text(q).strip():
            removed['empty_after_emoji'] += 1
            return ''
        return q

    new_xml = PARA_RX.sub(repl, xml)
    return new_xml, removed, samples, body_cnt[0]

def main():
    dry = '--dry' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    docs = sorted(glob.glob(os.path.join(SRC, '*.docx')))
    rows, flagged = [], []
    global_samples = defaultdict(Counter)
    for path in docs:
        name = os.path.basename(path)
        exclude = ('donate',) if '미혼모 후원' in name else ()
        new_xml, removed, samples, body = refine_doc(path, exclude=exclude)
        total_removed = sum(removed.values())
        ratio = total_removed / body if body else 0
        mode = 'full'
        if ratio > 0.40:
            new_xml, removed, samples, body = refine_doc(path, light=True)
            mode = 'light'
            flagged.append((name, f'{ratio:.0%}'))
        for c, s in samples.items():
            global_samples[c].update(s)
        rows.append((name, body, sum(removed.values()), mode, dict(removed)))
        if not dry:
            src = zipfile.ZipFile(path)
            outp = os.path.join(OUT, name)
            with zipfile.ZipFile(outp, 'w', zipfile.ZIP_DEFLATED) as z:
                for item in src.infolist():
                    if item.filename == 'word/document.xml':
                        z.writestr('word/document.xml', new_xml.encode('utf-8'))
                    elif item.filename.endswith('/'):
                        z.writestr(item, b'')
                    else:
                        z.writestr(item, src.read(item.filename))
            src.close()
        print(f'[{mode}] {name}: 본문 {body}문단 중 {sum(removed.values())}건 제거', flush=True)

    # 리포트
    lines = ['# 정제 리포트 (2026-07-13)', '',
             f'- 대상: {len(docs)}개 문서 → `정제본\\` (원본 유지)',
             '- 기준: 광고·프로모션 / 구독·후원 유도 / 클릭 유도 / 링크·이미지 잔재 / 반복 인사말·맺음말 / 이모지',
             '- 표지·수록 글 목록·글 제목·소제목·메타줄은 유지, 본문 문단만 제거 대상',
             '']
    if flagged:
        lines += ['## light 모드 처리 (안내문 성격 — 제거율 40% 초과라 이모지·URL 잔재만 정리)', '']
        lines += [f'- {n} (전체 적용 시 제거율 {r})' for n, r in flagged] + ['']
    lines += ['## 문서별 제거 내역', '', '| 문서 | 본문 문단 | 제거 | 모드 |', '|---|---|---|---|']
    for name, body, rem, mode, detail in rows:
        lines.append(f'| {name} | {body} | {rem} | {mode} |')
    lines += ['', '## 카테고리별 최다 제거 라인 (상위 12)', '']
    for cat, cnt in global_samples.items():
        lines.append(f'### {cat}')
        for t, c in cnt.most_common(12):
            lines.append(f'- ({c}) {t}')
        lines.append('')
    os.makedirs(OUT, exist_ok=True)
    open(REPORT, 'w', encoding='utf-8').write('\n'.join(lines))
    total = sum(r[2] for r in rows)
    print(f'[done] {len(docs)}개 문서, 총 {total}건 제거{" (dry-run)" if dry else ""} → 리포트: {REPORT}', flush=True)

if __name__ == '__main__':
    main()
