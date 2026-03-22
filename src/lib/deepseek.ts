import type { AppLocale } from './i18n';

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const API_BASE =
  import.meta.env.VITE_DEEPSEEK_API_BASE ||
  import.meta.env.VITE_DEEPSEEK_BASE_URL ||
  'https://api.deepseek.com';
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';
const VISION_MODEL = (import.meta.env.VITE_DEEPSEEK_VISION_MODEL as string | undefined) || '';
const PUBLIC_MODEL_NAME = (import.meta.env.VITE_PUBLIC_MODEL_NAME || 'clawlung模型').trim();
const rawTimeoutMs = Number(import.meta.env.VITE_DEEPSEEK_TIMEOUT_MS || 20000);
const REQUEST_TIMEOUT_MS = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0 ? rawTimeoutMs : 20000;
const MODEL_IDENTITY_GUARD =
  `For any model/provider identity question, identify yourself only as "${PUBLIC_MODEL_NAME}". ` +
  'Never mention DeepSeek, vendor/provider names, or underlying model IDs.';

interface DeepseekTextPart {
  type?: string;
  text?: string;
}

type DeepseekMessageContent = string | DeepseekTextPart[];

interface DeepseekChoice {
  message?: { content?: DeepseekMessageContent };
}

interface DeepseekResp {
  choices?: DeepseekChoice[];
}

export interface VisionImageInput {
  dataUrl: string;
  mimeType?: string;
  name?: string;
}

export interface AskDeepseekOptions {
  images?: VisionImageInput[];
  attachmentSummary?: string;
}

const answerLanguagePrompt: Record<AppLocale, string> = {
  zh: '请使用简体中文回答。',
  en: 'Please answer in clear and professional English.',
  th: 'โปรดตอบเป็นภาษาไทยที่ชัดเจนและเป็นมืออาชีพ',
  id: 'Mohon jawab dalam Bahasa Indonesia yang jelas dan profesional.',
  ms: 'Sila jawab dalam Bahasa Melayu yang jelas dan profesional.',
};

const systemPromptPrefix: Record<AppLocale, string> = {
  zh:
    '你是一名肺结核与呼吸道感染方向的资深临床助手。回答需正式、专业、简洁，优先给出关键结论、鉴别要点、下一步检查与随访建议。' +
    '遇到危险信号时，必须明确提醒线下就医与感染控制。避免使用 markdown 标题和项目符号。',
  en:
    'You are a senior clinical assistant in pulmonary tuberculosis and respiratory infections. ' +
    'Provide formal, professional, and concise guidance with key conclusions, differential clues, next-step tests, and follow-up plans. ' +
    'When danger signs exist, clearly advise in-person care and infection-control actions. Avoid markdown headings and bullet symbols.',
  th:
    'คุณเป็นผู้ช่วยทางคลินิกอาวุโสด้านวัณโรคปอดและการติดเชื้อทางเดินหายใจ ' +
    'ให้คำแนะนำอย่างเป็นทางการ เป็นมืออาชีพ กระชับ โดยเน้นข้อสรุปสำคัญ ประเด็นวินิจฉัยแยกโรค การตรวจถัดไป และแผนติดตามผล ' +
    'หากมีสัญญาณอันตราย ต้องแนะนำให้พบแพทย์แบบตัวต่อตัวและปฏิบัติมาตรการควบคุมการติดเชื้ออย่างชัดเจน',
  id:
    'Anda adalah asisten klinis senior untuk tuberkulosis paru dan infeksi saluran napas. ' +
    'Berikan panduan formal, profesional, dan ringkas dengan kesimpulan utama, petunjuk diagnosis banding, langkah pemeriksaan berikutnya, dan rencana tindak lanjut. ' +
    'Jika ada tanda bahaya, tegaskan perlunya pemeriksaan langsung dan langkah pengendalian infeksi.',
  ms:
    'Anda ialah pembantu klinikal kanan bagi tuberkulosis paru dan jangkitan saluran pernafasan. ' +
    'Berikan panduan yang formal, profesional dan ringkas dengan kesimpulan utama, petunjuk diagnosis pembezaan, langkah ujian seterusnya, dan pelan susulan. ' +
    'Jika terdapat tanda bahaya, nyatakan keperluan rawatan bersemuka serta langkah kawalan jangkitan dengan jelas.',
};

