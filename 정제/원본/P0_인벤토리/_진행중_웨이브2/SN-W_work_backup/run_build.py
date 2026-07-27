# -*- coding: utf-8 -*-
import os, sys, importlib
WORK = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, WORK)
import build

MERGED = {}
found = []
for tag in ["M", "A", "B", "C", "D", "E"]:
    p = os.path.join(WORK, "spec_%s.py" % tag)
    if not os.path.exists(p):
        continue
    m = importlib.import_module("spec_%s" % tag)
    dup = set(m.SPEC) & set(MERGED)
    if dup:
        print("!! DUPLICATE IDX in spec_%s: %s" % (tag, sorted(dup)))
    MERGED.update(m.SPEC)
    found.append("%s:%d" % (tag, len(m.SPEC)))
print("specs =", " ".join(found), "| total idx =", len(MERGED))
missing = [i for i in range(1111, 1154) if i not in MERGED]
extra = [i for i in MERGED if i < 1111 or i > 1153]
if missing:
    print("MISSING IDX:", missing)
if extra:
    print("OUT OF RANGE IDX:", extra)
build.build(MERGED)
