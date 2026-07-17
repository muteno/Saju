# -*- coding: utf-8 -*-
"""자막 전량 수집기 — /feed v2 0단계 전용. **판단 금지 원칙**.

이 스크립트는 가치·신규성·중복을 판정하지 않는다. 영상 내 음성(자막)을 전량 긁어
스테이징에 쌓고, '수집 품질'만 기계적으로 보고한다. 판단은 시험 단계(주장 단위)의 몫.

- 기보유(fulltext/<vid>.txt) 영상은 재수신 생략, 그 파일을 스테이징에 복사.
- 자막 트랙 폴백: ko(수동+자동) → 원어 자동(en 등). 받은 트랙을 manifest에 기록.
- 플래그(전부 '수집 품질' 신호 — 가치 판단 아님):
    INCOMPLETE  분당 자수(cpm) < 200 — 자막 누락 의심, 수동 확인 대상
    NO_SUBS     자막 트랙 자체가 없음(멤버십·자막 꺼짐) — 목록에 남길 것
    THROTTLED   유튜브 429/봇확인 차단 — 자막 유무 판정 불가. 쿨다운 후 재실행 필수.
                (NO_SUBS로 오기록하면 수집기가 몰래 판단하는 셈이 된다 — 반드시 구분)
- 페이싱: yt-dlp --sleep-requests 1.5 + 영상 간 기본 6초(--sleep N). THROTTLED 감지 시
  나머지 목록 처리를 즉시 중단하고 미처리분을 보고한다(계속 두드리면 차단이 길어짐).

사용:
  python3 fetch_transcripts.py <URL|vid> [...] [--stage DIR] [--sleep N]
  python3 fetch_transcripts.py --list vids.txt [--stage DIR]   # 한 줄에 vid 하나(| 뒤는 무시)
출력: <stage>/<vid>.txt + <stage>/manifest.json (재실행 시 병합 — OK건은 재수신 생략)
"""
import json, os, re, shutil, subprocess, sys, glob, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
YT_TXT = os.path.join(ROOT, 'youtube-tools', 'book', 'fulltext')
sys.path.insert(0, HERE)
from check_new_video import json3_to_text, vid_of

CPM_MIN = 200
THROTTLE_RX = re.compile(r'429|Too Many Requests|Sign in to confirm', re.I)


class Throttled(Exception):
    pass


def fetch(vid, stage, langs):
    """영상당 1회 호출: 메타(--print) + 자막 저장(--no-simulate) 동시."""
    out = os.path.join(stage, f'_dl_{vid}')
    r = subprocess.run(['yt-dlp', '--skip-download', '--no-simulate',
                        '--write-auto-subs', '--write-subs', '--sub-langs', langs,
                        '--sub-format', 'json3', '--sleep-requests', '1.5',
                        '--print', '%(duration)s\t%(title)s',
                        '-o', out + '.%(ext)s',
                        f'https://www.youtube.com/watch?v={vid}'],
                       capture_output=True, text=True, timeout=300)
    if THROTTLE_RX.search(r.stderr):
        raise Throttled(r.stderr.strip()[-160:])
    dur, title = 0, ''
    line = (r.stdout.strip().split('\n') or [''])[-1]
    if '\t' in line:
        d, title = line.split('\t', 1)
        try:
            dur = int(float(d))
        except ValueError:
            pass
    subs = sorted(glob.glob(out + '*.json3'))
    return (subs[0] if subs else None), dur, title, r.stderr.strip()[-160:]


def collect(vid, stage):
    dst = os.path.join(stage, vid + '.txt')
    kept = os.path.join(YT_TXT, vid + '.txt')
    if os.path.exists(kept):
        shutil.copyfile(kept, dst)
        text = open(dst, encoding='utf-8', errors='replace').read()
        return {'vid': vid, 'title': '', 'duration': 0, 'chars': len(text),
                'cpm': None, 'track': '코퍼스 기보유', 'flags': []}
    text, track, dur, title, err = None, None, 0, '', ''
    for langs in ('ko,ko-orig', 'en.*,en-orig'):
        fp, dur, title, err = fetch(vid, stage, langs)
        if fp:
            text, track = json3_to_text(fp), os.path.basename(fp).split('.')[-2]
            for junk in glob.glob(os.path.join(stage, f'_dl_{vid}*')):
                os.remove(junk)
            break
    if text is None:
        return {'vid': vid, 'title': title, 'duration': dur, 'flags': ['NO_SUBS'], 'err': err}
    open(dst, 'w', encoding='utf-8').write(text)
    cpm = round(len(text) / (dur / 60), 1) if dur else None
    flags = ['INCOMPLETE'] if (cpm is not None and cpm < CPM_MIN) else []
    return {'vid': vid, 'title': title, 'duration': dur, 'chars': len(text),
            'cpm': cpm, 'track': track, 'flags': flags}


def main():
    args = sys.argv[1:]
    stage = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'feed_stage')
    gap = 6.0
    if '--stage' in args:
        i = args.index('--stage'); stage = args[i + 1]; del args[i:i + 2]
    if '--sleep' in args:
        i = args.index('--sleep'); gap = float(args[i + 1]); del args[i:i + 2]
    vids = []
    if '--list' in args:
        i = args.index('--list')
        vids = [l.split('|')[0].strip() for l in open(args[i + 1], encoding='utf-8') if l.strip()]
        del args[i:i + 2]
    vids += [v for v in (vid_of(a) for a in args) if v]
    if not vids:
        print(__doc__); sys.exit(1)
    os.makedirs(stage, exist_ok=True)
    mf_path = os.path.join(stage, 'manifest.json')
    manifest = json.load(open(mf_path, encoding='utf-8')) if os.path.exists(mf_path) else {}
    pending = [v for v in vids if manifest.get(v, {}).get('flags', ['?']) != []]
    done_ok = len(vids) - len(pending)
    if done_ok:
        print(f'(manifest에 OK {done_ok}편 — 재수신 생략)')
    aborted = None
    for n, v in enumerate(pending):
        try:
            m = collect(v, stage)
        except Throttled as e:
            aborted = pending[n:]
            print(f'\n⛔ THROTTLED at {v} — 유튜브 차단 감지, 나머지 {len(aborted)}편 중단. 쿨다운 후 재실행.')
            print(f'   {e}')
            manifest[v] = {'vid': v, 'flags': ['THROTTLED']}
            break
        manifest[v] = m
        print(f"{v}  {'/'.join(m['flags']) or 'OK':<10}  {m.get('chars', 0):>7,}자  "
              f"cpm={m.get('cpm') or '-'}  [{m.get('track', '-')}]  {m.get('title', '')[:40]}")
        if n < len(pending) - 1:
            time.sleep(gap)
    json.dump(manifest, open(mf_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = sorted(v for v, m in manifest.items() if m.get('flags'))
    print(f"\n스테이징: {stage}  |  manifest {len(manifest)}편, 플래그: {bad or '없음'}")
    if aborted:
        sys.exit(3)


if __name__ == '__main__':
    main()
