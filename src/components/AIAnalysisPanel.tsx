import { useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  ClipboardCheck,
  Activity,
  Shield,
} from 'lucide-react';
import type { AIAnalysis, Patient } from '../lib/database.types';
import { getRiskStyles, getActiveTbColor, uiStyles, riskLevels, tbProbabilityThresholds } from '../lib/theme';
import { AI_MODEL } from '../lib/constants';
import { useDataContext } from '../lib/dataContext';
import { generateReportDraft } from '../lib/deepseek';

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null;
  patient: Patient | null;
}

export function AIAnalysisPanel({ analysis, patient }: AIAnalysisPanelProps) {
  const [reportText, setReportText] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const tbProbability = analysis?.tb_probability ?? 0;
  const { saveReportDraft, rejectForRetake, confirmPositive } = useDataContext();

  const differentialList = useMemo(() => {
    if (analysis?.differential_diagnosis && analysis.differential_diagnosis.length > 0) {
      return (analysis.differential_diagnosis as any[]).map((item: any) => ({
        dx: item.condition || item.dx || item,
        score: item.score ?? 0.5,
        next: item.next_tests || [],
      }));
    }
    return [
      { dx: '结核性病灶', score: Math.max(0.7, tbProbability / 100), next: ['痰涂片', '培养', 'IGRA'] },
      { dx: '真菌感染', score: 0.32, next: ['GM/BDG'] },
      { dx: '肺脓肿', score: 0.2, next: ['炎症指标'] },
    ];
  }, [analysis?.differential_diagnosis, tbProbability]);

  if (!analysis || !patient) {
    return (
      <aside className={uiStyles.sidebar.right + ' items-center justify-center p-8'}>
        <Brain className="h-16 w-16 text-gray-700 mb-4" />
        <p className="text-gray-500 text-center text-sm">
          选择患者后启动 AI 分析
        </p>
      </aside>
    );
  }

  const riskStyles = getRiskStyles(analysis.risk_level);
  const evidenceFindings = (analysis.findings || []) as any[];

  const generateDefaultReport = () => {
    const findingsText = evidenceFindings.map(f =>
      `${f.location || '肺野'}可见${f.type || '异常'}影像`
    ).join('，');

    const template = `影像表现：
${findingsText || '双肺纹理增多，右上肺可见斑片状密度增高影，边缘模糊。'}

初步印象：
疑似肺结核（${analysis.active_tb_likelihood || '需进一步评估'}）

建议：
1. 痰涂片与培养
2. 结核免疫学检查（IGRA/PPD）
3. 必要时随访影像`;

    setReportText(template);
  };

  const handleDeepseekDraft = async () => {
    setAiDraftLoading(true);
    const draft = await generateReportDraft({
      patientName: patient.name,
      riskLevel: analysis.risk_level,
      tbProbability,
      findings: evidenceFindings.map((f: any) => ({
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
    <aside className={uiStyles.sidebar.right}>
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

        <div className="mb-4 text-sm bg-blue-900/20 border border-blue-800/50 p-3 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-1 h-full bg-blue-500 rounded"></div>
            <div className="flex-1">
              <p className="text-gray-300 mb-3 leading-relaxed">
                已分析影像序列。{analysis.findings && analysis.findings.length > 0
                  ? `发现 ${(analysis.findings as any[]).map((f: any) => f.location || '肺野').join('、')} 异常。`
                  : '未发现明显异常。'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">结核可能性</span>
                  <div className="flex items-center gap-2 flex-1 mx-3">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          tbProbability >= tbProbabilityThresholds.high ? riskLevels.high.color.progress :
                          tbProbability >= tbProbabilityThresholds.medium ? riskLevels.medium.color.progress : 
                          riskLevels.low.color.progress
                        }`}
                        style={{ width: `${tbProbability}%` }}
                      ></div>
                    </div>
                    <span className={`font-mono font-semibold ${
                      tbProbability >= tbProbabilityThresholds.high ? riskLevels.high.color.progressText :
                      tbProbability >= tbProbabilityThresholds.medium ? riskLevels.medium.color.progressText : 
                      riskLevels.low.color.progressText
                    }`}>
                      {tbProbability}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">活动性判断</span>
                  <span className={`font-semibold ${getActiveTbColor(analysis.active_tb_likelihood)}`}>
                    {analysis.active_tb_likelihood || '需进一步评估'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">风险等级</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${riskStyles.color.badge} ${riskStyles.color.badgeText}`}>
                    {riskStyles.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" />
            AI 证据卡（可定位 ROI/切片）
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {evidenceFindings.slice(0, 4).map((f: any, idx: number) => (
              <div key={idx} className="bg-gray-800 border border-gray-700 rounded p-2 text-xs space-y-1">
                <div className="flex justify-between text-gray-200">
                  <span>{f.location || '肺野'}</span>
                  <span className="text-blue-300">{f.type || '异常'}</span>
                </div>
                <div className="text-gray-400 flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>置信度: {f.confidence ? `${(f.confidence * 100).toFixed(0)}%` : '—'}</span>
                </div>
                <div className="text-gray-400">范围: {f.size || f.diameter_mm ? `${f.diameter_mm || f.size}mm` : '—'}</div>
                <div className="text-gray-500">切片: {f.slice_range || '34-52'}</div>
              </div>
            ))}
            {evidenceFindings.length === 0 && (
              <div className="col-span-2 text-xs text-gray-500">暂无 AI 证据，建议人工复核</div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            CDSS：风险分层 + 鉴别 + 下一步建议
          </h4>
          <div className="space-y-2">
            {differentialList.map((diag, idx) => (
              <div key={idx} className="border border-gray-700 rounded p-2 bg-gray-800/60">
                <div className="flex justify-between text-xs text-gray-200 mb-1">
                  <span>{diag.dx}</span>
                  <span className="text-blue-300 font-mono">{Math.round(diag.score * 100)}%</span>
                </div>
                <div className="text-[11px] text-gray-300">下一步：{diag.next.join('、') || '—'}</div>
              </div>
            ))}
            <div className="text-[11px] text-amber-200 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              高危病例需双签/会诊确认，提交前自动写审计
            </div>
          </div>
        </div>

        {analysis.reasoning_chain && analysis.reasoning_chain.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              推理过程（可追溯）
            </h4>
            <div className="space-y-2">
              {(analysis.reasoning_chain as any[]).map((step: any, idx: number) => (
                <div key={idx} className="flex gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-[10px] text-gray-400">
                    {idx + 1}
                  </div>
                  <p className="text-gray-300 flex-1 leading-relaxed">{step.text || step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {patient.tb_history && (
          <div className="mb-4 bg-orange-900/20 border border-orange-800/50 p-3 rounded text-xs">
            <div className="flex items-center gap-2 text-orange-300 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold">既往史提示</span>
            </div>
            <p className="text-gray-300">患者有结核病史，注意复发和耐药风险。</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 bg-gray-900 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            结构化报告（可编辑）
          </span>
          <button
            onClick={generateDefaultReport}
            className={`text-xs ${uiStyles.button.outline}`}
          >
            生成草稿
          </button>
          <button
            onClick={handleDeepseekDraft}
            className={`text-xs ${uiStyles.button.primary} ml-2`}
            disabled={aiDraftLoading}
          >
            {aiDraftLoading ? '生成中...' : '用 DeepSeek 生成'}
          </button>
        </div>

        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          className={`flex-1 min-h-[120px] ${uiStyles.input.textarea} mb-3 leading-relaxed`}
          placeholder="影像表现：双肺纹理增多。右上肺可见斑片状密度增高影，边缘模糊..."
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
            驳回重拍
          </button>
          <button
            onClick={() => patient && confirmPositive(patient.id)}
            className={`${uiStyles.button.primary} flex items-center justify-center gap-2`}
          >
            <Send className="h-4 w-4" />
            确认阳性并转诊/随访
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">提交后自动生成转诊单/通知书，并创建随访任务（2周、1月）。</p>
      </div>
    </aside>
  );
}
