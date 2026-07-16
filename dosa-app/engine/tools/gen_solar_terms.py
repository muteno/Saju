# -*- coding: utf-8 -*-
"""절기표 생성기 — JPL DE440s 천체력으로 1900~2100년 24절기 절입 시각(UTC) 계산.

태양의 겉보기 황경(진황도·분점 of date, 광행차 포함)이 15° 배수를 지나는 순간을
skyfield find_discrete로 찾는다. 정밀도는 초 이하 (만세력 용도로 충분).

출력: ../data/solar_terms.json
  { "range": [1900, 2100], "terms": [[epochMs(UTC), k], ...] }
  k = 황경/15 (0=춘분, 21=입춘, ... 아래 NAMES 참조). 시간순 정렬.

실행: python gen_solar_terms.py   (최초 1회 de440s.bsp ~32MB 다운로드)
"""
import json, os, sys
from skyfield import api
from skyfield.searchlib import find_discrete
from skyfield.framelib import ecliptic_frame

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data', 'solar_terms.json')

# k(황경/15) → 절기명. 월주 경계가 되는 12절(節)은 월지와 함께 표기.
NAMES = {
    0: '춘분', 1: '청명', 2: '곡우', 3: '입하', 4: '소만', 5: '망종',
    6: '하지', 7: '소서', 8: '대서', 9: '입추', 10: '처서', 11: '백로',
    12: '추분', 13: '한로', 14: '상강', 15: '입동', 16: '소설', 17: '대설',
    18: '동지', 19: '소한', 20: '대한', 21: '입춘', 22: '우수', 23: '경칩',
}

def main():
    ts = api.load.timescale()
    eph = api.load('de440s.bsp')  # 1849–2150 커버
    earth, sun = eph['earth'], eph['sun']

    def term_index(t):
        lon = earth.at(t).observe(sun).apparent().frame_latlon(ecliptic_frame)[1].degrees
        return (lon // 15.0).astype(int) % 24
    term_index.step_days = 5.0

    events = []
    # 10년 단위 청크로 탐색 (경계 누락 방지 위해 약간 겹침)
    for y0 in range(1900, 2101, 10):
        y1 = min(y0 + 10, 2101)
        t0 = ts.utc(y0, 1, 1)
        t1 = ts.utc(y1, 1, 5)
        times, values = find_discrete(t0, t1, term_index)
        for t, k in zip(times, values):
            ms = int(round(t.utc_datetime().timestamp() * 1000))
            events.append((ms, int(k)))

    # 청크 겹침으로 생긴 중복 제거 + 정렬
    events = sorted(set(events))
    # 연속 이벤트 간 간격 검증 (14~17일)
    for (a, ka), (b, kb) in zip(events, events[1:]):
        gap = (b - a) / 86400000
        assert 13.5 < gap < 17.5, f'간격 이상 {gap:.2f}일 @ {a}'
        assert kb == (ka + 1) % 24, f'순서 이상 {ka}->{kb}'
    # 2101년 초 이벤트는 잘라냄 (2100년 대설/동지 이후는 2101 소한 — 대운 계산용으로 소한까지 유지)
    print(f'절기 이벤트 {len(events)}개 ({events[0]} ~ {events[-1]})')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'range': [1900, 2100], 'names': NAMES, 'terms': [list(e) for e in events]}, f,
                  ensure_ascii=False, separators=(',', ':'))
    print('저장:', os.path.normpath(OUT))

    # 상식 검증 출력: 최근 몇 해 입춘(k=21) KST 시각
    import datetime
    KST = datetime.timezone(datetime.timedelta(hours=9))
    for ms, k in events:
        d = datetime.datetime.fromtimestamp(ms / 1000, KST)
        if k == 21 and d.year in (1990, 2000, 2024, 2025, 2026):
            print(f'입춘 {d:%Y-%m-%d %H:%M} KST')

if __name__ == '__main__':
    main()
