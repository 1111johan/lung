export interface AnalysisFinding {
  location?: string;
  type?: string;
  size?: string | number;
  diameter_mm?: number;
  confidence?: number;
  slice_range?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DifferentialDiagnosis {
  condition?: string;
  dx?: string;
  score?: number;
  next_tests?: string[];
  next?: string[];
}

export type ReasoningStep = { text?: string } | string;

