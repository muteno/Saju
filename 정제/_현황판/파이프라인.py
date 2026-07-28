# -*- coding: utf-8 -*-
"""
사주 정제 프로젝트 — ★단일 파이프라인 (전체 갱신 + 낡음 검사 + 생산-소비 대차대조표)

운영자 지시(260725 저녁, 원문):
> "너가 이미 그 만든거 많더라고, **그것들이 다 별개로 놀거는 아니라는거지**"

■ 왜 이 파일이 생겼나 (260725 실측)
  ① `현황판_갱신.bat`이 부르는 스크립트는 **2개**인데 실제 파이프라인은 **8단계**다.
     나머지 6개(개념트리·뉴런망·관계간선·지식망·계기판·별칭검증)는 배치를 눌러도 안 돈다.
  ② 그 결과 실측 22:51 시점에 data/ 안의 파일이 **네 시대**에 걸쳐 있었다 —
     posts_all·paras_all·stats 08:32 / concept_tree 09:08 / 별칭_판정 14:35 / neuron_* 22:51.
     08:32판 위에 22:51판이 얹혀 있는데 **아무 화면도 그 사실을 모른다.**
  ③ 생산만 되고 아무도 안 읽는 산출물이 8개 있었다. 그중 `stats.json`은
     "커버리지가 0으로 찍힌다"는 알려진 결함이 있는데도 **소비자가 0이라 아무 일도 안 일어났다.**
     (별칭_판정.json = 생산 658·소비 0 이었던 그 병과 같은 모양. 평의회 3차 R2·R6)

■ 이 파일이 강제하는 것
  1. **순서** — 앞 단계 산출물이 뒤 단계 입력이다. 순서를 어기면 낡은 데이터 위에 새 그림이 그려진다.
  2. **낡음 검사** — 각 단계 실행 전에 "내 입력이 내 출력보다 새로운가"를 본다. 낡았으면 돌린다.
  3. **조용한 실패 금지** — 한 단계가 죽으면 거기서 멈춘다. 다음 단계로 안 넘어간다.
     (지금까지는 bat이 `pause`만 하고 넘어갔다 → 낡은 화면이 최신인 척했다)
  4. **생산-소비 대차대조표** — 매 실행 출력. 소비자 0인 산출물이 생기면 이름을 부른다.
  5. **통합 진입점** — `허브.html` 하나로 5개 화면 전부와 최신 수치·낡음 상태를 본다.

사용:
    python 파이프라인.py            # 낡은 단계만 돌린다(권장)
    python 파이프라인.py --all      # 전부 다시 돌린다
    python 파이프라인.py --check    # 아무것도 안 돌리고 상태만 본다
"""
import json, subprocess, sys, io, re, os, html
from pathlib import Path
from datetime import datetime, timezone, timedelta

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
ROOT = HERE.parent                      # 정제/
KST = timezone(timedelta(hours=9))
sys.path.insert(0, str(HERE))
import 경로                              # 위치 정본 — 원본(P0·전사)은 신·구 자동 판별

