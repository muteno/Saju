import io, glob, sys, unicodedata
BASE = "/Users/hwang/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1/"
fs = sorted(glob.glob(BASE + "*.md"))
step = 5
for idx in [int(x) for x in sys.argv[1:]]:
    f = fs[idx-1]
    name = unicodedata.normalize("NFC", f.split("/")[-1])
    L = io.open(f, encoding="utf-8-sig").read().splitlines()
    print("===== IDX %d | %s | NLINES %d" % (idx, name, len(L)))
    i = 13
    while i < len(L):
        blk = [x.strip() for x in L[i:i+step]]
        print("%d>%s" % (i+1, " / ".join(b for b in blk if b)))
        i += step
    print("===== END IDX %d (last line %d)" % (idx, len(L)))
