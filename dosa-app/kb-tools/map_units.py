# -*- coding: utf-8 -*-
"""유닛 → 요소 키 매핑 (L2 지식 베이스의 색인 생성).

refine-tools/units.json(2,504유닛)의 제목·문서명을 규칙 기반으로 파싱해
사주 데이터 키(ilju/갑자, sipsin/편관, sinsal/역마살 …) → 유닛 목록 색인을 만든다.
검색이 아니라 제목의 명시적 요소명만 사용 — 애매하면 매핑하지 않고 unmapped 리포트에 남긴다.

실행: python map_units.py   → ../kb/unit_index.json, ../kb/unmapped_report.md
"""
import json, os, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
UNITS = os.path.join(ROOT, 'refine-tools', 'units.json')
OUT_DIR = os.path.join(HERE, '..', 'kb')

STEMS = '갑을병정무기경신임계'
BRANCHES = '자축인묘진사오미신유술해'
GANJI = re.compile(f'([{STEMS}][{BRANCHES}])')
ILJU = re.compile(f'([{STEMS}][{BRANCHES}])일주')
SIPSIN = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인']
SIPSIN_GROUP = ['비겁', '식상', '재성', '관성', '인성']
UNSEONG = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양']
YEAR_DOC = re.compile(r'^(\d{4})년 ([가-힣]{2})년 운세 글모음$')

# 명리 이론 매핑에서 제외할 문서 (기타역학·사용설명서·비이론)
EXCLUDE_PREFIX = ('dang-', 'face-', 'gusung-', 'hand-', 'mehwa-', 'name-', 'pungsu-', 'taro-', 'tojung-')
EXCLUDE_CONTAINS = ('만세력사용설명서', '운세력사용설명서', '플러스작명', '택일기타', '미혼모', '파이브시즌스',
                    '무료상담', '사주공부-공지', '초코서당-상담', '초코서당-수강', '초코서당-일상',
                    '기타자료', '유용한자료', '사주공부-사공')

# 정식 신살명 사전 (긴 이름 우선 — 매칭된 구간은 마스킹해 중복 방지)
SINSAL_CANON = sorted([
    '백호대살', '괴강살', '귀문관살', '천라지망살', '천을귀인', '천덕귀인', '월덕귀인', '삼기귀인',
    '문창귀인', '문곡귀인', '학당귀인', '태극귀인', '복성귀인', '금여록', '협록', '암록', '십간록',
    '천의성', '천문성', '월공', '홍염살', '현침살', '양인살', '도화살', '역마살', '화개살',
    '장성살', '반안살', '망신살', '육해살', '십이신살', '겁살', '재살', '천살', '지살', '년살', '월살',
    '공망', '삼재', '금여',
], key=len, reverse=True)

def scan_sinsal(title):
    t, found = title, []
    for name in SINSAL_CANON:
        if name in t:
            found.append(name)
            t = t.replace(name, '□' * len(name))
    return found

# 신살 전문 문서의 개론성 제목("손 없는 날", "천의성, 천문성") 폴백: 괄호·부제 제거 후 첫 토큰
def sinsal_fallback_key(title):
    t = re.sub(r'\(.*?\)', '', title).strip()
    t = re.split(r'[,·/]| {2,}| — | - ', t)[0].strip().replace(' ', '')
    return t or None

