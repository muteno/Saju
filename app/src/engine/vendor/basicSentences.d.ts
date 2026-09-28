export const BASIC_SENTENCE_POLICY: string;
export const BASIC_SENTENCE_NOTICE: string;
export const UNREVIEWED_ILJU_NOTICE: string;
export function basicSentenceMatches(value: unknown): string[];
export function basicSentenceReviews(key: string, ids?: string[]): Array<{
  id: string; key: string; pointer: (string | number)[];
  review: Record<string, string>; sources: Array<{ unit: string; doc: string; title: string;
    archive: string; lineage: string; bodyParagraphs: number[]; xmlParagraphs: number[] }>;
  personalApplication: 'withheld'; trainingEligible: false; probability: null;
}>;
export function applyBasicSentencePolicy<T extends Record<string, unknown>>(block: T): T & Record<string, unknown>;

export function safeBasicSentenceParagraphs(text: string): string[];
