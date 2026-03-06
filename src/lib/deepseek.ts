import type { AppLocale } from './i18n';

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const API_BASE =
  import.meta.env.VITE_DEEPSEEK_API_BASE ||
  import.meta.env.VITE_DEEPSEEK_BASE_URL ||
  'https://api.deepseek.com';
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';

interface DeepseekChoice {
  message?: { content?: string };
}

interface DeepseekResp {
  choices?: DeepseekChoice[];
}

const answerLanguagePrompt: Record<AppLocale, string> = {
  zh: '请使用简体中文回答。',
  en: 'Please answer in clear and professional English.',
  th: 'โปรดตอบเป็นภาษาไทยที่สุภาพและเป็นมืออาชีพ',
  id: 'Mohon jawab dalam Bahasa Indonesia yang jelas dan profesional.',
  ms: 'Sila jawab dalam Bahasa Melayu yang jelas dan profesional.',
};

const fallbackServiceError: Record<AppLocale, string> = {
  zh: '当前 AI 服务不可用，请稍后重试或联系管理员。',
  en: 'AI service is currently unavailable. Please try again later.',
  th: 'บริการ AI ไม่พร้อมใช้งานในขณะนี้ โปรดลองใหม่ภายหลัง',
  id: 'Layanan AI sedang tidak tersedia. Silakan coba lagi nanti.',
  ms: 'Perkhidmatan AI tidak tersedia buat masa ini. Sila cuba lagi kemudian.',
};

function sanitizeAnswer(text: string) {
  const withoutStars = text.replace(/\*/g, '');
  return withoutStars
    .split('\n')
    .map((line) => line.replace(/^\s*(#{1,6}|[-•]+)\s+/, ''))
    .join('\n')
    .trim();
}

export async function askDeepseek(
  question: string,
  context?: string,
  locale: AppLocale = 'zh'
): Promise<string> {
  if (!API_KEY) {
    return sanitizeAnswer(buildFallback(question, context, locale));
  }

  const messages = [
    {
      role: 'system',
      content:
        '你是一名资深的肺结核及呼吸感染领域临床专家，同时熟悉影像学（胸片/CT）、实验室检查（IGRA/PPD/痰涂片/培养/分子检测）和随访流程。' +
        '请用正式、专业的语言回答用户问题，结构清晰，优先给出关键信息、鉴别要点、下一步检查或随访建议，并提醒必要的线下就医与感染防控。' +
        '不要使用特殊符号或列表编号符号（如 # * ·），直接用完整句子或简单分段表述。' +
        answerLanguagePrompt[locale] +
        '。',
    },
    {
      role: 'user',
      content: context ? `患者背景：${context}\n问题：${question}` : question,
    },
  ];

  try {
    const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    if (!resp.ok) {
      return sanitizeAnswer(fallbackServiceError[locale]);
    }

    const data = (await resp.json()) as DeepseekResp;
    const content = data.choices?.[0]?.message?.content?.trim();
    return sanitizeAnswer(content || buildFallback(question, context, locale));
  } catch {
    return sanitizeAnswer(fallbackServiceError[locale]);
  }
}

function buildFallback(question: string, context: string | undefined, locale: AppLocale) {
  if (locale === 'en') {
    const ctx = context ? `\nPatient context: ${context}` : '';
    return `Question received: ${question}${ctx}\nAdvice: complete symptoms, history and imaging, and seek in-person care when needed.`;
  }
  if (locale === 'th') {
    const ctx = context ? `\nข้อมูลผู้ป่วย: ${context}` : '';
    return `ได้รับคำถามของคุณแล้ว: ${question}${ctx}\nคำแนะนำ: กรุณาเสริมข้อมูลอาการ ประวัติ และภาพตรวจ และไปพบแพทย์เมื่อจำเป็น`;
  }
  if (locale === 'id') {
    const ctx = context ? `\nLatar pasien: ${context}` : '';
    return `Pertanyaan diterima: ${question}${ctx}\nSaran: lengkapi gejala, riwayat, dan data pencitraan, serta periksa langsung bila perlu.`;
  }
  if (locale === 'ms') {
    const ctx = context ? `\nLatar pesakit: ${context}` : '';
    return `Soalan diterima: ${question}${ctx}\nCadangan: lengkapkan gejala, sejarah dan data imej, serta dapatkan rawatan bersemuka jika perlu.`;
  }
  const ctx = context ? `\n患者背景：${context}` : '';
  return `收到你的问题：${question}${ctx}\n建议：请完善症状、既往史和影像资料，必要时前往线下门诊就诊。`;
}

interface ReportDraftInput {
  patientName: string;
  riskLevel: string;
  findings?: string | { location?: string; type?: string; size?: string | number }[];
  symptoms?: string[];
  history?: string[];
  tbProbability?: number;
}

export async function generateReportDraft(
  payload: ReportDraftInput,
  locale: AppLocale = 'zh'
): Promise<string> {
  const { patientName, riskLevel, tbProbability } = payload;
  const findingsText =
    Array.isArray(payload.findings)
      ? payload.findings
          .map((f) => {
            const loc = f.location ? `部位:${f.location}` : '';
            const t = f.type || '';
            const s = f.size ? `大小:${f.size}` : '';
            return [loc, t, s].filter(Boolean).join(' ');
          })
          .filter(Boolean)
          .join('；')
      : payload.findings || '未提供';

  const symptomsText = payload.symptoms?.join('，') || '未提供';
  const historyText = payload.history?.join('，') || '未提供';

  const q = `请生成肺结核筛查报告草稿（50-120字），包含：临床印象、影像要点、后续检查/随访建议、安全提示。语言简洁、面向医生。\n患者：${patientName}\n风险等级：${riskLevel}\nTB概率：${tbProbability ?? '未知'}\n影像要点：${findingsText}\n症状：${symptomsText}\n既往史：${historyText}`;
  return askDeepseek(q, undefined, locale);
}