# ══════════════════════════════════════════════════════════════════════
#  파이프라인 정의 — 순서가 곧 의존성이다. 위에서 아래로만 흐른다.
# ══════════════════════════════════════════════════════════════════════
STAGES = [
    dict(
        name="① 통합본 병합",
        script="build_dashboard.py",
        inputs=[f"{경로.P0_인벤토리}/*_posts.jsonl", f"{경로.P0_인벤토리}/*_paras.jsonl"],
        outputs=["data/posts_all.jsonl", "data/paras_all.jsonl", "data/stats.json", "현황판.html"],
        why="P0 배치 산출물을 하나로 합친다. 이게 아래 전부의 뿌리다.",
    ),
    # ★260726 신설 — 전사가 이 파이프라인 밖에 있었다.
    #   운영자: "관계맵의 소스는 정제한 웹 / 그리고 전사한 유튜브 내용에서 오는거임"
    #   그런데 실측하니 posts_all 3,845편 중 전사는 **3편**이었다(실물은 3,522파일·22.6M자).
    #   지시받은 두 소스 중 큰 쪽(웹의 4.2배)을 통째로 빼고 지도를 그리고 있었다.
    dict(
        name="② 전사 적재",
        script="ingest_transcripts.py",
        inputs=[str(경로.전사_내용)],
        outputs=["data/전사_글.jsonl", "data/전사_문단.jsonl", "data/전사_적재리포트.md"],
        why="유튜브 Whisper 전사본을 웹과 같은 모양으로. 붕괴 반복 접기·보류군 표시.",
    ),
    dict(
        name="③ 개념지도",
        script="build_concept_map.py",
        inputs=["data/paras_all.jsonl", "data/posts_all.jsonl",
                "data/전사_문단.jsonl", "코퍼스.py"],
        outputs=["개념지도.html", "data/개념별_자료량.csv"],
        why="개념 사전(TAXONOMY) 정본이 여기 있다. 대·중·소 주제 트리. "
            "260726부터 공용 리더(코퍼스.py) — 웹+전사 47,088, 격자·gist 제외, 게이트 적용.",
    ),
    dict(
        name="④ 별칭 검증",
        script="lint_aliases.py",
        inputs=["data/paras_all.jsonl"],
        outputs=["data/별칭_판정.json"],
        why="별칭 오탐 판정. ★소비자 = queue_guard.py(인용 자격 게이트) — 260725 배선됨.",
        optional=True,
    ),
    dict(
        name="⑤ 뉴런망(동시출현)",
        script="build_neuron_map.py",
        inputs=["data/paras_all.jsonl", "data/posts_all.jsonl",
                "data/전사_문단.jsonl", "코퍼스.py"],
        outputs=["data/neuron_nodes.jsonl", "data/neuron_edges.jsonl", "뉴런망.html"],
        why="개념 노드 + 동시출현 간선. ⚠밀도 71%라 이것만으론 거리가 의미 없다. "
            "260726부터 공용 리더.",
    ),
    # ★260726 신설 — «한 군데만 고친 것»을 잡는 검사.
    #   오늘 같은 병을 세 번 겪었다: ①gist 오염을 정의증류에서만 고침
    #   ②일상어 게이트를 뉴런맵에만 닮 ③별칭 판정을 만들어 놓고 게이트에 안 이음.
    #   셋 다 «고쳤다»고 기록돼 있었다. 사람 기억으로는 못 막는다 — 매번 재게 한다.
    dict(
        name="⑤-B 마커 린트",
        script="lint_markers.py",
        inputs=["build_concept_map.py", "build_neuron_map.py",
                "data/별칭_판정.json", "코퍼스.py", "data/전사_문단.jsonl"],
        outputs=[],          # 검사만 한다
        why="★[A]게이트 우회 모듈 [B]일상어 별칭 국소 실측 [C]판정↔게이트 배선 부채(래칫). "
            "부채가 늘거나 우회 모듈이 생기면 exit 1.",
        check_only=True,
    ),
    dict(
        name="⑥ 개념트리",
        script="build_concept_tree.py",
        inputs=["data/paras_all.jsonl"],
        outputs=["data/concept_tree.json", "개념트리.html"],
        why="리프트 기반 계층. ⚠소비자 0 — 지식망이 읽게 배선 필요(과제).",
        optional=True,
    ),
    # 🔴🔴260727 — **기틀을 만드는 네 단계가 파이프라인에 통째로 없었다.**
    #   `ingest_board.py` · `build_tables.py` · `build_manifest.py` · `잔량표.py`.
    #   앞의 셋은 ⑦(결정론 관계망)이 **입력으로 요구하는 것**을 만든다. 그런데 파이프라인이
    #   그 생산자를 몰라서, `--all`을 돌려도 기틀은 한 번도 다시 만들어지지 않았다.
    #   → 그래서 «보드 적재가 회수한 25%를 다시 버리는» 버그가 며칠을 살아남았다.
    #     대차대조표는 «소비자 0»만 잡는다. **«생산자가 파이프라인 밖»은 못 잡는다** —
    #     그 사각지대가 이번에 드러났다. 여기 넣어 사각지대를 없앤다.
    dict(
        name="②-B 방법론 보드 적재",
        script="ingest_board.py",
        inputs=["_피그잼정제/_도구/보드_완전추출본_v2.md"],
        outputs=["data/보드_문단.jsonl"],
        why="운영자 피그잼 = «거의 인덱싱 표». 조견표 이식(⑦-A)의 축자 대조 바탕. "
            "⚠회수율 게이트(98%)와 개인정보 게이트 내장 — 조용히 사라지면 죽는다.",
    ),
    dict(
        name="⑦-A 조견표 이식",
        script="build_tables.py",
        inputs=["_피그잼정제/조견표.jsonl", "_웹기틀/조견표_웹.jsonl",
                "data/보드_문단.jsonl"],
        outputs=["data/조견표_간선.jsonl", "data/조견표_미매핑.md"],
        why="★보드+웹에서 건진 표 96개를 «산출» 간선으로. ⑦이 이 파일을 읽는다. "
            "축자를 다시 재고, 정본 노드로 못 맞추면 버리고 전량 기록한다.",
    ),
    dict(
        name="⑦-A2 발현 채굴",
        script="build_manifest.py",
        inputs=["data/전사_문단.jsonl", "data/paras_all.jsonl"],
        outputs=["data/발현카드.jsonl", "data/발현_리포트.md"],
        why="★최대 병목(인과 고리)의 재료. 「이유가 붙은 결론」만 캔다 — 기전이 비면 낭설. "
            "⑦이 이 파일을 읽어 «발현» 간선으로 올린다(기전에 관계어가 있는 것만).",
    ),
    dict(
        name="⑦ 결정론 관계망",
        script="build_relation_edges.py",
        inputs=["build_concept_map.py"],          # TAXONOMY를 직접 읽는다
        outputs=["data/relation_edges.jsonl", "data/node_layers.jsonl"],
        why="★계층 간선 + 명리 결정론 관계(생·극·합·충·형·파·해·지장간). 260725 신설.",
    ),
    # ★260726 — 신살 조견표를 엔진에서 옮겨 적은 것. ⑦(결정론 관계망)이 이 표를
    #   «산출» 간선으로 넣으므로 그 앞에서 만들어야 한다… 가 아니라, 사실 생성기가
    #   표를 자기 안에 갖고 있다. 이 단계는 **사람이 읽는 표**를 뽑는 것이다.
    #   ⚠고아로 잡혀서 배선했다 — 만들어 놓고 파이프라인에 안 넣는 게 오늘의 그 병이다.
    dict(
        name="⑦-C 신살 조견표",
        script="신살_조견표.py",
        inputs=["../../app/src/engine/vendor/sinsal.js"],
        outputs=["data/신살조견표.jsonl", "data/신살조견표.md"],
        why="「일간을 기준으로 정해지는」이 아니라 **기준 그 자체**. 엔진 표를 옮겨 적어 "
            "사람이 읽게 한다(⑦-B가 엔진과 대조한다).",
    ),
    # ★260726 — «판정 절차». 조견표(⑦-C)가 «입력→글자»라면 이건 «입력→숫자·판정»이다.
    #   왜 이게 없어서 문제였나: 실측 낭설률 **S08 강약 94% · S09 용신 92%**로
    #   앱의 심장부가 최악이었는데, 원인이 한 줄이었다 —
    #   **조견표는 넣었는데 「어느 자리가 몇 점인가」·「무엇이 득령인가」가 지도에 없었다.**
    #   ⚠⑦-C와 같은 이유로 여기 배선한다. 만들어 놓고 파이프라인에 안 넣는 게 그 병이다.
    dict(
        name="⑦-D 판정 절차",
        script="판정절차.py",
        inputs=["../../app/src/engine/vendor/judge.js"],
        outputs=["data/판정절차.jsonl", "data/판정절차.md"],
        why="강약 110점제·득령득지득시득세를 사람이 읽게 뽑는다. "
            "★자리 배점이 갈린다(방법론 보드 「연15·시10」 vs 도화도레 「연10·시15」) — "
            "숨기지 않고 stance로 남긴다. 간선 대조는 ⑦-B가 한다.",
    ),
    dict(
        name="⑦-E 잔량표",
        script="잔량표.py",
        inputs=["data/조견표_간선.jsonl"],
        outputs=["data/잔량표.md"],
        why="운영자 260726: *«거기있는거 다 옮기라니까 파일 필요없을때까지»*. "
            "목표는 «많이 붙였다»가 아니라 **«남은 게 0»** — 그 0을 세는 자다.",
    ),
    # ★260727 신설 4단계 — 운영자 지시 두 갈래가 여기 착지한다.
    #   *"앱에 뇌를 달아주셈"* → ⑱ 앱 두뇌 팩
    #   *"분류별로 또 다시 모아(2차) … 핵심 요체를 뽑아내(3차)"* → ⑲·⑳
    #   *"어디가 부족한지 노드별로 분석"* → ㉑ 결핍표
    #   ⚠셋 다 «생산자가 파이프라인 밖»이면 지도를 고쳐도 다시 안 뽑힌다 —
    #     오늘 그 사각지대로 보드 적재 버그가 며칠 살아남았다. 그래서 바로 배선한다.
    dict(
        name="⑦-B L1 엔진 대조",
        script="verify_L1_sync.py",
        inputs=["data/relation_edges.jsonl",
                "../../app/src/engine/vendor/relations.js",
                "../../app/src/engine/vendor/tables.js",
                # ★260726 — 강약 배점·경계·득판정까지 대조 범위에 들어왔다.
                "../../app/src/engine/vendor/judge.js"],
        outputs=[],          # 산출물 없음 — 검사만 한다(불일치면 exit 1)
        why="★L1 계산 엔진과 개념망이 같은 명리 표를 두 벌로 갖고 있다. 갈라지면 여기서 죽는다.",
        check_only=True,
    ),
    # ★260726 신설 5단계 — 그동안 `볼트_갱신.bat`에만 있어서 **이 파이프라인이 몰랐다.**
    #   두 파이프라인이 서로를 모르는 것이 정확히 이 파일이 고치려던 병이다
    #   (운영자 260725: "그것들이 다 별개로 놀거는 아니라는거지"). 여기로 합친다.
    #   ⚠순서 주의 — 색인은 `node_layers.jsonl`(⑦)이 있어야 개념 목록을 안다.
    dict(
        name="⑧ 색인 통합",
        script="build_index.py",
        inputs=["data/paras_all.jsonl", "data/전사_문단.jsonl",
                "data/node_layers.jsonl", "코퍼스.py", "build_neuron_map.py"],
        outputs=["data/개념_문단색인.json", "data/색인_비교리포트.md",
                 "data/마커_출처편차.jsonl"],
        why="★웹+전사를 한 통계로. 여기서만 색인을 만든다 — 링크망이 제 손으로 만들던 "
            "폴백은 격자·gist를 섞어 넣던 통로라 막았다(260726).",
    ),
    dict(
        name="⑨ 정의 증류",
        script="distill_definitions.py",
        inputs=["data/paras_all.jsonl", "data/전사_문단.jsonl",
                "data/node_layers.jsonl", "코퍼스.py"],
        outputs=["data/정의카드.jsonl"],
        why="코퍼스에서 «정의 후보»를 긁는다(원재료). 사람이 골라 정의원고에 옮긴다.",
    ),
    dict(
        name="⑩ 정의 정제본",
        script="build_definitions.py",
        inputs=["정의원고", "data/node_layers.jsonl"],
        outputs=["data/정의_정제본.jsonl"],
        why="손으로 쓴 원고(정의원고/b1~b5.txt)를 데이터로. 정본 노드명 게이트 — 어긋나면 죽는다.",
    ),
    # ★260728 신설 — 백과사전 층 (운영자 확정: 기초 = 백과식 정의집 ~10만자 · 차등 밴드).
    #   집필 = E1~E5 원고(정의원고/백과_*.md), 소비 = ⑮ 볼트(정의 정본 승격).
    #   원고만 쌓이고 소비자가 없는 병(13회 전례)을 여기 등재로 막는다.
    dict(
        name="⑩-B 백과사전",
        script="build_encyclopedia.py",
        inputs=["정의원고", "data/node_layers.jsonl"],
        outputs=["data/백과.jsonl"],
        why="백과 원고(무엇/어디서/산출/낳나/갈림)를 데이터로. 정본 노드명 게이트 + 중복 게이트.",
    ),
    dict(
        name="⑪ 분기 간선(F6)",
        script="build_branch_edges.py",
        inputs=["data/paras_all.jsonl", "data/전사_문단.jsonl",
                "data/node_layers.jsonl"],
        outputs=["data/조건부간선.jsonl", "data/분기변조카드.jsonl",
                 "data/분기간선_리포트.md"],
        why="★「A면 B, C면 D」에서 **조건 붙은 관계**를 캔다. L1½ 층의 재료.",
    ),
    # ★260726 — 자동 채굴(⑪)이 **구조적으로** 못 잡는 몫을 사람이 채운다.
    #   ⑪은 «한 문장 안의 대칭 분기»만 본다. 조건과 귀결이 문장을 걸치거나 표로 적힌 것은
    #   아무리 돌려도 안 나온다. 실측: 개념 251 중 **131개가 조건부 다리 0** —
    #   운영자 260726 *"기본이 안 놓여있으면 전사를 가져와도 어디에 붙일지 놀아버린다"*.
    #   ⚠사람이 적으면 «요약이 데이터로 둔갑»할 수 있다 → 검증구 축자 대조 + 결론어 게이트.
    dict(
        name="⑪-B 수기 조건부",
        script="build_manual_conditions.py",
        inputs=["조건부_원고.jsonl", "data/node_layers.jsonl"],
        outputs=["data/조건부간선_수기.jsonl"],
        why="자동이 못 잡는 조건부 관계를 사람이 적되, **검증구가 그 문단에 실재할 때만** 올린다.",
    ),
    dict(
        name="⑫ 링크망",
        script="build_linkweb.py",
        inputs=["data/개념_문단색인.json", "data/relation_edges.jsonl",
                "data/조건부간선.jsonl", "data/조건부간선_수기.jsonl",
                "data/node_layers.jsonl"],
        outputs=["data/링크망.jsonl", "data/링크망_리포트.md"],
        why="★L1 결정론 + L1½ 조건부 + L2 밀착 + L3 보강. **이게 관계지도 본체다.**",
    ),
    dict(
        name="⑫-B 근거 사슬",
        script="build_chains.py",
        inputs=["data/링크망.jsonl"],
        outputs=["data/근거사슬.jsonl", "data/근거사슬_리포트.md"],
        why="★해석 간선마다 «왜»를 L1 경로로 댈 수 있는지. 못 대면 «낭설 후보». "
            "운영자 260726: \"이유를 모르면 연결할수가 없어 낭설임\".",
    ),
    # ★260726 — 운영자: "지금 그 관계도 모인 표 하나 주고, 그거 핵심으로 따로 보여지게해줘"
    #   간선이 4개 층에 흩어져 있고 «왜»는 또 다른 파일에 있었다. 한 표로 모은다.
    #   **이게 지도의 본체다** — "그거 하나만 있으면 앱을 복제할 수 있을정도로"(260726).
    dict(
        name="⑫-C ★관계도 정본 표",
        script="build_relation_table.py",
        inputs=["data/링크망.jsonl", "data/근거사슬.jsonl", "data/node_layers.jsonl"],
        outputs=["관계도.html", "data/관계도.csv"],
        why="★모든 층의 간선 + 조건 + 부호 + 출처 + «왜»를 한 줄에. 검색·필터·정렬.",
    ),
    # ★260726 — 운영자: "이거 모르면 역추론 못해". 지도의 최종 목적은 8글자 → 사람이다.
    dict(
        name="⑫-D 역추론 색인",
        script="build_reverse.py",
        inputs=["data/링크망.jsonl", "data/근거사슬.jsonl", "data/node_layers.jsonl"],
        outputs=["data/역추론색인.jsonl", "data/역추론_리포트.md"],
        why="★「발현 → 어떤 구조일 수 있나」. **저장이 아니라 계산** — 역방향 간선을 "
            "따로 저장하면 기전 없는 배속표가 또 생긴다(P(발현|구조)≠P(구조|발현)).",
    ),
    dict(
        name="⑫-E 간선id 대장",
        script="간선id_대장.py",
        inputs=["data/링크망.jsonl"],
        outputs=["data/간선id_대장.json", "data/간선id_변경.md"],
        why="id는 hash(a,b,kind)라 kind를 다듬으면 바뀐다. **바뀔 때마다 기록**해 "
            "가리키던 참조가 끊기는 걸 알 수 있게 한다(260726 실제로 5쌍이 바뀌었다).",
    ),
    dict(
        name="⑬ 지식망 화면",
        script="build_graph_view.py",
        inputs=["data/neuron_nodes.jsonl", "data/neuron_edges.jsonl",
                "data/relation_edges.jsonl", "data/node_layers.jsonl",
                "../P2_유닛/pilot_UI.jsonl", "../P2_유닛/pilot_UJ.jsonl"],
        outputs=["지식망.html"],
        why="옵시디언식 그래프 뷰. 계층/관계/공기 3층.",
    ),
    dict(
        name="⑭ 계기판(거리·확장성)",
        script="measure_knowledge_map.py",
        inputs=["data/neuron_nodes.jsonl", "data/neuron_edges.jsonl",
                "data/relation_edges.jsonl", "data/node_layers.jsonl"],
        outputs=["data/knowledge_metrics.jsonl"],
        why="★운영자 6축(계층·강도·붙은지식·거리·확장성·신뢰) 측정. 260725 신설.",
    ),
    dict(
        name="⑮ 옵시디언 볼트",
        script="build_obsidian_vault.py",
        inputs=["data/링크망.jsonl", "data/정의_정제본.jsonl", "data/백과.jsonl",
                "data/node_layers.jsonl"],
        outputs=["../../7. 옵시디언 볼트/00 시작/🏠 홈.md"],
        why="★사람이 읽는 관계지도. 노트마다 결정론·조건부·밀착 3층을 편다.",
    ),
    dict(
        name="⑯ 신경망 2D",
        script="build_neuralnet.py",
        inputs=["data/링크망.jsonl", "data/node_layers.jsonl"],
        outputs=["사주신경망.html"],
        why="판단이 흐르는 10개 층. 계층 배치.",
    ),
    dict(
        name="⑰ 신경망 3D",
        script="build_neuralnet3d.py",
        inputs=["data/링크망.jsonl", "data/node_layers.jsonl"],
        outputs=["사주신경망_3D.html"],
        why="원통 좌표 — 판단축 x · 오행 위상 θ · 분류 깊이 r. 360도 회전.",
    ),
    # ── ★260727 신설 (위 주석 참조) ────────────────────────────
    dict(
        name="⑱ 앱 두뇌 팩",
        script="build_brain.py",
        inputs=["data/링크망.jsonl", "data/정의_정제본.jsonl", "data/근거사슬.jsonl",
                "data/relation_edges.jsonl", "data/판정절차.jsonl", "data/역추론색인.jsonl"],
        outputs=["data/앱두뇌.json", "data/앱두뇌_리포트.md"],
        why="★운영자 260727: *«앱에 뇌를 달아주셈»*. 지도를 앱이 «계산된 키»로 조회할 수 있게. "
            "⚠검색(RAG) 금지 원칙 그대로 — 질의가 아니라 keyset.js가 만든 키만 받는다. "
            "앱 배포는 ⑱-B가 한다.",
    ),
    # ★260727 — «복사는 아직 수동»이던 단계의 배선. 수동 = 지도는 새것인데 앱이 옛 뇌를
    #   먹는 사고의 씨앗(생산자가 파이프라인 밖 병과 같은 축)이라 즉시 단계로 올린다.
    dict(
        name="⑱-B 두뇌 배포",
        script="두뇌_배포.py",
        inputs=["data/앱두뇌.json"],
        outputs=["../../app/public/brain.json"],
        why="앱이 실제로 먹는 `app/public/brain.json` 갱신. 같으면 복사 생략.",
    ),
    dict(
        name="⑲ 2차 전사(분류별 모으기)",
        script="build_gather.py",
        inputs=["data/paras_all.jsonl", "data/전사_문단.jsonl", "data/보드_문단.jsonl",
                "data/node_layers.jsonl"],
        outputs=["data/2차_분류모음.jsonl", "data/2차_리포트.md"],
        why="★운영자 260727: *«그 내용을 분류별로 또 다시 모아(2차 전사 느낌)»*. "
            "한 개념에 대한 말이 20파일·9저자에 흩어져 있다 — 모아야 판본 갈림이 보인다.",
    ),
    dict(
        name="⑳ 3차 전사(핵심 요체)",
        script="build_essence.py",
        inputs=["data/2차_분류모음.jsonl", "data/정의_정제본.jsonl",
                "data/relation_edges.jsonl", "data/조건부간선.jsonl"],
        outputs=["data/3차_요체.jsonl", "data/3차_리포트.md"],
        why="★운영자 260727: *«그 모은것에서 핵심 요체를 뽑아내(3차 전사)»*. "
            "⛔요체 = 정의·성립조건·관계·조건부규칙·판본갈림 다섯 칸. "
            "「이러면 이렇게 산다」는 **일부러 안 뽑는다**(1-36).",
    ),
    dict(
        name="㉑ 결핍표",
        script="결핍표.py",
        inputs=["data/node_layers.jsonl", "data/정의_정제본.jsonl",
                "data/링크망.jsonl", "data/근거사슬.jsonl"],
        outputs=["data/결핍표.md", "data/결핍표.jsonl"],
        why="★운영자 260727: *«어디가 부족한지 노드별로 분석»*. "
            "🔴근거는 **보드 포함**으로 센다 — 기본값(보드 제외)으로 재면 "
            "보드에만 있는 것이 «자료없음»으로 찍힌다(`부성입묘`가 그랬다).",
    ),
]

