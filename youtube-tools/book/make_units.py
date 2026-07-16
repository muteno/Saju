# -*- coding: utf-8 -*-
"""308개 자막 → 분류용 units + 존별 shard + 전문(fulltext) 스테이징.
reference(refine-tools/units.json)와 동일한 title+snippet 분류 방식."""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()          # .../youtube-tools/book
YT = HERE.parent                                 # .../youtube-tools
sys.path.insert(0, str(YT))
from to_text import json3_to_paragraphs

RAW = YT / "raw"
SUB_VARIANTS = ("ko", "ko-orig", "ko-KR")
GREET = re.compile(r'^\s*(네[.,~\s]*)?(안녕하세요[^.!?]{0,40}[.!?]\s*)?(반갑습니다[^.!?]{0,20}[.!?]\s*)?')


def sub_path(vid):
    for s in SUB_VARIANTS:
        p = RAW / f"{vid}.{s}.json3"
        if p.exists():
            return p
    return None


def snippet_of(paras, n=1200):
    text = " ".join(paras)
    text = GREET.sub("", text, count=1).strip()
    return text[:n]


def main():
    master = json.load(open(YT / "master.json", encoding="utf-8"))
    all_ids = master["all_ids"]
    pl_of = {vid: pl.get("title", "")
             for pl in master.get("playlists", {}).values()
             for vid in pl.get("ids", [])}

    (HERE / "shards").mkdir(parents=True, exist_ok=True)
    (HERE / "fulltext").mkdir(parents=True, exist_ok=True)

    units = []
    for vid in all_ids:
        sp = sub_path(vid)
        if not sp:
            continue
        paras = json3_to_paragraphs(str(sp))
        nchars = sum(len(p) for p in paras)
        if nchars == 0:
            continue
        ip = RAW / f"{vid}.info.json"
        i = json.load(open(ip, encoding="utf-8")) if ip.exists() else {}
        units.append({
            "vid": vid,
            "title": i.get("title") or "",
            "channel": i.get("channel") or i.get("uploader") or "",
            "date": i.get("upload_date") or "",
            "dur": i.get("duration_string") or "",
            "url": i.get("webpage_url") or f"https://www.youtube.com/watch?v={vid}",
            "playlist": pl_of.get(vid, ""),
            "nchars": nchars,
            "nparas": len(paras),
            "snippet": snippet_of(paras),
        })
        # 전문 스테이징 (검수자 심층확인용)
        (HERE / "fulltext" / f"{vid}.txt").write_text("\n\n".join(paras), encoding="utf-8")

    json.dump(units, open(HERE / "yt_units.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 존/샤드 분할: 앞 절반 = 1구역, 뒤 절반 = 2구역, 각 존을 10샤드로
    n = len(units)
    half = (n + 1) // 2
    zones = {1: units[:half], 2: units[half:]}
    manifest = {"total": n, "zones": {}}
    for z, zu in zones.items():
        k = 10
        shards = [zu[j::k] for j in range(k)]  # 라운드로빈(채널 균형)
        manifest["zones"][z] = []
        for a, sh in enumerate(shards):
            # 분류에 필요한 필드만 (프롬프트 경량화)
            slim = [{"vid": u["vid"], "title": u["title"], "channel": u["channel"],
                     "dur": u["dur"], "snippet": u["snippet"]} for u in sh]
            fn = f"shards/z{z}_a{a:02d}.json"
            json.dump(slim, open(HERE / fn, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            manifest["zones"][z].append({"shard": fn, "count": len(slim),
                                          "vids": [u["vid"] for u in slim]})
    json.dump(manifest, open(HERE / "manifest.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"units: {n}")
    print(f"zone1: {len(zones[1])}  zone2: {len(zones[2])}")
    for z in (1, 2):
        counts = [s['count'] for s in manifest['zones'][z]]
        print(f"  zone{z} shards: {counts}  (sum {sum(counts)})")
    # 채널 상위
    from collections import Counter
    ch = Counter(u["channel"] for u in units)
    print("상위 채널:", ch.most_common(8))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
