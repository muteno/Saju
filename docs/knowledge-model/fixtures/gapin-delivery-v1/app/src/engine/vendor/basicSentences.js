// Delivery policy for selected archival drafts; not a semantic classifier or predictor.
import records from './basicSentenceData.js';

export const BASIC_SENTENCE_POLICY = 'reviewed-sentences-withheld-v1';
export const BASIC_SENTENCE_NOTICE = '조건·시기·출처를 검토한 일부 문장은 개인에게 적용할 근거가 부족해 풀이에서 보류했어요.';
export const UNREVIEWED_ILJU_NOTICE = '남은 일주 설명은 문장별 출처와 적용 조건을 아직 검수하지 않은 문헌 초안이에요. 개인의 성향이나 결과로 확정하지 않아요.';
const copy = value => JSON.parse(JSON.stringify(value));
const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const matchers = records.map(record => ({ record, needles: record.needles.map(normalize) }));

// Match whole reviewed wording, including a copy embedded in a quote/Brain record.
// A matching view withholds the entire comparison, never just one author's side.
export function basicSentenceMatches(value) {
  const strings = [];
  const visit = v => {
    if (typeof v === 'string') strings.push(normalize(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(value);
  return matchers.filter(({ needles }) => needles.some(n => strings.some(s => s.includes(n))))
    .map(({ record }) => record.id);
}

export function basicSentenceReviews(key, ids = []) {
  return copy(records.filter(record => (record.key === key || ids.includes(record.id))).map(({ needles, ...record }) => record));
}

/** Detached projection: retain unreviewed wording, withhold reviewed text, never guess a source. */
export function applyBasicSentencePolicy(block) {
  const out = { ...block }, removed = new Set(
    block.basicReview?.policy === BASIC_SENTENCE_POLICY
      ? (block.basicReview.withheldIds ?? []).filter(id => records.some(record => record.id === id)) : []);
  const keep = value => {
    const ids = basicSentenceMatches(value); ids.forEach(id => removed.add(id)); return !ids.length;
  };
  if (block.distilled) {
    const d = block.distilled;
    out.distilled = { ...d, distilled: Object.fromEntries(Object.entries(d.distilled ?? {}).flatMap(([key, value]) =>
      Array.isArray(value) ? [[key, value.filter(keep)]] : keep(value) ? [[key, value]] : [])) };
    for (const key of ['인용', '관점차이', '기타'])
      if (Array.isArray(d[key])) out.distilled[key] = d[key].filter(keep);
  }
  if (block.excerpts) out.excerpts = block.excerpts.map(ex => ({ ...ex, paras: ex.paras.filter(keep) }));
  if (block.key?.startsWith('ilju/')) {
    const d = out.distilled;
    // A position is retained as a locator, never used as a claim's identity after filtering.
    out.sentences = Object.entries(d?.distilled ?? {}).flatMap(([field, value]) =>
      (Array.isArray(value) ? value : [value]).filter(v => typeof v === 'string')
        .map(text => ({ field, text, reviewStatus: 'unreviewed', personalApplication: 'not_evaluated', sources: [] })));
    const reviewed = basicSentenceReviews(block.key, [...removed]);
    out.basicReview = { policy: BASIC_SENTENCE_POLICY, status: reviewed.length ? 'partial_review' : 'unreviewed',
      reviewed, withheldIds: [...removed],
      unreviewedNotice: UNREVIEWED_ILJU_NOTICE,
      ...(removed.size ? { note: BASIC_SENTENCE_NOTICE } : {}), probability: null };
  } else if (removed.size) {
    out.basicReview = { policy: BASIC_SENTENCE_POLICY, reviewed: basicSentenceReviews(null, [...removed]), withheldIds: [...removed], note: BASIC_SENTENCE_NOTICE };
  }
  return out;
}

/** Preserve separately paired paragraphs, but never split a normalized matched claim into a bypass. */
export function safeBasicSentenceParagraphs(text) {
  const ids = basicSentenceMatches(text), parts = text.split(/\n\s*\n/u);
  const located = new Set(parts.flatMap(basicSentenceMatches));
  if (ids.some(id => !located.has(id))) return [];
  const kept = parts.filter(part => !basicSentenceMatches(part).length);
  // One complete copy must not hide another occurrence split across paragraphs.
  return basicSentenceMatches(kept.join('\n\n')).length ? [] : kept;
}