SCREENS = [
    ("현황판.html", "현황판", "지금 어디까지 왔나 — 공정 진척·수치·커버리지"),
    ("개념지도.html", "개념지도", "대·중·소 주제 트리 + 개념별 자료량"),
    ("개념트리.html", "개념트리", "리프트 기반 계층 (무겁다 — 5.7MB)"),
    ("뉴런망.html", "뉴런망", "개념별 다리 수 표"),
    ("관계도.html", "★관계도 정본 표", "모든 간선 한 표 — 조건·부호·출처·«왜». 지도의 본체"),
    ("지식망.html", "지식망", "★그래프 뷰 — 계층·관계·공기 3층"),
    ("사주신경망.html", "신경망 2D", "판단이 흐르는 10개 층"),
    ("사주신경망_3D.html", "신경망 3D", "원통 좌표 — 360도 회전"),
]


def mtime(p: Path):
    return p.stat().st_mtime if p.exists() else None


def resolve(pat: str) -> list:
    p = HERE / pat
    if "*" in pat:
        base = (HERE / pat).parent
        return sorted(base.glob(Path(pat).name)) if base.exists() else []
    return [p] if p.exists() else []


def newest(paths) -> float:
    ts = [mtime(p) for p in paths if mtime(p)]
    return max(ts) if ts else 0.0


