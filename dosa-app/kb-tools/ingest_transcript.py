# -*- coding: utf-8 -*-
"""자막 정식 주입기 — /feed 4-c ⓐ 전용 (평의회 260717 발견① '주입 고아' 수선).

check_new_video.py --save의 두 결함을 대체한다:
  ① score<2면 무음 거부 — 시험 격차가 이미 주입을 승인했는데 구식 점수표가 재차 거부
  ② fulltext만 쓰고 yt_units.json 미등록 → yt_filter→scan 체인이 영영 색인하지 않음(고아)

동작: stage/<vid>.txt → youtube-tools/book/fulltext/<vid>.txt 복사
      + youtube-tools/book/yt_units.json 에 엔트리 append(멱등 — 같은 vid면 갱신)
      메타(title·duration)는 stage/manifest.json에서 취득, 채널은 --channel 인자.
이후 색인 반영은 별도 실행: yt_filter.py → scan_interactions.py → scan_impressions.py

사용: python3 ingest_transcript.py <vid> --stage <DIR> --channel "<채널명>" [--date YYYYMMDD]
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
FULL = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
UNITS = os.path.join(ROOT, 'youtube-tools', 'book', 'yt_units.json')


def mmss(sec):
    return f'{int(sec)//60}:{int(sec)%60:02d}' if sec else ''


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    vid = args[0]
    def opt(name, default=''):
        return args[args.index(name) + 1] if name in args else default
    stage = opt('--stage')
    channel = opt('--channel')
    date = opt('--date')
    src = os.path.join(stage, vid + '.txt')
    if not os.path.exists(src):
        print(f'✗ stage에 자막 없음: {src} — fetch_transcripts.py 먼저'); sys.exit(1)

    mf = {}
    mfp = os.path.join(stage, 'manifest.json')
    if os.path.exists(mfp):
        mf = json.load(open(mfp, encoding='utf-8')).get(vid, {})
    text = open(src, encoding='utf-8', errors='replace').read()
    paras = [l for l in text.split('\n') if len(l.strip()) > 15]

    os.makedirs(FULL, exist_ok=True)
    shutil.copyfile(src, os.path.join(FULL, vid + '.txt'))

    units = json.load(open(UNITS, encoding='utf-8'))
    entry = {
        'vid': vid,
        'title': mf.get('title', ''),
        'channel': channel,
        'date': date,
        'dur': mmss(mf.get('duration', 0)),
        'url': f'https://www.youtube.com/watch?v={vid}',
        'playlist': '',
        'nchars': len(text),
        'nparas': len(paras),
        'snippet': text[:80].replace('\n', ' '),
    }
    units = [u for u in units if u.get('vid') != vid] + [entry]
    json.dump(units, open(UNITS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'✓ 주입: fulltext/{vid}.txt ({len(text):,}자) + yt_units 등록(총 {len(units)}편)')
    print('  다음: python3 dosa-app/kb-tools/yt_filter.py && scan_interactions.py && scan_impressions.py')


if __name__ == '__main__':
    main()