def main():
    units = json.load(open(UNITS, encoding='utf-8'))
    index = defaultdict(list)
    unmapped = defaultdict(list)

    def add(k, u):
        index[k].append({'key': u['key'], 'doc': u['doc'], 'title': u['title']})

    for u in units:
        doc, title = u['doc'], u['title']
        mapped = False

        # 1) 연도별 운세: unse/<년간지> (+ 일주별이면 /ilju/<간지>)
        ym = YEAR_DOC.match(doc)
        if ym:
            yg = ym.group(2)
            m = ILJU.search(title)
            add(f'unse/{yg}/ilju/{m.group(1)}' if m else f'unse/{yg}/general', u)
            continue

        # 기타역학·설명서·비이론 문서는 명리 이론 키 매핑에서 제외
        if doc.startswith(EXCLUDE_PREFIX) or any(k in doc for k in EXCLUDE_CONTAINS):
            continue

        # 2) 일주론 (연도 운세 제외 전 문서에서 XX일주 제목)
        m = ILJU.search(title)
        if m:
            add(f'ilju/{m.group(1)}', u); mapped = True

        # 3) 천간·지지 — 한자 괄호로 확정 판별 (신(辛)↔신(申) 동명 구분)
        if '천간' in doc or '지지' in doc:
            HANJA_STEM = dict(zip('甲乙丙丁戊己庚辛壬癸', STEMS))
            HANJA_BRANCH = dict(zip('子丑寅卯辰巳午未申酉戌亥', BRANCHES))
            for hz in re.findall(r'\(([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])\)', title):
                if hz in HANJA_STEM: add(f'cheongan/{HANJA_STEM[hz]}', u); mapped = True
                else: add(f'jiji/{HANJA_BRANCH[hz]}', u); mapped = True
            if not mapped:
                # 한자 없는 조합 제목: "갑목, 을목 – …", "무토, vs 기토 – …"
                for st in re.findall(f'([{STEMS}])[목화토금수](?=[\\s,–-]|이란|란)', title):
                    add(f'cheongan/{st}', u); mapped = True
            # 생지/왕지/고지 그룹 글 → 광의 도화·역마·화개의 근거로도 쓰임
            for grp in ['인신사해', '자오묘유', '진술축미']:
                if grp in title:
                    add(f'jiji-group/{grp}', u); mapped = True

        # 4) 십신 (전 문서: 제목에 명시된 십신명)
        hits = [s for s in SIPSIN if s in title]
        if hits and '운세' not in doc:
            for s in hits: add(f'sipsin/{s}', u)
            mapped = True
        ghits = [g for g in SIPSIN_GROUP if re.search(f'{g}[(\\s이란]', title)]
        if ghits and '운세' not in doc:
            for g in ghits: add(f'sipsin-group/{g}', u)
            mapped = True

        # 5) 십이운성 (해당 문서에서만 — 병·사·묘 등 한 글자 오탐 방지)
        if '십이운성' in doc or '십이운성' in title:
            for s in UNSEONG:
                if re.search(f'[ ,>]{s}\\(', title) or title.endswith(s):
                    add(f'sibiunseong/{s}', u); mapped = True

        # 6) 신살 — 전 명리 문서에서 정식 신살명 스캔 (복합 제목은 다중 매핑)
        hits_ss = scan_sinsal(title)
        if hits_ss:
            for name in hits_ss:
                add(f'sinsal/{name}', u)
            mapped = True
        elif re.search(r'신살', doc) and not re.search(r'삼형|자형|상형|[합충]', title):
            k = sinsal_fallback_key(title)
            if k and len(k) >= 2:
                add(f'sinsal/{k}', u); mapped = True

        # 7) 합충형파해원진 (제목 명시)
        if '운세' not in doc:
            for pat, kind in [(r'삼합', '삼합'), (r'육합', '육합'), (r'방합', '방합'),
                              (r'(천간|지지)?\s*합', '합'), (r'(천간|지지)?\s*충', '충'),
                              (r'삼형|자형|상형|[가-힣]{2,3}\s*형(?:\(|이란)', '형'), (r'원진', '원진'),
                              (r'공망', '공망'), (r'\b파\(', '파'), (r'\b해\(', '해')]:
                if re.search(pat, title):
                    m5 = GANJI.search(title)
                    add(f'hapchung/{kind}' + (f'/{m5.group(1)}' if m5 else ''), u)
                    mapped = True
                    break

        # 8) 용신·원국
        if '용신' in doc or '원국' in doc:
            for kw in ['용신', '신강', '신약', '조후', '억부', '격국', '통근', '득령', '합거']:
                if kw in title:
                    add(f'yongsin/{kw}', u); mapped = True

        if not mapped:
            unmapped[doc].append(title)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {k: v for k, v in sorted(index.items())}
    with open(os.path.join(OUT_DIR, 'unit_index.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # 리포트
    lines = ['# 유닛 키 매핑 리포트\n']
    lines.append(f'- 총 유닛: {len(units)}')
    total_mapped_units = len({e["key"] for v in index.values() for e in v})
    lines.append(f'- 키 수: {len(out)}, 매핑된 유닛(중복 제거): {total_mapped_units}')
    lines.append('\n## 키 공간별 통계\n')
    from collections import Counter
    spaces = Counter(k.split('/')[0] for k in out)
    for s, c in spaces.most_common():
        n_units = sum(len(v) for k, v in out.items() if k.startswith(s + '/'))
        lines.append(f'- {s}: 키 {c}개, 유닛 {n_units}건')
    lines.append('\n## 요소 문서인데 매핑 안 된 제목 (수동 검토용)\n')
    focus = ['일주론', '천간과 지지', '십이운성', '신살', '십신과 합충', '원국', '초코서당-천간', '초코서당-신살', '초코서당-일주론', '초코서당-십성', '초코서당-합', '사주공부-신살론']
    for doc, titles in unmapped.items():
        if any(f in doc for f in focus):
            lines.append(f'### {doc} ({len(titles)})')
            for t in titles: lines.append(f'- {t}')
            lines.append('')
    with open(os.path.join(OUT_DIR, 'unmapped_report.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'키 {len(out)}개, 유닛 매핑 {total_mapped_units}/{len(units)}')
    for s, c in spaces.most_common():
        print(f'  {s:14s} 키 {c:3d}')

if __name__ == '__main__':
    main()
