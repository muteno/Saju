# -*- coding: utf-8 -*-
"""
작업내역 대장 — 되돌릴 수 있게 남긴다.

운영자 260726: "진행할때마다 작업내역을 각각남겨, 잘못됬을때 촘촘하게 되돌릴수있게"

═══ 왜 이게 필요한가 ═══
  지금부터 하는 일(색인 재생성·L2 재계산·볼트 재생성)은 **덮어쓰기**다.
  덮어쓰고 나서 "그 전이 나았다"를 알게 되면 되돌릴 방법이 없다.
  git이 없는 폴더라 이력이 남지 않는다 — 그래서 손으로 남긴다.

═══ 쓰는 법 ═══
  from 작업내역 import 단계
  with 단계("색인 통합", "웹+전사 한 통계로", ["data/개념_문단색인.json"]) as st:
      ...작업...
      st.기록("N 38,072 → 73,015")
  → 시작 시 대상 파일을 스냅샷에 복사하고, 끝나면 로그에 한 줄 남긴다.
  → 실패하면 로그에 «실패»로 남고 스냅샷은 그대로 있다(자동 복구는 안 한다.
     자동 복구가 더 위험하다 — 반쯤 쓴 파일을 되돌리다 더 망가뜨린다).

═══ 되돌리는 법 ═══
  python 작업내역.py 목록          — 스냅샷 목록
  python 작업내역.py 되돌리기 <번호> — 그 스냅샷의 파일을 제자리로 복사
"""
import json, shutil, sys, time, traceback
from pathlib import Path

# 콘솔이 cp949면 한글 파일명이 깨져 나온다 — 대장은 읽으라고 만든 것이니 고쳐 둔다
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
LEDG = HERE / "_작업내역"
SNAP = LEDG / "스냅샷"
LOG = LEDG / "작업로그.md"


def _now():
    return time.strftime("%y%m%d_%H%M%S")


