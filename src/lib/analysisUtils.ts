import type { AnalysisFinding, ReasoningStep } from './analysisTypes';

const CAVITY_KEYWORDS = ['空洞', 'cavity'];

const hasCavity = (value?: string) => {
  const text = (value ?? '').toLowerCase();
  return text.length > 0 && CAVITY_KEYWORDS.some((keyword) => text.includes(keyword));
};

export const filterFindings = (findings: AnalysisFinding[] = []) =>
  findings.filter((finding) => !hasCavity(finding.type));

export const filterReasoningSteps = (steps: ReasoningStep[] = []) =>
  steps.filter((step) => {
    const text = typeof step === 'string' ? step : step.text;
    return !hasCavity(text);
  });
