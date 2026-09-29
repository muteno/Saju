export const CONTEXT_READING_NOTICE: string;
export interface ContextMarker {
  position: 'year' | 'month' | 'day' | 'hour';
  part: 'stem' | 'hidden';
  stem: number;
  character: string;
  tenGod: string;
  group: string;
  principal: boolean;
}
export interface RootObservation {
  principal: ContextMarker[]; additional: ContextMarker[];
  status: 'principal_present' | 'additional_only' | 'absent';
}
export interface ContextReading {
  policy: 'natal-work-context-v8';
  kind: 'conditional_structural_reading';
  dayPillar: string;
  groups: Record<string, { surface: ContextMarker[]; hidden: ContextMarker[];
    status: 'surface_present' | 'hidden_only' | 'absent' }>;
  conditions: Record<string, 'met' | 'unmet'>;
  monthMain: ContextMarker;
  hourStem: ContextMarker;
  monthDayChung: {
    scope: 'natal-month-day-branch-chung';
    status: 'present' | 'absent';
    branches: number[];
    relation: { name: string; positions: string[] } | null;
    dayMain: ContextMarker;
    facts: string | null;
    interpretation: string | null;
    question: string | null;
  };
  monthDayYukhap: {
    scope: 'natal-month-day-branch-yukhap';
    status: 'present' | 'absent';
    branches: number[];
    relation: { name: string; positions: string[] } | null;
    dayMain: ContextMarker;
    facts: string | null;
    interpretation: string | null;
    question: string | null;
  };
  monthDayCompound: {
    scope: 'natal-month-day-yukhap-pa';
    status: 'present' | 'absent';
    branches: number[];
    relations: { kind: 'yukhap' | 'pa'; name: string; positions: string[] }[];
    dayMain: ContextMarker;
    facts: string | null;
    interpretation: string | null;
    question: string | null;
  };
  strength: {
    observation: { score: number; max: number; label: string;
      deukryeong: boolean; deukji: boolean; deuksi: boolean; deukse: boolean;
      detail: Record<'year' | 'month' | 'day' | 'hour', { stemHelp: boolean; branchHelp: boolean }> };
    band: 'strong' | 'weak' | 'balanced';
    supports: Omit<ContextMarker, 'group'>[];
    roots: { scope: 'four-natal-branches-existing-hidden-stems';
      sameStem: RootObservation; sameElement: RootObservation;
      facts: string; interpretation: string; question: string };
    facts: string;
    hypothesis: string;
    question: { id: string; prompt: string; clarifies: string };
  };
  experienceQuestions: { id: string; prompt: string; clarifies: string }[];
  blocks: { label: string; lines: string[] }[];
  note: string;
  predictionEnabled: false;
  trainingEligible: false;
  probability: null;
}
export function buildContextReading(chart: unknown): ContextReading | null;
