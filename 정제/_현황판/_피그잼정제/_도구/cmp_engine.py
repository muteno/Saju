# -*- coding: utf-8 -*-
"""보드 조견표 ↔ 엔진(vendor/tables.js, sinsal.js) 값 대조."""
import json, io, os, re
OUT = r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\_현황판\_피그잼정제"
R = {r['표이름']: r for r in (json.loads(l) for l in io.open(os.path.join(OUT, '조견표.jsonl'), encoding='utf-8'))}

STEMS = ['갑','을','병','정','무','기','경','신','임','계']
BR    = ['자','축','인','묘','진','사','오','미','신','유','술','해']
STAGES= ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양']
STAGE_BIRTH = [11,6,2,9,2,9,5,0,8,3]
def twelveStage(s,b):
    st = STAGE_BIRTH[s]
    return (b-st)%12 if s%2==0 else (st-b)%12
k = lambda x: x[0]  # '갑(甲)목(+)' → '갑' / '해(亥)' → '해'

print('=== ① 십이운성 배정 120칸 ===')
bad=[]
for c in R['십이운성 배정 (일간×12단계)']['표']:
    s=STEMS.index(k(c['입력'])); b=BR.index(k(c['출력'])); st=c['단계'][0] if c['단계'][:2] not in ('장생','목욕','관대','건록','제왕') else None
    stage=re.sub(r'\(.*','',c['단계'])
    if STAGES[twelveStage(s,b)]!=stage: bad.append((c,STAGES[twelveStage(s,b)]))
print(f'불일치 {len(bad)}/120', bad[:5])

print('=== ② 건록 ===')
GEONROK=[2,3,5,6,5,6,8,9,11,0]
g={k(x['일간']):k(x['지지']) for x in R['일간 × 십이운성 격자에 걸리는 신살']['표'] if x['신살']=='건록'}
print({s: (g.get(s), BR[GEONROK[i]], '=' if g.get(s)==BR[GEONROK[i]] else 'X') for i,s in enumerate(STEMS)})

print('=== ③ 천을귀인 ===')
CHEONEUL=[[1,7],[0,8],[11,9],[11,9],[1,7],[0,8],[1,7],[6,2],[5,3],[5,3]]
ce={}
for x in R['일간 × 십이운성 격자에 걸리는 신살']['표']:
    if x['신살'].startswith('천을귀인'): ce.setdefault(k(x['일간']),set()).add(k(x['지지']))
for i,s in enumerate(STEMS):
    eng={BR[j] for j in CHEONEUL[i]}
    print(f"  {s}: 보드{sorted(ce.get(s,[]))} 엔진{sorted(eng)} {'=' if ce.get(s)==eng else 'X'}")

print('=== ④ 홍염 ===')
HONGYEOM=[6,6,2,7,4,4,10,9,0,8]
hy={}
for x in R['일간 × 십이운성 격자에 걸리는 신살']['표']:
    if x['신살'].startswith('홍염'): hy.setdefault(k(x['일간']),set()).add(k(x['지지']))
for i,s in enumerate(STEMS):
    print(f"  {s}: 보드{sorted(hy.get(s,[])) or '없음'} 엔진[{BR[HONGYEOM[i]]}]")

print('=== ⑤ 양인 ===')
YANGIN={0:3,2:6,4:6,6:9,8:0}
ya={k(x['입력']):k(x['출력']) for x in R['양인 조견표 (음간 포함 판본)']['표']}
for i,s in enumerate(STEMS):
    e=BR[YANGIN[i]] if i in YANGIN else '(없음)'
    print(f"  {s}: 보드표A={ya.get(s)} 엔진={e}")

print('=== ⑥ 지장간 ===')
HID=[['임','계'],['계','신','기'],['무','병','갑'],['갑','을'],['을','계','무'],['무','경','병'],
     ['병','기','정'],['정','을','기'],['무','임','경'],['경','신'],['신','정','무'],['무','갑','임']]
for row in R['지장간 조견표 (여기·중기·정기 + 일수)']['표']:
    b=k(row['지지']); i=BR.index(b)
    bd=[x['천간'][0] for x in row['지장간']]
    bd=['무' if c=='무' else c for c in bd]
    print(f"  {b}: 보드{bd} 엔진{HID[i]} {'=' if bd==HID[i] else 'X'}  일수{[x['일수'] for x in row['지장간']]}")

print('=== ⑦ 십이신살 (엔진 공식 대조) ===')
TW=['겁살','재살','천살','지살','년살','월살','망신살','장성살','반안살','역마살','육해살','화개살']
def eng_sinsal(base_b, target_b):
    g=base_b%4; wang=(12-3*g)%12; start=(wang+5)%12
    return TW[(target_b-start)%12]
SEASON_BASE={'봄 (목국)':'묘','여름 (화국)':'오','가을 (금국)':'유','겨울 (수국)':'자'}
bad=[]
for row in R['십이신살 완전표 (기준 계절국 × 신살 14종)']['표']:
    nm=re.sub(r'\(.*','',row['신살']).strip()
    if nm in ('고신살','과숙살','재살','년살','월살','반안살'):
        nm={'재살':'재살','년살':'년살','월살':'월살','반안살':'반안살'}.get(nm,nm)
    if nm not in TW: continue
    bb=BR.index(SEASON_BASE[row['기준 계절(국)']]); tb=BR.index(k(row['지지']))
    if eng_sinsal(bb,tb)!=nm: bad.append((row['기준 계절(국)'],nm,row['지지'],eng_sinsal(bb,tb)))
print(f'불일치 {len(bad)}/48', bad[:6])

print('=== ⑧ 공망 ===')
def eng_gm(dec):
    f=(10-dec*2+12)%12
    return [BR[f],BR[(f+1)%12]]
for i,row in enumerate(R['공망표 (60갑자 6순)']['표']):
    print(f"  {row['순(旬)']}: 보드'{row['공망']}' 엔진{eng_gm(i)}")
