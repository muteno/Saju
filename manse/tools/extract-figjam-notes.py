#!/usr/bin/env python3
# extract-figjam-notes.py — FigJam(.jam) → manse/db/figjam_notes.json 생성기
# 원칙: DB는 파생물. 원본은 레포 루트의 FigJam 파일(운영자 본인 정리본). 재실행으로 갱신.
#   실행: python3 manse/tools/extract-figjam-notes.py "<figjam.jam 경로>"
#   개인정보(팀원 실명 사주 명부)는 제외. 명시 인용(출처:)만 source 필드로 표기. 전 항목 참고용.
import sys, re, json, zipfile, io, zstandard

def load_canvas(jam_path):
    with zipfile.ZipFile(jam_path) as z:
        raw = z.read("canvas.fig")
    off = 12
    n1 = int.from_bytes(raw[off:off+4], "little"); p2 = off+4+n1
    n2 = int.from_bytes(raw[p2:p2+4], "little")
    return zstandard.ZstdDecompressor().decompress(raw[p2+4:p2+4+n2], max_output_size=200_000_000)

NAMES = {"황세웅","이수영","고아라","김해진","최희원","배도연","황승준","한상범",
         "강명희","문지혜","박필규","박은필","박민주","아라형님","팀원 사주"}
is_person = lambda r: any(r.startswith(n) for n in NAMES) or bool(re.match(r"^[가-힣]{2,4}\s*\d+$", r))

CATS = {
 "십신": ["비견","겁재","식신","상관","편재","정재","편관","정관","편인","정인","인성","재성","관성","식상","비겁"],
 "격국패턴": ["관인상생","살인상생","식상생재","재다신약","군겁쟁재","군비쟁재","상관견관","관살혼잡","간여지동","양인","건록격","종격","탐재괴인"],
 "합충론": ["삼합","방합","육합","반합","합신","합거","충","형","파","해","원진","귀문"],
 "궁위론": ["근묘화실","궁성","초년","중년","말년","배우자궁","사회궁","궁위"],
 "십이운성": ["장생","목욕","관대","제왕","십이운성","포태","건록","묘지","절지","태지"],
 "신살": ["역마","도화","화개","공망","백호","괴강","천을귀인","귀문관","원진살","양인살"],
 "천간론": ["갑목","을목","병화","정화","무토","기토","경금","신금","임수","계수"],
 "지지론": ["생지","왕지","고지","지장간","통근","투출","투간","병존"],
 "용신론": ["용신","억부","조후","통관","기신","희신","한신"],
}

def main():
    jam = sys.argv[1] if len(sys.argv) > 1 else "Untitled (1).jam"
    txt = load_canvas(jam).decode("utf-8", "ignore")
    runs = [r.strip() for r in re.findall(r"[가-힣][가-힣A-Za-z0-9 \t\.\,\!\?\-\(\)\[\]\/\+%:~·…'\"→↔><=#&*∙‧ㆍ；;]{2,600}", txt)]
    seen, buckets = set(), {k: [] for k in CATS}
    for r in sorted(set(runs), key=len, reverse=True):  # 긴 것 우선 → 조각(prefix) 흡수
        if len(r) < 25 or is_person(r):
            continue
        if any(r != x and x.startswith(r) for x in seen):
            continue
        for cat, kws in CATS.items():
            if any(k in r for k in kws):
                buckets[cat].append(r); seen.add(r); break
    src = lambda r: (re.search(r"출처[:：]?\s*([^\n]{3,40})", r) or [None, None])[1]
    out = {}
    for cat, arr in buckets.items():
        items = []
        for r in sorted(arr)[:40]:
            s = src(r); body = re.sub(r"\s*출처[:：].*$", "", r).strip()
            it = {"note": body[:380]}
            if s: it["source"] = s.strip()
            items.append(it)
        out[cat] = items
    meta = {"name": "FigJam 해석 노트", "version": 1,
            "source": "운영자 본인 정리(강의 요약) — 명시 인용만 source 표기",
            "generator": "manse/tools/extract-figjam-notes.py",
            "note": "개인정보(팀원 실명 명부) 제외. 전 항목 참고용(단정 금지)."}
    json.dump({"meta": meta, "data": out},
              open("manse/db/figjam_notes.json", "w"), ensure_ascii=False, indent=1)
    print("카테고리별:", {k: len(v) for k, v in out.items()}, "| 총", sum(len(v) for v in out.values()))

if __name__ == "__main__":
    main()