class 단계:
    def __init__(self, 이름, 왜, 대상=()):
        self.이름, self.왜 = 이름, 왜
        self.대상 = [HERE / p for p in 대상]
        self.메모 = []
        self.t0 = time.time()

    def 기록(self, s):
        self.메모.append(str(s))
        print(f"   · {s}")

    def __enter__(self):
        SNAP.mkdir(parents=True, exist_ok=True)
        # 🔴260726 수리 — 전에는 `len(디렉터리 수)`로 번호를 매겼다. 두 가지 사고가 있다:
        #   ① 폴더를 하나 지우면 **다음 번호가 이미 쓴 번호와 충돌**한다.
        #   ② `__enter__`에서 스냅샷·`__exit__`에서 로그를 쓰므로, 강제 종료되면
        #      **스냅샷만 남고 로그엔 결번**이 생긴다(실측: 001·003·004·010·019·021 = 6건).
        #   → 번호는 «개수»가 아니라 **기존 최대값+1**로 뽑는다. 결번은 남기되 충돌은 없앤다.
        used = []
        if SNAP.exists():
            for d in SNAP.iterdir():
                if d.is_dir() and d.name[:3].isdigit():
                    used.append(int(d.name[:3]))
        n = (max(used) + 1) if used else 0
        safe = "".join(ch for ch in self.이름 if ch not in '\\/:*?"<>|')
        self.dir = SNAP / f"{n:03d}_{_now()}_{safe}"
        self.dir.mkdir(parents=True, exist_ok=True)
        saved = []
        for p in self.대상:
            if p.exists():
                dst = self.dir / p.name
                shutil.copy2(p, dst)
                saved.append(f"{p.name} ({p.stat().st_size:,}B)")
            else:
                saved.append(f"{p.name} (없음 — 신규)")
        (self.dir / "_대상.json").write_text(
            json.dumps({"이름": self.이름, "왜": self.왜,
                        "대상": [str(p.relative_to(HERE)) for p in self.대상],
                        "저장": saved}, ensure_ascii=False, indent=1), encoding="utf-8")
        # 시작 시점에 로그를 «진행중»으로 먼저 찍는다 — 강제 종료돼도 흔적이 남는다.
        LEDG.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"\n<!-- 진행중 {self.dir.name} · {self.이름} -->\n")
        _OPEN.append(self)
        print(f"▶ [{self.dir.name}] {self.이름} — {self.왜}")
        for s in saved:
            print(f"   ↩ 스냅샷 {s}")
        return self

    def __exit__(self, et, ev, tb):
        if self in _OPEN:
            _OPEN.remove(self)
        dt = time.time() - self.t0
        ok = et is None
        LEDG.mkdir(parents=True, exist_ok=True)
        if not LOG.exists():
            LOG.write_text(
                "# 작업로그\n\n"
                "되돌리려면 `python 작업내역.py 되돌리기 <번호>`.\n"
                "스냅샷은 **작업 직전** 상태다 — 그 단계를 되돌리면 그 단계 이전으로 간다.\n\n",
                encoding="utf-8")
        lines = [f"## {'✅' if ok else '❌'} {self.dir.name}  ({dt:.1f}초)", "",
                 f"- **무엇** {self.이름}", f"- **왜** {self.왜}",
                 f"- **되돌리기** `python 작업내역.py 되돌리기 {self.dir.name.split('_')[0]}`"]
        if self.대상:
            lines.append("- **덮어쓴 파일** " + " · ".join(p.name for p in self.대상))
        for m in self.메모:
            lines.append(f"  - {m}")
        if not ok:
            lines += ["", "```", "".join(traceback.format_exception(et, ev, tb))[-1200:], "```"]
        lines.append("")
        with LOG.open("a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"◀ {'완료' if ok else '실패'} ({dt:.1f}초) — 로그: _작업내역/작업로그.md")
        return False


# ★260726 — **닫히지 않은 단계**를 프로세스 종료 시 붙잡는다.
#   실사고: `build_linkweb.py`가 `__enter__`만 부르고 `__exit__`을 안 불러
#   **결번 15건이 전부 그 파일에서** 났다. 스냅샷은 남는데 로그가 안 남으니
#   «되돌리기 대장»에 구멍이 뚫리고, 그 단계의 수치 메모도 통째로 사라진다.
#   → 열린 채 끝나면 로그에 «미종료»로 박고 화면에도 경고한다. 조용히 사라지지 않게.
_OPEN = []


def _close_dangling():
    for st in list(_OPEN):
        try:
            st.기록("⚠미종료 — __exit__ 가 안 불렸다. `with 단계(...)` 를 써라")
            st.__exit__(RuntimeError, RuntimeError("미종료(__exit__ 누락)"), None)
        except Exception:
            pass


import atexit                       # noqa: E402
atexit.register(_close_dangling)


def _dirs():
    return sorted([d for d in SNAP.iterdir() if d.is_dir()]) if SNAP.exists() else []


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "목록"
    if cmd == "목록":
        for d in _dirs():
            m = json.loads((d / "_대상.json").read_text(encoding="utf-8"))
            print(f"  {d.name}\n      {m['왜']}\n      " + " · ".join(m["저장"]))
    elif cmd == "되돌리기":
        key = sys.argv[2]
        hit = [d for d in _dirs() if d.name.startswith(key) or d.name == key]
        if not hit:
            print(f"그런 스냅샷 없음: {key}"); sys.exit(1)
        d = hit[-1]
        m = json.loads((d / "_대상.json").read_text(encoding="utf-8"))
        for rel in m["대상"]:
            src = d / Path(rel).name
            if src.exists():
                dst = HERE / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                print(f"  ↩ {rel}")
            else:
                print(f"  ⊘ {rel} — 스냅샷에 없음(그 단계에서 새로 생긴 파일). 지우려면 손으로.")
        print(f"되돌림: {d.name}")
    else:
        print(__doc__)