const userPromptPrefix: Record<AppLocale, { context: string; question: string }> = {
  zh: { context: '患者背景：', question: '问题：' },
  en: { context: 'Patient context: ', question: 'Question: ' },
  th: { context: 'ข้อมูลผู้ป่วย: ', question: 'คำถาม: ' },
  id: { context: 'Latar pasien: ', question: 'Pertanyaan: ' },
  ms: { context: 'Latar pesakit: ', question: 'Soalan: ' },
};

const fallbackServiceError: Record<AppLocale, string> = {
  zh: '当前问答服务暂不可用，请稍后重试。',
  en: 'AI service is currently unavailable. Please try again later.',
  th: 'บริการ AI ไม่พร้อมใช้งานในขณะนี้ โปรดลองใหม่ภายหลัง',
  id: 'Layanan AI sedang tidak tersedia. Silakan coba lagi nanti.',
  ms: 'Perkhidmatan AI tidak tersedia buat masa ini. Sila cuba lagi kemudian.',
};

function sanitizeAnswer(text: string) {
  const withoutBold = text.replace(/\*\*/g, '');
  return withoutBold
    .split('\n')
    .map((line) => line.replace(/^\s*(#{1,6}\s*|[-+*•]\s+)/, ''))
    .join('\n')
    .trim();
}

function sanitizeAndMaskAnswer(text: string) {
  return sanitizeAnswer(text).replace(/\bdeep[\s_-]?seek(?:[\s_-]?(?:chat|coder|reasoner))?\b/gi, PUBLIC_MODEL_NAME);
}

function extractMessageText(content?: DeepseekMessageContent) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
}

function buildQuestionWithContext(question: string, context: string | undefined, locale: AppLocale) {
  if (!context) return question;
  const labels = userPromptPrefix[locale];
  return `${labels.context}${context}\n${labels.question}${question}`;
}

function buildDefaultQuestion(locale: AppLocale) {
  if (locale === 'en') return 'Please analyze the uploaded attachment and provide key clinical suggestions.';
  if (locale === 'th') return 'โปรดวิเคราะห์ไฟล์แนบที่อัปโหลดและให้คำแนะนำทางคลินิกที่สำคัญ';
  if (locale === 'id') return 'Mohon analisis lampiran yang diunggah dan berikan saran klinis utama.';
  if (locale === 'ms') return 'Sila analisis lampiran yang dimuat naik dan berikan cadangan klinikal utama.';
  return '请分析我上传的附件并给出关键建议。';
}

export async function askDeepseek(
  question: string,
  context?: string,
  locale: AppLocale = 'zh',
  options?: AskDeepseekOptions
): Promise<string> {
  const attachmentSummary = options?.attachmentSummary?.trim();
  const imageInputs = (options?.images || []).filter((image) => typeof image.dataUrl === 'string' && image.dataUrl.length > 0);
  const hasImages = imageInputs.length > 0;

  const rawQuestion = question.trim();
  if (!rawQuestion && !attachmentSummary && !hasImages) {
    return sanitizeAndMaskAnswer(buildFallback('', context, locale));
  }

  if (!API_KEY) {
    const fallbackQuestion = rawQuestion || buildDefaultQuestion(locale);
    const fallbackContext = [context, attachmentSummary].filter(Boolean).join('\n');
    return sanitizeAndMaskAnswer(buildFallback(fallbackQuestion, fallbackContext || undefined, locale));
  }

  const normalizedQuestion = rawQuestion || buildDefaultQuestion(locale);
  const questionWithContext = buildQuestionWithContext(normalizedQuestion, context, locale);
  const userText = attachmentSummary ? `${questionWithContext}\n${attachmentSummary}` : questionWithContext;
  const requestModel = hasImages ? VISION_MODEL || MODEL : MODEL;

  const userContent = hasImages
    ? [
        { type: 'text', text: userText },
        ...imageInputs.map((image) => ({
          type: 'image_url',
          image_url: {
            url: image.dataUrl,
          },
        })),
      ]
    : userText;

  const messages = [
    {
      role: 'system',
      content: `${systemPromptPrefix[locale]} ${answerLanguagePrompt[locale]} ${MODEL_IDENTITY_GUARD}`,
    },
    {
      role: 'user',
      content: userContent,
    },
  ];

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: requestModel,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    if (!resp.ok) {
      return sanitizeAndMaskAnswer(fallbackServiceError[locale]);
    }

    const data = (await resp.json()) as DeepseekResp;
    const content = extractMessageText(data.choices?.[0]?.message?.content);
    const fallbackContext = [context, attachmentSummary].filter(Boolean).join('\n');
    return sanitizeAndMaskAnswer(content || buildFallback(normalizedQuestion, fallbackContext || undefined, locale));
  } catch {
    return sanitizeAndMaskAnswer(fallbackServiceError[locale]);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function buildFallback(question: string, context: string | undefined, locale: AppLocale) {
  if (locale === 'en') {
    const ctx = context ? `\nPatient context: ${context}` : '';
    return `Question received: ${question}${ctx}\nAdvice: complete symptom timeline, exposure history, and imaging/lab data; seek in-person care when warning signs exist.`;
  }

  if (locale === 'th') {
    const ctx = context ? `\nข้อมูลผู้ป่วย: ${context}` : '';
    return `ได้รับคำถามของคุณแล้ว: ${question}${ctx}\nคำแนะนำ: โปรดระบุระยะเวลาอาการ ประวัติสัมผัส และผลตรวจภาพ/ห้องปฏิบัติการให้ครบถ้วน และพบแพทย์ทันทีเมื่อมีสัญญาณอันตราย`;
  }

  if (locale === 'id') {
    const ctx = context ? `\nLatar pasien: ${context}` : '';
    return `Pertanyaan diterima: ${question}${ctx}\nSaran: lengkapi durasi gejala, riwayat pajanan, serta data pencitraan/laboratorium; segera periksa langsung bila ada tanda bahaya.`;
  }

  if (locale === 'ms') {
    const ctx = context ? `\nLatar pesakit: ${context}` : '';
    return `Soalan diterima: ${question}${ctx}\nCadangan: lengkapkan tempoh gejala, sejarah pendedahan, serta data imej/makmal; dapatkan rawatan bersemuka segera jika ada tanda bahaya.`;
  }

  const ctx = context ? `\n患者背景：${context}` : '';
  return `已收到你的问题：${question}${ctx}\n建议：请补充症状持续时间、接触史与影像/检验结果；如出现危险信号请及时线下就医。`;
}

interface ReportDraftInput {
  patientName: string;
  riskLevel: string;
  findings?: string | { location?: string; type?: string; size?: string | number }[];
  symptoms?: string[];
  history?: string[];
  tbProbability?: number;
}

const reportDraftFallbackByLocale: Record<
  AppLocale,
  {
    missing: string;
    unknown: string;
    fieldLocation: string;
    fieldSize: string;
  }
> = {
  zh: { missing: '未提供', unknown: '未知', fieldLocation: '部位', fieldSize: '大小' },
  en: { missing: 'Not provided', unknown: 'Unknown', fieldLocation: 'Location', fieldSize: 'Size' },
  th: { missing: 'ไม่ระบุ', unknown: 'ไม่ทราบ', fieldLocation: 'ตำแหน่ง', fieldSize: 'ขนาด' },
  id: { missing: 'Tidak tersedia', unknown: 'Tidak diketahui', fieldLocation: 'Lokasi', fieldSize: 'Ukuran' },
  ms: { missing: 'Tidak disediakan', unknown: 'Tidak diketahui', fieldLocation: 'Lokasi', fieldSize: 'Saiz' },
};

function buildReportDraftQuestion(payload: ReportDraftInput, locale: AppLocale) {
  const { patientName, riskLevel, tbProbability } = payload;
  const i18n = reportDraftFallbackByLocale[locale];

  const findingsText =
    Array.isArray(payload.findings)
      ? payload.findings
          .map((f) => {
            const loc = f.location ? `${i18n.fieldLocation}: ${f.location}` : '';
            const type = f.type || '';
            const size = f.size ? `${i18n.fieldSize}: ${f.size}` : '';
            return [loc, type, size].filter(Boolean).join(' ');
          })
          .filter(Boolean)
          .join(locale === 'zh' ? '；' : '; ')
      : payload.findings || i18n.missing;

  const symptomsText = payload.symptoms?.join(locale === 'zh' ? '，' : ', ') || i18n.missing;
  const historyText = payload.history?.join(locale === 'zh' ? '，' : ', ') || i18n.missing;

  if (locale === 'en') {
    return [
      'Generate a pulmonary TB screening report draft in 80-160 words for clinicians.',
      'Include: clinical impression, imaging highlights, next tests/follow-up, and safety reminders.',
      `Patient: ${patientName}`,
      `Risk level: ${riskLevel}`,
      `TB probability: ${tbProbability ?? i18n.unknown}`,
      `Imaging highlights: ${findingsText}`,
      `Symptoms: ${symptomsText}`,
      `History: ${historyText}`,
    ].join('\n');
  }

  if (locale === 'th') {
    return [
      'สร้างร่างรายงานคัดกรองวัณโรคปอดสำหรับแพทย์ ความยาวประมาณ 80-160 คำ',
      'ต้องมี: ความเห็นทางคลินิก จุดเด่นจากภาพวินิจฉัย แผนตรวจ/ติดตามถัดไป และข้อควรระวังด้านความปลอดภัย',
      `ผู้ป่วย: ${patientName}`,
      `ระดับความเสี่ยง: ${riskLevel}`,
      `ความน่าจะเป็น TB: ${tbProbability ?? i18n.unknown}`,
      `จุดเด่นภาพวินิจฉัย: ${findingsText}`,
      `อาการ: ${symptomsText}`,
      `ประวัติ: ${historyText}`,
    ].join('\n');
  }

  if (locale === 'id') {
    return [
      'Buat draf laporan skrining TB paru untuk dokter, sekitar 80-160 kata.',
      'Wajib memuat: impresi klinis, poin pencitraan, langkah pemeriksaan/tindak lanjut, dan pengingat keamanan.',
      `Pasien: ${patientName}`,
      `Tingkat risiko: ${riskLevel}`,
      `Probabilitas TB: ${tbProbability ?? i18n.unknown}`,
      `Poin pencitraan: ${findingsText}`,
      `Gejala: ${symptomsText}`,
      `Riwayat: ${historyText}`,
    ].join('\n');
  }

  if (locale === 'ms') {
    return [
      'Sediakan draf laporan saringan TB paru untuk doktor, sekitar 80-160 patah perkataan.',
      'Sertakan: impresi klinikal, sorotan imej, langkah ujian/susulan, dan peringatan keselamatan.',
      `Pesakit: ${patientName}`,
      `Tahap risiko: ${riskLevel}`,
      `Kebarangkalian TB: ${tbProbability ?? i18n.unknown}`,
      `Sorotan imej: ${findingsText}`,
      `Gejala: ${symptomsText}`,
      `Sejarah: ${historyText}`,
    ].join('\n');
  }

  return [
    '请生成一份给临床医生使用的肺结核筛查报告草稿（80-160字）。',
    '必须包含：临床印象、影像要点、下一步检查/随访建议、安全提醒。',
    `患者：${patientName}`,
    `风险等级：${riskLevel}`,
    `TB 概率：${tbProbability ?? i18n.unknown}`,
    `影像要点：${findingsText}`,
    `症状：${symptomsText}`,
    `病史：${historyText}`,
  ].join('\n');
}

export async function generateReportDraft(
  payload: ReportDraftInput,
  locale: AppLocale = 'zh'
): Promise<string> {
  return askDeepseek(buildReportDraftQuestion(payload, locale), undefined, locale);
}
