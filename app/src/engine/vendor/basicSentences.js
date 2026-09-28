// Delivery policy for selected archival drafts; not a semantic classifier or predictor.
import originalRecords from './basicSentenceData.js';
import gapinRecords from './gapinSentenceData.js';
const records = [...originalRecords, ...gapinRecords];

export const BASIC_SENTENCE_POLICY = 'reviewed-sentences-withheld-v2-gapin';
export const BASIC_SENTENCE_NOTICE = '조건·시기·출처를 검토한 일부 문장은 개인에게 적용할 근거가 부족해 풀이에서 보류했어요.';
export const UNREVIEWED_ILJU_NOTICE = '남은 일주 설명은 문장별 출처와 적용 조건을 아직 검수하지 않은 문헌 초안이에요. 개인의 성향이나 결과로 확정하지 않아요.';
export const GAPIN_SENTENCE_NOTICE = '갑인 서술은 원문과 대조했지만 개인에게 적용할 조건과 효과는 확인되지 않았어요. 개인 해석은 보류해요.';
const copy = value => JSON.parse(JSON.stringify(value));
const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const matchers = records.map(record => ({ record, needles: record.needles.map(normalize) }));

// Match whole reviewed wording, including a copy embedded in a quote/Brain record.
// A matching view withholds the entire comparison, never just one author's side.
export function basicSentenceMatches(value, key = null) {
  const strings = [];
  const visit = v => {
    if (typeof v === 'string') strings.push(normalize(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(value);
  const matched = matchers.filter(({ record, needles }) =>
    (record.matchScope !== 'gapin_block_only' || key === record.key) && needles.some(n => strings.some(s => s.includes(n))))
    .map(({ record }) => record);
  return [...new Set(matched.flatMap(record => [record.id, ...(record.comparisonIds ?? [])]))];
}

export function basicSentenceReviews(key, ids = []) {
  return copy(records.filter(record => (record.key === key || ids.includes(record.id))).map(({ needles, ...record }) => record));
}

/** Detached projection: retain unreviewed wording, withhold reviewed text, never guess a source. */
export function applyBasicSentencePolicy(block) {
  const knownPolicy = block.basicReview?.policy === BASIC_SENTENCE_POLICY ? records
    : block.basicReview?.policy === 'reviewed-sentences-withheld-v1' ? originalRecords : [];
  const out = { ...block }, removed = new Set(
    (block.basicReview?.withheldIds ?? []).filter(id => knownPolicy.some(record => record.id === id)));
  const keep = value => {
    const ids = basicSentenceMatches(value, block.key); ids.forEach(id => removed.add(id)); return !ids.length;
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
    out.basicReview = { policy: BASIC_SENTENCE_POLICY, status: block.key === 'ilju/갑인' ? 'source_reviewed_personal_withheld' : reviewed.length ? 'partial_review' : 'unreviewed',
      reviewed, withheldIds: [...removed],
      unreviewedNotice: block.key === 'ilju/갑인' ? GAPIN_SENTENCE_NOTICE : UNREVIEWED_ILJU_NOTICE,
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
