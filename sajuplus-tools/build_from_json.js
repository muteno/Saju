const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, BorderStyle,
} = require('docx');

const SCRATCH = __dirname;
const DEST = 'C:/Users/Hwang/Desktop/새 폴더';
const DATA = JSON.parse(fs.readFileSync(process.argv[2] || path.join(SCRATCH, 'boards_full.json'), 'utf8'));
const META = JSON.parse(fs.readFileSync(process.argv[3] || path.join(SCRATCH, 'boards_meta.json'), 'utf8'));
const FONT = { ascii: 'Malgun Gothic', eastAsia: 'Malgun Gothic', hAnsi: 'Malgun Gothic', cs: 'Malgun Gothic' };

// Strip characters illegal in XML 1.0 (control chars except tab/newline/CR, and noncharacters)
function xmlClean(s) {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F￾￿]/g, '');
}

function parseArticle(chunk) {
  const lines = xmlClean(chunk).split(/\r?\n/).map(l => l.trim());
  const title = (lines[0] || '').replace(/^[▽△◇◎▷◆◈●○\s]+/, '').replace(/\.$/, '').trim() || '(제목 없음)';
  const titleBare = title.replace(/^\d{2,3}(_\d+)?\./, '').replace(/\s+/g, '');
  let date = null, comments = null, views = null, author = null;
  const body = [], relLinks = [];
  for (let i = 1; i < lines.length; i++) {
    let l = lines[i];
    if (!l) continue;
    const stripped = l.replace(/[\u{1F50A}\u{23F8}\u{FE0F}\u{25B6}]/gu, '').trim();
    if (!stripped || stripped === '.') continue;
    l = stripped;
    if (!date && /^(\d{4}-\d{2}-\d{2})/.test(l)) { date = RegExp.$1; continue; }
    if (!author && /^작성\s*[:：]\s*(.+)$/.test(l)) { author = RegExp.$1.trim(); continue; }
    if (!comments && /^댓글\s*[:：]\s*\((\d+)\)/.test(l)) { comments = RegExp.$1; continue; }
    if (!views && /^(조회|열람)\s*[:：]\s*(\d+)/.test(l)) { views = RegExp.$2; continue; }
    if (l === 'URL복사' || l === '▶') continue;
    if (l.startsWith('❚')) {
      const rest = l.replace(/^❚\s*관련자료링크\s*/, '').trim();
      if (rest.startsWith('▸')) relLinks.push(rest.replace(/^▸\s*/, ''));
      else if (rest) body.push('■ ' + rest);
      continue;
    }
    if (l.startsWith('▸')) { relLinks.push(l.replace(/^▸\s*/, '')); continue; }
    if (body.length === 0 && l.replace(/[\s.]+/g, '') === titleBare.replace(/[.]+$/, '')) continue;
    body.push(l);
  }
  return { title, date, comments, views, author, body, relLinks };
}

function para(l) {
  if (l.startsWith('■')) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(l.replace(/^■\s*/, ''))] });
  }
  if ((l.startsWith('[') || l.startsWith('【')) && l.length <= 32) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(l)] });
  }
  if (/^\d[\s.)]/.test(l) && l.length <= 32) {
    return new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: l, bold: true, size: 22, color: '3F3F46' })] });
  }
  if (l.startsWith('-') && l.length <= 32) {
    return new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: l.replace(/^-\s*/, ''), bold: true, color: '52525B' })] });
  }
  if (/^[.▸]\S/.test(l) || /^\.\s+\S/.test(l)) {
    return new Paragraph({ numbering: { reference: 'dots', level: 0 }, spacing: { after: 30 }, children: [new TextRun(l.replace(/^[.▸]\s*/, ''))] });
  }
  return new Paragraph({ spacing: { after: 90 }, children: [new TextRun(l)] });
}

function buildDoc(boardName, articles) {
  const children = [];
  children.push(
    new Paragraph({ spacing: { before: 2200, after: 200 }, children: [new TextRun({ text: boardName, size: 46, bold: true, color: '14532D' })] }),
    new Paragraph({ spacing: { after: 600 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '14532D', space: 8 } },
      children: [new TextRun({ text: `게시판 글 모음 · 총 ${articles.length}개 글`, size: 26, color: '555555' })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '출처: 플러스명리학 (saju.sajuplus.net)', size: 20, color: '666666' })] }),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: '저장일: 2026-07-12', size: 20, color: '666666' })] }),
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: '※ 게시판 원문의 텍스트를 그대로 수록했습니다. 원문에 포함된 그림·도표 이미지와 댓글은 포함되어 있지 않습니다.', size: 18, italics: true, color: '888888' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun('수록 글 목록')] }),
  );
  for (const a of articles) {
    children.push(new Paragraph({ numbering: { reference: 'dots', level: 0 }, spacing: { after: 30 },
      children: [new TextRun({ text: a.title, size: 20 }), new TextRun({ text: a.date ? `  (${a.date})` : '', size: 17, color: '888888' })] }));
  }
  for (const a of articles) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(a.title)] }));
    const meta = [];
    if (a.author) meta.push(`작성 ${a.author}`);
    if (a.date) meta.push(`작성일 ${a.date}`);
    if (a.comments) meta.push(`댓글 ${a.comments}`);
    if (a.views) meta.push(`조회 ${Number(a.views).toLocaleString()}`);
    children.push(new Paragraph({ spacing: { after: 260 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 6 } },
      children: [new TextRun({ text: meta.join(' · ') || '(정보 없음)', size: 18, color: '777777' })] }));
    if (!a.body.length) children.push(new Paragraph({ children: [new TextRun({ text: '(본문 없음)', italics: true, color: '999999' })] }));
    for (const l of a.body) children.push(para(l));
    if (a.relLinks.length) {
      children.push(new Paragraph({ spacing: { before: 300, after: 60 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } },
        children: [new TextRun({ text: '관련자료링크', bold: true, size: 20, color: '166534' })] }));
      for (const r of a.relLinks) children.push(new Paragraph({ numbering: { reference: 'dots', level: 0 }, spacing: { after: 30 }, children: [new TextRun({ text: r, size: 19, color: '555555' })] }));
    }
  }
  return new Document({
    styles: { default: {
      document: { run: { font: FONT, size: 21, color: '27272A' }, paragraph: { spacing: { line: 300 } } },
      heading1: { run: { font: FONT, size: 29, bold: true, color: '14532D' }, paragraph: { spacing: { after: 80 } } },
      heading2: { run: { font: FONT, size: 24, bold: true, color: '166534' }, paragraph: { spacing: { before: 240, after: 90 } } },
    } },
    numbering: { config: [{ reference: 'dots', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] }] },
    sections: [{ children }],
  });
}

(async () => {
  const summary = [];
  for (const m of META) {
    const chunks = DATA[m.slug] || [];
    if (!chunks.length) { console.log('SKIP (no data):', m.name); continue; }
    const articles = chunks.map(parseArticle);
    const doc = buildDoc(m.name, articles);
    const out = path.join(DEST, `${m.name} 게시판 글모음.docx`);
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(out, buf);
    const failed = articles.filter(a => a.body.join('').includes('본문 추출 실패')).length;
    summary.push({ name: m.name, posts: articles.length, kb: Math.round(buf.length / 1024), failed });
    console.log(`WROTE ${m.name}: ${articles.length} posts, ${Math.round(buf.length / 1024)} KB, extract-fails=${failed}`);
  }
  fs.writeFileSync(path.join(SCRATCH, 'build_summary.json'), JSON.stringify(summary, null, 1));
  console.log('DONE', summary.reduce((a, b) => a + b.posts, 0), 'posts total');
})();
