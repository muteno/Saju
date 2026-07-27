# 줄 구분자 좌표계 불일치 스캔: Read/\n 기준 vs Python splitlines() 기준
from pathlib import Path
SNAP = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리\webtxt_v1")
SPECIAL = {" ": "U+2028 LINE SEP", " ": "U+2029 PARA SEP", "\x0b": "VT", "\x0c": "FF",
           "\x85": "NEL", "\x1c": "FS", "\x1d": "GS", "\x1e": "RS"}
bad = 0
for f in sorted(SNAP.glob("*.txt")):
    t = f.read_text(encoding="utf-8")
    n_nl = len(t.split("\n"))
    if t.endswith("\n"): n_nl -= 1
    n_sl = len(t.splitlines())
    hits = {v: t.count(k) for k, v in SPECIAL.items() if k in t}
    if hits or n_nl != n_sl:
        bad += 1
        locs = []
        for k, v in SPECIAL.items():
            if k in t:
                for i, L in enumerate(t.split("\n"), 1):
                    if k in L: locs.append(f"{v}@{i}줄")
        print(f"!! {f.name}: \\n기준 {n_nl} vs splitlines {n_sl} · {hits} · {locs[:6]}")
print(f"\n영향 파일 {bad} / 76")
