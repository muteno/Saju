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
export interface ContextReading {
  policy: 'natal-work-context-v1';
  kind: 'conditional_structural_reading';
  dayPillar: string;
  groups: Record<string, { surface: ContextMarker[]; hidden: ContextMarker[];
    status: 'surface_present' | 'hidden_only' | 'absent' }>;
  conditions: Record<string, 'met' | 'unmet'>;
  monthMain: ContextMarker;
  hourStem: ContextMarker;
  blocks: { label: string; lines: string[] }[];
  note: string;
  predictionEnabled: false;
  trainingEligible: false;
  probability: null;
}
export function buildContextReading(chart: unknown): ContextReading | null;
