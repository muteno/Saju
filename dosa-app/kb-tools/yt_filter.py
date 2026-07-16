# -*- coding: utf-8 -*-
"""유튜브 자막 코퍼스에서 명리 강의만 선별 + 주제 버킷 분류 → kb/yt_saju.json

기준:
  1) 명리 전문 채널(초코서당·도화도르·포스텔러)은 전량 채택
  2) 그 외 채널은 제목에 명리 키워드가 있을 때만 '기타역학/무속' 여부 표기해 채택
  3) 주제 버킷(복수 허용): 통변방법론 / 십성 / 오행조후 / 간지론 / 신살 / 운세 / 실전사례 / 담론
실행: python yt_filter.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'youtube-tools', 'book', 'yt_units.json')
OUT = os.path.join(HERE, '..', 'kb', 'yt_saju.json')

SAJU_CHANNELS = ['초코서당(초명)', '도화도르- 사주팔자 쉽게 풀어주는 남자', '포스텔러 FORCETELLER']
SAJU_KW = re.compile(r'사주|일간|일주|운세|명리|만세력|십성|십신|오행|천간|지지|신살|대운|궁합|도화살|화개|역마|홍염|백호|귀문|용신|식상|재성|관성|인성|비견|겁재|편재|정재|편관|정관|편인|정인|간지|병오년|을사년')
FOLK_KW = re.compile(r'만신|신령|무당|천명도사|자미두수|타로|점집')

TOPIC_RULES = [
    ('통변방법론', r'풀이하는 순서|실전 사주풀이|내 사주 내가 보기|사주 ?보는 ?법|보는법|중화|신강|신약|전왕|기구신|용신|투간|투출|통근|치우친 사주|숨은 힘|대운.*(해석|핵심|보기)|원국|접근법|리딩법|혼자 사주'),
    ('십성', r'비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|십성|식상|재성|관성|인성|무관성|무식상|무재|관살혼잡|식재'),
    ('오행조후', r'오행|목\(木\)|화\(火\)|토\(土\)|금\(金\)|수\(水\)|겨울생|한겨울|조후|금백수청|목화통명|병존|불이 위험|화 기운|수 기운|화 운|깨진 오행|없는 오행|특정 오행'),
    ('간지론', r'천간|지지|지장간|체용|일지|갑목|을목|병화|정화|무토|기토|경금|신금|임수|계수|진토|사화|오화|해수|자수|60갑자|갑진|정미|계축|갑자'),
    ('신살', r'신살|도화|화개|역마|홍염|백호|귀문|천을귀인|귀인|길신|길살|공망|삼형|양인|괴강|기 ?센|기쎈'),
    ('운세', r'병오년|을사년|신년운세|[0-9]+월 ?운세|월별|재물운|연애운|이성운|진로운|취업|합격|하반기|상반기|캘린더'),
    ('실전사례', r'윤석열|김건희|트럼프|이재명|백종원|뉴진스|민희진|비\(정지훈\)|이건희|손정의|연예인|대통령|국운'),
    ('담론', r'결정론|양자역학|챗GPT|거짓말|사주는 없다|품평|출산택일|인생을 결정|믿|과학'),
]

def main():
    units = json.load(open(SRC, encoding='utf-8'))
    out = []
    for x in units:
        title, ch = x['title'], x['channel']
        is_pro = ch in SAJU_CHANNELS
        kw = bool(SAJU_KW.search(title))
        if not is_pro and not kw:
            continue
        folk = bool(FOLK_KW.search(title)) or (not is_pro and kw)
        topics = [name for name, pat in TOPIC_RULES if re.search(pat, title)]
        out.append({
            'vid': x['vid'], 'title': title, 'channel': ch, 'nchars': x['nchars'],
            'grade': 'core' if is_pro else 'folk_etc',  # core=명리 전문, folk_etc=무속·타채널(관점 병기용)
            'topics': topics or ['미분류'],
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    from collections import Counter
    tc = Counter(t for x in out for t in x['topics'])
    core = [x for x in out if x['grade'] == 'core']
    print(f"채택 {len(out)}편 (core {len(core)}, folk_etc {len(out)-len(core)}) / 전체 {len(units)}편")
    print(f"core 총 {sum(x['nchars'] for x in core)/1e6:.2f}M자")
    for t, c in tc.most_common():
        print(f'  {t:8s} {c:3d}편')
    print('\n=== 통변방법론 core 목록 ===')
    for x in out:
        if '통변방법론' in x['topics'] and x['grade'] == 'core':
            print(f"  - {x['title'][:60]}")

if __name__ == '__main__':
    main()
