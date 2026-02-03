import { useMemo, useState } from 'react';
import { Brain, CheckCircle2, AlertCircle, FileText, Send, ClipboardCheck, Shield } from 'lucide-react';
import type { AIAnalysis, Patient } from '../lib/database.types';
import { getRiskStyles, getActiveTbColor, uiStyles, riskLevels, tbProbabilityThresholds } from '../lib/theme';
import { AI_MODEL } from '../lib/constants';
import { useDataContext } from '../lib/dataContext';
import { generateReportDraft } from '../lib/deepseek';
import { filterFindings, filterReasoningSteps } from '../lib/analysisUtils';
import type { AnalysisFinding, DifferentialDiagnosis, ReasoningStep } from '../lib/analysisTypes';

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null;
  patient: Patient | null;
}

interface DifferentialView {
  dx: string;
  score: number;
  next: string[];
}

export function AIAnalysisPanel({ analysis, patient }: AIAnalysisPanelProps) {
  const [reportText, setReportText] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const tbProbability = analysis?.tb_probability ?? 0;
  const { saveReportDraft, rejectForRetake, confirmPositive } = useDataContext();

  const rawFindings: AnalysisFinding[] = Array.isArray(analysis?.findings)
    ? (analysis?.findings as AnalysisFinding[])
    : [];
  const evidenceFindings = filterFindings(rawFindings);
  const rawReasoning: ReasoningStep[] = Array.isArray(analysis?.reasoning_chain)
    ? (analysis?.reasoning_chain as ReasoningStep[])
    : [];
  const reasoningSteps = filterReasoningSteps(rawReasoning);

  const differentialList: DifferentialView[] = useMemo(
    () =>
      Array.isArray(analysis?.differential_diagnosis) && analysis.differential_diagnosis.length > 0
        ? (analysis.differential_diagnosis as DifferentialDiagnosis[]).map((item) => ({
            dx: item.condition ?? item.dx ?? '待定',
            score: item.score ?? 0.5,
            next: item.next_tests ?? item.next ?? [],
          }))
        : [
            { dx: '结核可能性', score: Math.max(0.7, tbProbability / 100), next: ['痰检/培养', 'IGRA'] },
            { dx: '非典型感染', score: 0.32, next: ['GM/BDG'] },
            { dx: '肿瘤/占位', score: 0.2, next: ['肿瘤标志物'] },
          ],
    [analysis?.differential_diagnosis, tbProbability]
  );

  if (!analysis || !patient) {
    return (
      <aside className={uiStyles.sidebar.right + ' items-center justify-center p-8'}>
        <Brain className="h-16 w-16 text-gray-700 mb-4" />
        <p className="text-gray-500 text-center text-sm">选择患者后激活 AI 分析</p>
      </aside>
    );
  }

  const riskStyles = getRiskStyles(analysis.risk_level);

  const generateDefaultReport = () => {
    const findingsText = evidenceFindings
      .map((f) => `${f.location || '肺野'}可见${f.type || '异常'}影像${f.size ? `（${f.size}）` : ''}`)
      .join('；');

    const template = `影像表现：${findingsText || '未见明确异常，右上肺可疑病灶待排。'}

下一步检查：结核活动性评估（${analysis.active_tb_likelihood || '待进一步评估'}）。

建议：
1. 痰检/培养与IGRA/PPD；
2. 必要时补充增强CT或随访复查；
3. 若临床症状明显，请尽快线下就诊。`;
    setReportText(template);
  };

  const handleDeepseekDraft = async () => {
    setAiDraftLoading(true);
    const draft = await generateReportDraft({
      patientName: patient.name,
      riskLevel: analysis.risk_level,
      tbProbability,
      findings: evidenceFindings.map((f) => ({
        location: f.location,
        type: f.type,
        size: f.size || f.diameter_mm,
      })),
      symptoms: patient.chief_complaint ? [patient.chief_complaint] : [],
      history: patient.tb_history ? ['既往结核史'] : [],
    });
    setReportText(draft);
    setAiDraftLoading(false);
  };

  return (
    <aside className={`${uiStyles.sidebar.right} workstation-panel workstation-panel-strong`}>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-teal-500 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Agent Analysis
          </h3>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded font-mono">
            {analysis.model_version || AI_MODEL.defaultVersion}
          </span>
        </div>

        <div className="mb-4 text-sm analysis-section analysis-summary glass-card-hover">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-1 h-full bg-blue-500 rounded" />
            <div className="flex-1">
              <p className="text-gray-300 mb-3 leading-relaxed">
                已分析影像序列。
                {evidenceFindings.length > 0
                  ? `发现 ${evidenceFindings.map((f) => f.location || '肺野').join('、')} 可疑病灶。`
                  : '暂未发现明显异常。'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">结核概率</span>
                  <div className="flex items-center gap-2 flex-1 mx-3">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          tbProbability >= tbProbabilityThresholds.high
                            ? riskLevels.high.color.progress
                            : tbProbability >= tbProbabilityThresholds.medium
                            ? riskLevels.medium.color.progress
                            : riskLevels.low.color.progress
                        }`}
                        style={{ width: `${tbProbability}%` }}
                      />
                    </div>
                    <span
                      className={`font-mono font-semibold ${
                        tbProbability >= tbProbabilityThresholds.high
                          ? riskLevels.high.color.progressText
                          : tbProbability >= tbProbabilityThresholds.medium
                          ? riskLevels.medium.color.progressText
                          : riskLevels.low.color.progressText
                      }`}
                    >
                      {tbProbability}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">活动性判断</span>
                  <span className={`font-semibold ${getActiveTbColor(analysis.active_tb_likelihood)}`}>
                    {analysis.active_tb_likelihood || '待进一步评估'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">风险等级</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${riskStyles.color.badge} ${riskStyles.color.badgeText}`}
                  >
                    {riskStyles.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 analysis-section glass-card-hover">
          <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" />
            AI 影像要点（位置/类型）
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {evidenceFindings.slice(0, 4).map((f, idx) => (
              <div key={`${f.location}-${idx}`} className="analysis-item p-2 text-xs space-y-1">
                <div className="flex justify-between text-gray-200">
                  <span>{f.location || '肺野'}</span>
                  <span className="text-blue-300">{f.type || '异常'}</span>
                </div>
                <div className="text-gray-400">范围: {f.diameter_mm || f.size ? `${f.diameter_mm || f.size}mm` : '—'}</div>
                <div className="text-gray-500">切片: {f.slice_range || '—'}</div>
              </div>
            ))}
            {evidenceFindings.length === 0 && (
              <div className="col-span-2 text-xs text-gray-500">暂无 AI 影像要点，请人工复核。</div>
            )}
          </div>
        </div>

        <div className="mb-4 analysis-section glass-card-hover">
          <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            鉴别 & 下一步
          </h4>
          <div className="space-y-2">
            {differentialList.map((diag, idx) => (
              <div key={`${diag.dx}-${idx}`} className="analysis-item p-2">
                <div className="flex justify-between text-xs text-gray-200 mb-1">
                  <span>{diag.dx}</span>
                  <span className="text-blue-300 font-mono">{Math.round(diag.score * 100)}%</span>
                </div>
                <div className="text-[11px] text-gray-300">下一步：{diag.next.join('、') || '—'}</div>
              </div>
            ))}
            <div className="analysis-callout text-[11px] flex items-center gap-1">
              <Shield className="h-3 w-3" />
              高危病例需医生确认，提交后自动生成转诊/随访。
            </div>
          </div>
        </div>

        {reasoningSteps.length > 0 && (
          <div className="mb-4 analysis-section glass-card-hover">
            <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              推理链（可追溯）
            </h4>
            <div className="space-y-2">
              {reasoningSteps.map((step, idx) => (
                <div key={idx} className="flex gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-[10px] text-gray-400">
                    {idx + 1}
                  </div>
                  <p className="text-gray-300 flex-1 leading-relaxed">{typeof step === 'string' ? step : step.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {patient.tb_history && (
          <div className="mb-4 analysis-warning text-xs">
            <div className="flex items-center gap-2 text-[rgb(var(--warning))] mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold">既往结核提示</span>
            </div>
            <p className="text-gray-300">患者有既往结核史，请注意复发及药物安全。</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 bg-gray-900 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            结构化报告草稿
          </span>
          <div className="flex items-center">
            <button onClick={generateDefaultReport} className={`text-xs ${uiStyles.button.outline}`}>
              生成默认草稿
            </button>
            <button
              onClick={handleDeepseekDraft}
              className={`text-xs ${uiStyles.button.primary} ml-2`}
              disabled={aiDraftLoading}
            >
              {aiDraftLoading ? '生成中...' : '智慧生成'}
            </button>
          </div>
        </div>

        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          className={`flex-1 min-h-[120px] ${uiStyles.input.textarea} mb-3 leading-relaxed`}
          placeholder="影像表现、鉴别、建议..."
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => patient && saveReportDraft(patient.id, reportText)}
            className={`${uiStyles.button.secondary} flex items-center justify-center gap-2`}
          >
            保存草稿
          </button>
          <button
            onClick={() => patient && rejectForRetake(patient.id)}
            className={`${uiStyles.button.secondary} flex items-center justify-center gap-2`}
          >
            退回重拍
          </button>
          <button
            onClick={() => patient && confirmPositive(patient.id)}
            className={`${uiStyles.button.primary} flex items-center justify-center gap-2`}
          >
            <Send className="h-4 w-4" />
            确认阳性并转诊/随访
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">提交后将自动生成转诊单/通知，并创建随访节点（2周、1月）。</p>
      </div>
    </aside>
  );
}

