import { apiConfig } from './apiConfig';

interface DraftContext {
  patientName?: string;
  riskLevel?: string;
  tbProbability?: number;
  findings?: Array<{ location?: string; type?: string; size?: string | number }>;
  symptoms?: string[];
  history?: string[];
}

const fallbackDraft = (ctx: DraftContext) => {
  const findingsText =
    ctx.findings && ctx.findings.length > 0
      ? ctx.findings
          .map((f) => `${f.location || '肺野'}可见${f.type || '异常'}${f.size ? `，约 ${f.size}` : ''}`)
          .join('；')
      : '双肺纹理增多，未见明确活动性病灶。';
  return `影像表现：
${findingsText}

初步印象：
${ctx.riskLevel ? `风险等级：${ctx.riskLevel}` : '结合临床，建议进一步评估'}${ctx.tbProbability ? `（TB 概率 ${ctx.tbProbability}%）` : ''}

建议：
1. 痰涂片与培养
2. 结核免疫学检查（IGRA/PPD）
3. 必要时随访影像`;
};

export async function generateReportDraft(ctx: DraftContext): Promise<string> {
  const apiKey = apiConfig.deepseek.apiKey;
  const baseUrl = apiConfig.deepseek.baseUrl || 'https://api.deepseek.com';
  if (!apiKey) {
    console.warn('DeepSeek API key not set, using fallback draft.');
    return fallbackDraft(ctx);
  }

  try {
    const prompt = `你是肺结核影像与CDSS助手。根据提供的发现/症状/史生成中文结构化报告草稿，包含：影像表现、初步印象、建议三段，句子简洁、带可编辑占位。输入：${JSON.stringify(
      ctx
    )}`;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是肺结核影像辅助诊疗助手，输出中文简洁报告草稿。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      console.warn('DeepSeek API error:', response.status, await response.text());
      return fallbackDraft(ctx);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return fallbackDraft(ctx);
    return text.trim();
  } catch (error) {
    console.warn('DeepSeek call failed, using fallback draft:', error);
    return fallbackDraft(ctx);
  }
}