def oldest(paths) -> float:
    ts = [mtime(p) for p in paths if mtime(p)]
    return min(ts) if ts else 0.0


def stamp(ts):
    return datetime.fromtimestamp(ts, KST).strftime("%m-%d %H:%M") if ts else "없음"


def stage_state(st):
    # 검사 전용 단계는 산출물이 없다 — 낡음 개념이 없으니 항상 돈다.
    # (검사를 "최신"이라고 건너뛰면 검사가 아니다)
    if st.get("check_only"):
        return "검사", [], [], []
    # ★★생성기 자신을 입력에 포함한다 (평의회 4차 O3·O7 적발).
    #   전엔 8단계 중 **자기 스크립트를 inputs에 선언한 단계가 0개**였다.
    #   그래서 `build_relation_edges.py`를 고쳐도 ⑥은 여전히 "최신 ✅"으로 찍혔고,
    #   **고친 코드가 안 도는데 화면은 초록불**이었다. 거짓 확신이 낡음보다 나쁘다.
    ins = [HERE / st["script"]] if (HERE / st["script"]).exists() else []
    ins += [x for pat in st["inputs"] for x in resolve(pat)]
    outs = [x for pat in st["outputs"] for x in resolve(pat)]
    missing = [pat for pat in st["outputs"] if not resolve(pat)]
    if missing:
        return "없음", ins, outs, missing
    if not ins:
        # ⚠"입력없음"을 그냥 넘기면 경로 오타·NFD 파일명일 때 단계가 조용히 생략된다.
        #   에러 없이 건너뛰는 게 이 프로젝트 사고 패턴 1번이므로 '없음'과 같이 취급한다.
        return "입력없음", ins, outs, missing
    # ⚠mtime은 초 단위로 절삭되는 경우가 있다(P0 배치 180개 중 86개가 .000초 — O3 실측).
    #   순수 부등호면 같은 초일 때 "최신"으로 통과하므로 >= 로 본다(보수적으로 다시 돈다).
    return ("낡음" if newest(ins) >= oldest(outs) else "최신"), ins, outs, missing


