"""Read-only corpus inventory and literal term concordance. No semantic claims inferred."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile
from collections import Counter
import xml.etree.ElementTree as ET

TERMS = {
    '음양': ['음양', '陰陽'], '오행': ['오행', '五行'],
    '상생': ['상생', '相生'], '상극': ['상극', '相剋'],
    '천간': ['천간', '天干'], '지지': ['지지', '地支'],
    '일간': ['일간', '日干', '일원', '日元'], '십신': ['십신', '십성', '十神', '十星'],
    '비견': ['비견', '比肩'], '겁재': ['겁재', '劫財'],
    '식신': ['식신', '食神'], '상관': ['상관', '傷官'],
    '편재': ['편재', '偏財'], '정재': ['정재', '正財'],
    '편관': ['편관', '偏官', '칠살', '七殺'], '정관': ['정관', '正官'],
    '편인': ['편인', '偏印'], '정인': ['정인', '正印', '인수', '印綬'],
    '식상': ['식상', '食傷'], '재성': ['재성', '財星'],
    '관성': ['관성', '官星'], '인성': ['인성', '印星'],
    '식신생재': ['식신생재', '食神生財'], '식상생재': ['식상생재', '食傷生財'],
    '관인상생': ['관인상생', '官印相生'], '상관견관': ['상관견관', '傷官見官'],
    '재다신약': ['재다신약', '財多身弱'], '신강': ['신강', '身強'],
    '신약': ['신약', '身弱'], '월령': ['월령', '月令'],
    '통근': ['통근', '通根'], '투간': ['투간', '透干'], '투출': ['투출', '透出'],
    '지장간': ['지장간', '支藏干'], '합화': ['합화', '合化'],
    '육합': ['육합', '六合'], '삼합': ['삼합', '三合'], '방합': ['방합', '方合'],
    '육충': ['육충', '六沖'], '형': ['형살', '刑殺'],
    '용신': ['용신', '用神'], '희신': ['희신', '喜神'], '기신': ['기신', '忌神'],
    '조후': ['조후', '調候'], '격국': ['격국', '格局'],
    '대운': ['대운', '大運'], '세운': ['세운', '歲運'], '월운': ['월운', '月運'],
    '절기': ['절기', '節氣'], '일주': ['일주', '日柱'],
    '도화': ['도화', '桃花'], '역마': ['역마', '驛馬'], '화개': ['화개', '華蓋'],
}

def source_units(path):
    if path.suffix == '.md':
        return [{'locator': f'L{i}', 'text': text} for i, text in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1) if text.strip()]
    with zipfile.ZipFile(path) as doc:
        xml = ET.fromstring(doc.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    rows=[]
    for i, p in enumerate(xml.findall('.//w:p', ns), 1):
        text=''.join(t.text or '' for t in p.findall('.//w:t', ns))
        if text.strip(): rows.append({'locator': f'XML-P{i}', 'text': text})
    return rows

def build(source, output):
    output.mkdir(parents=True, exist_ok=True)
    docs=[]; corpus=[]; concordance={k:{'aliases':v,'documents':[], 'occurrences':0,'samples':[]} for k,v in TERMS.items()}
    expressions={k:re.compile('|'.join(re.escape(x) for x in sorted(v,key=len,reverse=True))) for k,v in TERMS.items()}
    for p in sorted(source.rglob('*')):
        if not p.is_file() or p.suffix not in ('.md','.docx'): continue
        raw=p.read_bytes(); rel=p.relative_to(source).as_posix(); sid='src-'+hashlib.sha256(rel.encode()).hexdigest()[:12]
        units=source_units(p); content='\n'.join(u['text'] for u in units)
        kind='transcript' if '/3. 전사본/도화도레_사주/' in '/'+rel else 'web_archive' if p.suffix=='.docx' else 'operator_note' if '방법론보드' in p.name else 'manifest'
        cluster='dohwadore_dohwaroun' if kind=='transcript' or p.name.startswith('도화로운') else 'operator_derived' if kind=='operator_note' else None
        doc={'id':sid,'path':rel,'kind':kind,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'unit_count':len(units),'text_characters':len(content),'author_cluster':cluster,'author_cluster_note':'명세 확인' if cluster else '미확정; 문서 수를 독립 저자 수로 해석하지 않음'}
        docs.append(doc);corpus.append({**doc,'units':units})
        if kind=='manifest': continue
        for key, exp in expressions.items():
            hits=[(u,m) for u in units for m in exp.finditer(u['text'])]
            if not hits: continue
            item=concordance[key];item['occurrences']+=len(hits);item['documents'].append(sid)
            # Short literal evidence pointers only; same-source repetitions never become confidence.
            for u,m in hits[:2]:
                if len(item['samples'])<8:
                    item['samples'].append({'source_id':sid,'locator':u['locator'],'text':u['text'][max(0,m.start()-60):m.end()+110]})
    summary={'files':len(docs),'kinds':dict(Counter(d['kind'] for d in docs)),'raw_bytes':sum(d['bytes'] for d in docs),'extracted_characters':sum(d['text_characters'] for d in docs),'dictionary_terms':len(TERMS),'coverage':'All files inventoried and text extracted; literal concordance only. Semantic review is limited to cited pilot rules.','locator_convention':{'md':'1-based physical line after UTF-8 BOM decoding','docx':'1-based w:p position in document.xml, counting empty paragraphs and table paragraphs; not rendered page number'},'known_author_overlap':'Dohwadore transcripts and Dohwaroun web text are one author cluster; operator notes are derivative.'}
    for name,obj in [('corpus_inventory.json',{'summary':summary,'documents':docs}),('term_concordance.json',concordance)]:
        (output/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    (output.parent/'corpus_internal.json').write_text(json.dumps(corpus,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();build(args.source,args.output)