# ══════════════════════════════════════════════════════════════════════
#  생산-소비 대차대조표 (평의회 3차 R6 — "생산 필드마다 소비처를 매 실행 출력")
# ══════════════════════════════════════════════════════════════════════
FILE_PAT = re.compile(r"""['"]([^'"]*?\.(?:jsonl|json|csv|html))['"]""")
WRITE_SIG = re.compile(r"""(open\([^)]*['"]w|write_text|to_csv|\.open\(\s*['"]w)""")


def balance_sheet():
    """생산-소비 대차대조표.

    ⚠★평의회 4차 O3 적발: **이 함수가 자기 자신을 스캔해 무죄를 남발하고 있었다.**
      `STAGES`의 outputs 문자열이 '소비 증거'로 계상돼서,
      독스트링이 직접 고발한 3종(`stats.json`·`concept_tree.json`·`knowledge_metrics.jsonl`)이
      전부 "소비자=['파이프라인.py']"로 무죄가 됐다.
      → **자기 파일과 폐기 폴더를 스캔에서 뺀다.** 검사가 자기를 채점하면 검사가 아니다.
    """
    SELF = Path(__file__).name
    # ★260726 `_폐기`·`_작업내역` 추가.
    #   `_폐기`는 «죽은 코드»다 — 운영자 지적으로 내린 «실전 쓰임» 생성기가 여기 있고
    #   묘비(_폐기/묘비.md)에 왜 죽었는지가 적혀 있다. 그걸 «소비자 0 산출물»이라며
    #   대차대조표가 매번 부르면, 살아 있는 배선 결함이 죽은 코드에 묻힌다.
    #   `_작업내역`은 되돌리기 스냅샷이라 «지금 도는 코드»가 아니다.
    SKIP_DIR = ("__pycache__", "평의회", "_백업", "_work_backup", "_미완_부분산출_백업",
                "_폐기", "_작업내역")
    prod, cons = {}, {}
    for py in sorted(ROOT.rglob("*.py")):
        if any(s in str(py) for s in SKIP_DIR) or py.name == SELF:
            continue
        try:
            lines = py.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for i, l in enumerate(lines):
            for m in FILE_PAT.finditer(l):
                f = os.path.basename(m.group(1))
                if "*" in f or "{" in f or "%" in f:
                    continue
                ctx = "\n".join(lines[max(0, i - 2): i + 3])
                (prod if WRITE_SIG.search(ctx) else cons).setdefault(f, set()).add(py.name)
    orphans = []
    for f, ps in sorted(prod.items()):
        c = cons.get(f, set()) - ps
        if not c:
            orphans.append((f, sorted(ps)))
    return prod, cons, orphans


# 사람이 최종 소비자인 산출물 — 코드 소비자가 없어도 정상이다
#   ⚠이 목록에 넣는 것은 «면제»가 아니라 «사람이 읽기로 한 것»의 선언이다.
#     넣기 전에 스스로 물을 것: 이걸 정말 사람이 여는가, 아니면 만들어 놓고 잊는가.
HUMAN_CONSUMED = {
                  # ★260727 — 3단 전사·결핍표·앱 두뇌. 셋 다 **최종 소비자가 코드가 아니다.**
                  #   `앱두뇌.json`은 **앱**이 먹는다(app/public/brain.json으로 복사).
                  #   나머지 둘은 사람이 읽는다. 「코드가 안 읽는다」는 결함이 아니라 설계다 —
                  #   다만 **선언해 둬야** 대차대조표가 진짜 고아를 못 숨긴다.
                  "2차_분류모음.jsonl", "2차_리포트.md",
                  "3차_요체.jsonl", "3차_리포트.md",
                  "결핍표.jsonl", "결핍표.md",
                  "앱두뇌.json", "앱두뇌_리포트.md",
                  "현황판.html", "개념지도.html", "개념트리.html", "뉴런망.html",
                  "지식망.html", "허브.html", "개념별_자료량.csv", "개념마커_적중률.md", "관계도.html",
                  # ★260726 추가 — 사람이 눈으로 보라고 만든 것들
                  "사주신경망.html", "사주신경망_3D.html",   # 도령님이 직접 돌려 보는 화면
                  "색인_비교리포트.md", "링크망_리포트.md", "분기간선_리포트.md",
                  "전사_적재리포트.md", "개념지도_전후대조.csv",
                  "마커_출처편차.jsonl",      # 오전사 의심 목록 — 사람이 ⓐ/ⓑ 판정해야 한다
                  "분기간선_검증세트.jsonl",   # 순수결정론 격리분 — 검증용, 지도에 안 넣는다
                  "분기간선.jsonl", "분기변조카드.jsonl",  # 조건부간선의 원재료(추적용 보존)
                  "작업로그.md", "_대상.json",   # 되돌리기 대장
                  "마커린트.md", "게이트부채_기준선.json",  # 린트 산출
                  "근거사슬_리포트.md", "근거사슬.jsonl",
                  "관계도.csv", "역추론_리포트.md", "역추론색인.jsonl",
                  "간선id_변경.md", "간선id_대장.json", "검사_반례.jsonl", "신살조견표.md", "신살조견표.jsonl",
                  # ★260728 V1 낭설 재심 — 닫힘후보 17(전건 단일출처)·약증거 50은 «사람이 볼 큐»다
                  "낭설재심.jsonl", "낭설재심_리포트.md"}   # ★정본 표(엑셀) — 사람이 본다   # 사람이 «낭설 후보»를 판정한다


def build_hub(results, orphans):
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    rows = []
    for st, state, o_ts in results:
        cls = {"최신": "ok", "낡음": "stale", "없음": "none"}.get(state, "none")
        rows.append(
            f'<tr class="{cls}"><td>{html.escape(st["name"])}</td>'
            f'<td><code>{html.escape(st["script"])}</code></td>'
            f'<td class="s">{state}</td><td class="t">{stamp(o_ts)}</td>'
            f'<td class="w">{html.escape(st["why"])}</td></tr>')
    cards = []
    for fn, title, desc in SCREENS:
        p = HERE / fn
        t = stamp(mtime(p)) if p.exists() else "없음"
        cards.append(
            f'<a class="card" href="{fn}"><div class="ti">{html.escape(title)}</div>'
            f'<div class="de">{html.escape(desc)}</div><div class="tm">갱신 {t}</div></a>')
    orph = "".join(f"<li><code>{html.escape(f)}</code> ← {html.escape(', '.join(ps))}</li>"
                   for f, ps in orphans if f not in HUMAN_CONSUMED) or "<li>없음 ✅</li>"
    doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>사주 정제 — 허브</title>
<style>
:root{{color-scheme:light dark}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
margin:0;padding:28px;background:#f6f7f9;color:#16181d;max-width:1100px}}
@media(prefers-color-scheme:dark){{body{{background:#14161a;color:#e6e8ec}}}}
h1{{font-size:24px;margin:0 0 4px}} .stamp{{color:#8a8f98;font-size:13px;margin-bottom:22px}}
h2{{font-size:16px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #dfe3e8}}
@media(prefers-color-scheme:dark){{h2{{border-color:#2b2f37}}}}
.cards{{display:flex;flex-wrap:wrap;gap:12px}}
.card{{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e3e6ea;
border-radius:12px;padding:14px 16px;min-width:190px;flex:1 1 190px}}
.card:hover{{border-color:#4a86e8}}
@media(prefers-color-scheme:dark){{.card{{background:#1c1f25;border-color:#2b2f37}}}}
.card .ti{{font-weight:700;font-size:15px}} .card .de{{font-size:12px;color:#8a8f98;margin-top:3px;line-height:1.5}}
.card .tm{{font-size:11px;color:#a0a6b0;margin-top:8px}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13px}}
@media(prefers-color-scheme:dark){{table{{background:#1c1f25}}}}
th{{text-align:left;padding:9px 10px;background:#eef1f5;font-size:12px;color:#5b6270}}
@media(prefers-color-scheme:dark){{th{{background:#22262e;color:#9aa1ad}}}}
td{{padding:8px 10px;border-top:1px solid #eceff3}}
@media(prefers-color-scheme:dark){{td{{border-color:#282c34}}}}
td.s{{font-weight:700;white-space:nowrap}} td.t{{color:#8a8f98;white-space:nowrap;font-variant-numeric:tabular-nums}}
td.w{{color:#6b7280;font-size:12px}}
tr.ok td.s{{color:#2e9e5b}} tr.stale td.s{{color:#c9701a}} tr.none td.s{{color:#c0392b}}
code{{background:#eef2f8;padding:1px 5px;border-radius:5px;font-size:12px}}
@media(prefers-color-scheme:dark){{code{{background:#262b34}}}}
.note{{background:#fff8e6;border:1px solid #f0dfa8;border-radius:10px;padding:12px 16px;
font-size:13px;line-height:1.75}}
@media(prefers-color-scheme:dark){{.note{{background:#2a2515;border-color:#4a4020}}}}
ul{{margin:6px 0 0;padding-left:20px;font-size:13px;line-height:1.8}}
</style></head><body>
<h1>사주 정제 — 허브</h1>
<div class="stamp">{now} · 화면 하나만 열지 말고 여기서 시작하세요. <b>낡은 단계가 있으면 아래 표가 알려줍니다.</b></div>

<h2>화면</h2>
<div class="cards">{''.join(cards)}</div>

<h2>파이프라인 상태 — 순서가 곧 의존성</h2>
<table><thead><tr><th>단계</th><th>스크립트</th><th>상태</th><th>산출물 갱신</th><th>무엇을 하나</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table>
<div class="note" style="margin-top:12px">
<b>낡음</b> = 입력이 산출물보다 새롭다(= 다시 돌려야 한다). <b>없음</b> = 산출물이 아예 없다.<br>
전부 다시 그리려면 <code>python 파이프라인.py --all</code>, 낡은 것만 <code>python 파이프라인.py</code>.
</div>

<h2>🔴 만들어놓고 아무도 안 읽는 산출물</h2>
<div class="note">
이 프로젝트에서 <b>별칭_판정.json이 판정 658건을 생산하는데 소비자가 0</b>이었던 적이 있다.
검증기가 아니라 벽에 붙은 종이였고, 그래서 아무것도 막지 못했다.
<code>stats.json</code>도 "커버리지가 0으로 찍힌다"는 결함이 알려져 있었지만
<b>읽는 사람이 없어서 아무 일도 일어나지 않았다.</b><br>
<ul>{orph}</ul>
</div>
</body></html>"""
    (HERE / "허브.html").write_text(doc, encoding="utf-8")


def main():
    mode = "stale"
    if "--all" in sys.argv:
        mode = "all"
    elif "--check" in sys.argv:
        mode = "check"

    print(f"■ 사주 정제 파이프라인 — {datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')}  [{mode}]")
    print()
    results = []
    for st in STAGES:
        state, ins, outs, missing = stage_state(st)
        o_ts = oldest(outs) if outs else 0.0
        need = mode == "all" or state in ("낡음", "없음")
        mark = {"최신": "✅", "낡음": "🟡", "없음": "🔴",
                "입력없음": "⬜", "검사": "🔍", "실패": "⛔"}.get(state, "❔")
        print(f"{mark} {st['name']:<20} {state:<5} 산출 {stamp(o_ts):<12} {st['script']}")

        if mode == "check" or not need:
            results.append((st, state, o_ts))
            continue

        script = HERE / st["script"]
        if not script.exists():
            print(f"   ⛔ 스크립트 없음: {script}")
            if not st.get("optional"):
                raise SystemExit(1)
            results.append((st, "없음", o_ts))
            continue

        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        r = subprocess.run([sys.executable, st["script"]], cwd=str(HERE),
                           capture_output=True, text=True, encoding="utf-8", env=env)
        if r.returncode != 0:
            print(f"   ⛔ 실패 (exit {r.returncode}) — 여기서 멈춘다. 다음 단계로 넘어가지 않는다.")
            print("   " + (r.stderr or r.stdout or "").strip()[:900].replace("\n", "\n   "))
            if st.get("optional"):
                print("   (선택 단계라 계속 진행)")
                results.append((st, "실패", o_ts))
                continue
            build_hub(results + [(st, "실패", o_ts)], balance_sheet()[2])
            raise SystemExit(1)
        tail = [l for l in (r.stdout or "").splitlines() if l.strip()][-3:]
        for l in tail:
            print(f"   │ {l[:150]}")
        state2, _, outs2, _ = stage_state(st)
        results.append((st, state2, oldest(outs2)))
    print()

    prod, cons, orphans = balance_sheet()
    real = [(f, ps) for f, ps in orphans if f not in HUMAN_CONSUMED]
    print("── 생산-소비 대차대조표")
    print(f"  추적 산출물 {len(prod)}종 · 사람이 최종 소비자 {len(HUMAN_CONSUMED & set(prod))}종")
    if real:
        print(f"  🔴 코드가 만들지만 코드가 안 읽는 것 {len(real)}종:")
        for f, ps in real:
            print(f"      {f:<32} ← {', '.join(ps)}")
        print("     ※'별칭_판정.json 생산 658·소비 0' 과 같은 모양이다. 배선하거나 지워라.")
    else:
        print("  ✅ 고아 산출물 없음")
    print()

    build_hub(results, orphans)
    print(f"→ 허브: {HERE / '허브.html'}  ← ★여기부터 열면 5개 화면과 낡음 상태가 한눈에 보인다")


if __name__ == "__main__":
    main()
