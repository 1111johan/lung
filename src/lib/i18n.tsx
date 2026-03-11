/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AppLocale = 'zh' | 'en' | 'th' | 'id' | 'ms';

const LOCALE_STORAGE_KEY = 'tb_agent_locale';

const localeLabelMap: Record<AppLocale, string> = {
  zh: '中文',
  en: 'English',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
};

const speechLangMap: Record<AppLocale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  th: 'th-TH',
  id: 'id-ID',
  ms: 'ms-MY',
};

const en: Record<string, string> = {
  '广西医科大学': 'Guangxi Medical University',
  '当前连接：': 'Connected: ',
  'Agent 在线': 'Agent Online',
  '切换主题（系统/浅色/深色）': 'Switch theme (system/light/dark)',
  '深色': 'Dark',
  '浅色': 'Light',
  '跟随系统': 'System',

  '个人健康档案': 'Health Profile',
  '智能问答': 'AI Q&A',
  '结核病风险自测': 'TB Risk Check',
  '筛查工作台': 'Screening Workstation',
  '报告中心': 'Report Center',
  '转诊与上报': 'Referral & Reporting',
  '随访管理': 'Follow-up Management',
  '科研与教学': 'Research & Teaching',
  '系统与审计': 'System & Audit',

  '待筛查': 'Pending Screening',
  '高危病例': 'High-Risk Cases',
  '逾期随访': 'Overdue Follow-ups',
  '阳性确认/签署': 'Positive Confirmed/Signed',
  '点击查看': 'View',
  '更新于': 'Updated at',
  '高危患者': 'High-Risk Patients',
  '暂无高危患者': 'No high-risk patients',
  '随访提醒': 'Follow-up Alerts',
  '处理': 'Handle',
  '逾期': 'Overdue',
  '待随访': 'Pending',
  '已完成': 'Done',
  '今日到期': 'Due today',
  '剩余': 'Remaining',
  '天': 'days',
  '最新报告': 'Latest reports',
  '已定稿': 'Finalized',
  '已上报': 'Reported',
  '草稿': 'Draft',
  '暂无报告': 'No reports',
  '今日待办': 'Today tasks',
  '风险分层分布': 'Risk distribution',
  '高危': 'High',
  '中危': 'Medium',
  '低危': 'Low',
  '人': 'people',
  '本周': 'This week',
  '待审核影像': 'Images pending review',
  '转到阅片': 'Go to image review',
  '待补全信息': 'Info pending completion',
  '完善建档': 'Complete profile',
  '安排回访': 'Schedule callback',
  '待上报/签署': 'Pending report/sign',
  '前往报告': 'Go to reports',
  '+8% 较上周': '+8% vs last week',
  '+2 较昨日': '+2 vs yesterday',
  '-1 较昨日': '-1 vs yesterday',
  '+1 今日新增': '+1 today',
  '待筛查=已登记但未完成影像/报告': 'Pending = registered but imaging/report not completed',
  '高危=AI 风险≥0.7 或医生标记': 'High risk = AI risk ≥ 0.7 or doctor marked',
  '逾期=随访 dueAt < 今天且未完成': 'Overdue = dueAt < today and unfinished',
  '含已定稿与已上报报告数量': 'Includes finalized and reported report count',
  '既往结核': 'Prior TB',
  'AI高概率': 'High AI probability',
  '影像未上传': 'Imaging not uploaded',
  '影像已审核': 'Imaging reviewed',
  '影像待审核': 'Imaging pending review',
  '影像已上传': 'Imaging uploaded',
  '暂无症状/风险标签': 'No symptom/risk tags',
  '复核影像': 'Review imaging',
  '暂无待随访任务': 'No pending follow-up tasks',
  '最近操作': 'latest action',
  '近 8 周趋势（疑似 / 阳性 / 排除）': '8-week trend (suspected / positive / ruled out)',
  '可替换为 7/30/90 天': 'Switchable to 7/30/90 days',
  '疑似': 'Suspected',
  '排除/复查': 'Ruled out / review',

  'QA：必填校验 / 所见-印象一致性提示': 'QA: required checks / findings-impression consistency',
  '筛查': 'Screening',
  '转诊': 'Referral',
  '—': '—',
  '缺失': 'Missing',
  '必填字段校验，生成通知书/转诊单': 'Validate required fields and generate notice/referral form',
  '生成通知书': 'Generate notice',
  '提交上报': 'Submit',
  '节点：2周 / 1月 / 3月；逾期自动提醒': 'Milestones: 2w / 1m / 3m, auto overdue alerts',
  '完成': 'Complete',
  '标记逾期': 'Mark overdue',

  '科研与教学（脱敏导出/病例库）': 'Research & Teaching (De-identified Export/Case Library)',
  '队列构建：地区 / 征象 / 检验 / 随访齐全': 'Cohort build: region/signs/tests/follow-up completeness',
  '示例：百色 + 高危 + 结节': 'Example: Baise + high risk + nodule',
  '生成队列': 'Create Cohort',
  '导出脱敏 JSON': 'Export De-identified JSON',
  '导出 ROI/Mask': 'Export ROI/Mask',
  '典型病例库（示例）': 'Typical Case Library (Sample)',
  '结节': 'Nodule',
  '树芽征': 'Tree-in-bud',
  '钙化': 'Calcification',
  '3 例占位': '3 sample cases',

  '当前模型：GX-TB-v4.2 • 阈值 0.75 • 角色：影像科/呼吸感染科/公卫护士（MVP）':
    'Model: GX-TB-v4.2 • Threshold 0.75 • Roles: Radiology/Respiratory Infection/Public Health Nurse (MVP)',

  '数字人问答': 'Digital Human Q&A',
  '（模型无嘴部控制器，使用点头/呼吸表示说话）': '(No lip controller; speaking shown by nodding/breathing)',
  '请描述你的问题或症状...': 'Please describe your question or symptoms...',
  '提问并朗读': 'Ask and read',
  '停止语音': 'Stop voice',
  '回答': 'Answer',
  '正在生成...': 'Generating...',
  '暂无回答': 'No answer yet',
  '状态：': 'Status: ',
  '正在朗读': 'Reading',
  '待机': 'Idle',
  '提示：本模型无口型控制，已用点头 + 呼吸模拟“说话”。':
    'Tip: no lip sync; speaking is simulated by nodding + breathing.',
  '模型加载中...': 'Loading model...',
  '你好，我是数字人迎宾医生，准备为你解答。':
    'Hello, I am the digital receptionist doctor, ready to answer your questions.',
  '当前问答服务暂不可用，请稍后重试。': 'Q&A service is unavailable. Please try again later.',

  '文档': 'Document',
  '图片': 'Image',
  '语音': 'Audio',
  '视频': 'Video',
  '你好，这里是广西医科大学 TB 科智能助手，提供科普与流程建议，不替代线下诊断。':
    'Hello, this is the GXMU TB assistant. It provides educational and workflow guidance and does not replace in-person diagnosis.',
  '已上传附件': 'Attachment uploaded',
  '仅供科普与流程建议，不替代医生诊断': 'For education/workflow guidance only, not a diagnosis.',
  '生成回答中...': 'Generating response...',
  '移除': 'Remove',
  '上传文档': 'Upload document',
  '上传图片': 'Upload image',
  '上传语音': 'Upload audio',
  '上传视频': 'Upload video',
  '输入问题，支持多种附件': 'Enter question, supports multiple attachments',
  '发送': 'Send',
  '停止朗读': 'Stop reading',
  '数字人正在朗读': 'Digital human is reading',
  '快速提问': 'Quick questions',
  '追问建议': 'Follow-up suggestions',
  '提示：若出现高热、咳血、呼吸困难等急症，请立即线下就医':
    'Tip: if high fever, hemoptysis, or dyspnea occurs, seek in-person care immediately.',

  '咳嗽≥2周、夜间盗汗、体重下降是结核的典型组合吗？':
    'Are cough ≥2 weeks, night sweats, and weight loss typical TB signs?',
  'IGRA/PPD 阳性但胸片正常，需要做什么复查？':
    'IGRA/PPD positive but chest X-ray normal: what follow-up is needed?',
  '痰涂片阴性还能是肺结核吗，下一步怎么查？':
    'Can sputum smear-negative still be pulmonary TB, and what next?',
  '家庭成员确诊肺结核后，密接者要做哪些筛查？':
    'After family TB diagnosis, what should close contacts be screened for?',
  '孕妇或哺乳期疑似结核，影像和用药注意什么？':
    'For suspected TB in pregnancy/lactation, what imaging and medication cautions apply?',
  '耐药结核（MDR/XDR）与普通结核有什么区别？':
    'What is the difference between MDR/XDR TB and regular TB?',
  '长期低热+盗汗但咳嗽不明显，可能是结核吗？':
    'Long low fever + night sweats with mild cough: could this be TB?',
  '结核治疗需要服药多久，停药或漏服有什么风险？':
    'How long does TB treatment last, and what are risks of stopping/missing doses?',
  '什么时候可以解除隔离，复查标准是什么？': 'When can isolation end, and what are recheck criteria?',
  '合并糖尿病或 HIV 时，结核管理有哪些特别注意？':
    'With diabetes or HIV, what special TB management cautions are needed?',

  '请从左侧队列选择患者': 'Please select a patient from the left queue',
  'DICOM 影像查看器已就绪': 'DICOM viewer ready',
  '窗宽窗位': 'Window/Level',
  '测量工具': 'Measure',
  '放大': 'Zoom in',
  '缩小': 'Zoom out',
  'AI标注已开启': 'AI overlay enabled',
  'AI标注已关闭': 'AI overlay disabled',
  'AI 标注': 'AI overlay',
  '[ DICOM 影像渲染区域 ]': '[ DICOM render area ]',
  '病灶': 'Lesion',
  '序列': 'Series',
  '状态': 'Status',
  '高危优先': 'High-risk first',
  '男': 'Male',
  '女': 'Female',
  '岁': 'years',
  '确认删除该待筛查患者？': 'Confirm deleting this pending patient?',
  '删除待筛查患者': 'Delete pending patient',
  '删除': 'Delete',
  '主诉': 'Chief complaint',
  '既往TB史': 'TB history',

  '必填信息 + AI 智能匹配': 'Required fields + AI smart matching',
  '基础信息': 'Basic information',
  '姓名（可脱敏）': 'Name (masking supported)',
  '年龄': 'Age',
  '联系方式（选填）': 'Contact (optional)',
  '地区（市/县/乡镇）': 'Region (city/county/town)',
  '无': 'None',
  '有': 'Yes',
  '不详': 'Unknown',
  '常见症状（多选）': 'Common symptoms (multi-select)',
  '流行病学 / 高危因素（多选）': 'Epidemiology / risk factors (multi-select)',
  '检查指标': 'Test indicators',
  'AI 辅助填写（TB 智能匹配）': 'AI-assisted form filling (TB smart match)',
  '已匹配结果': 'Matched',
  '输入主诉自动匹配症状/风险': 'Input chief complaint to auto-match symptoms/risks',
  '一键 AI 匹配': 'One-click AI match',
  '风险提示卡': 'Risk card',
  '风险分：': 'Risk score: ',
  '触发原因：': 'Triggers: ',
  '暂未识别': 'Not identified yet',
  '建议': 'Recommendation',
  '重置': 'Reset',
  '创建档案': 'Create profile',
  '个人档案预览': 'Profile preview',
  '数据库入库展示': 'Database insert status',
  '已写入数据库': 'Saved to database',
  '当前未写入 Supabase（本地草稿）': 'Not saved to Supabase (local draft)',
  '表名：patients': 'Table: patients',
  '主键：': 'Primary key: ',
  '时间：': 'Time: ',
  '字段摘要：': 'Summary: ',
  '待创建档案后展示写入信息': 'Create profile to show write details',
  '数字人预览': 'Digital human preview',
  '让数字人播报问候': 'Let digital human play greeting',
  '您好，我是肺结核筛查数字助手，已为您记录档案信息，请继续完善检查与随访计划。':
    'Hello, I am your TB screening assistant. Your profile is recorded. Please continue tests and follow-up planning.',

  '咳嗽≥2周': 'Cough ≥2 weeks',
  '咳痰': 'Productive cough',
  '痰中带血/咳血': 'Blood in sputum / hemoptysis',
  '午后低热': 'Low fever in afternoon',
  '盗汗': 'Night sweats',
  '体重下降/消瘦': 'Weight loss / emaciation',
  '乏力': 'Fatigue',
  '胸痛/气促': 'Chest pain / dyspnea',
  '结核密接史': 'Close-contact TB exposure',
  '既往结核/复发风险': 'Prior TB / relapse risk',
  '糖尿病': 'Diabetes',
  '免疫抑制': 'Immunosuppression',
  'HIV（如已知）': 'HIV (if known)',
  '吸烟史': 'Smoking history',
  '老年≥65': 'Age ≥65',
  '未做': 'Not done',
  '阴性': 'Negative',
  '阳性': 'Positive',
  '待出': 'Pending',
  '未采': 'Not collected',
  '已做（录入日期）': 'Done (date entered)',
  '盗汗/午后低热': 'Night sweats / low afternoon fever',
  '有密接史': 'Close-contact history',
  '既往结核史': 'History of TB',
  '免疫学阳性': 'Immunology positive',
  '痰检阳性': 'Sputum positive',
  '咳嗽三周，夜间盗汗，午后低热，家属最近确诊结核':
    'Cough for 3 weeks, night sweats, low afternoon fever, family member recently diagnosed with TB',
  '广西': 'Guangxi',
  '未填写姓名': 'Name not provided',
  '检查：': 'Tests: ',
  '痰检': 'Sputum test',
  'AI 建议': 'AI recommendation',
  '风险': 'Risk',
  '建议：完善 IGRA/痰检；如咳血/高热请及时就医':
    'Recommendation: complete IGRA/sputum tests; if hemoptysis/high fever occurs, seek care promptly',
  '填写信息并点击“创建档案”后展示': 'Fill information and click "Create profile" to display',
  '写库失败：': 'Write failure: ',
  '未知原因': 'Unknown reason',
  '请检查 Supabase URL、Anon Key 和 RLS 权限后重试。':
    'Please check Supabase URL, Anon Key, and RLS permissions, then retry.',

  '选择患者后激活 AI 分析': 'Select a patient to activate AI analysis',
  '结核可能性': 'TB possibility',
  '非典型感染': 'Atypical infection',
  '肿瘤/占位': 'Tumor/occupying lesion',
  '肿瘤标志物': 'Tumor markers',
  '当前智慧生成功能不可用，请稍后重试。': 'Smart generation is unavailable. Please try again later.',
  '肺野': 'Lung field',
  '可见': 'shows',
  '异常': 'abnormality',
  '影像': 'imaging',
  '影像表现': 'Imaging findings',
  '未见明确异常，右上肺可疑病灶待排。': 'No clear abnormality; right upper lung suspicious lesion pending exclusion.',
  '下一步检查': 'Next tests',
  '结核活动性评估': 'TB activity assessment',
  '待进一步评估': 'Further evaluation needed',
  '痰检/培养与IGRA/PPD': 'Sputum/culture and IGRA/PPD',
  '必要时补充增强CT或随访复查': 'Add contrast CT or follow-up review if needed',
  '若临床症状明显，请尽快线下就诊': 'If symptoms are significant, seek in-person care promptly',
  '活动性判断': 'Activity judgment',
  '风险等级': 'Risk level',
  'AI 影像要点（位置/类型）': 'AI imaging highlights (location/type)',
  '范围': 'Range',
  '切片': 'Slice',
  '暂无 AI 影像要点，请人工复核。': 'No AI imaging highlights yet, please review manually.',
  '鉴别 & 下一步': 'Differential & next steps',
  '下一步': 'Next',
  '高危病例需医生确认，提交后自动生成转诊/随访。':
    'High-risk cases require physician confirmation; submission auto-generates referral/follow-up.',
  '推理链（可追溯）': 'Reasoning chain (traceable)',
  '既往结核提示': 'Prior TB alert',
  '患者有既往结核史，请注意复发及药物安全。':
    'Patient has prior TB; pay attention to relapse and medication safety.',
  '结构化报告草稿': 'Structured report draft',
  '生成默认草稿': 'Generate default draft',
  '生成中...': 'Generating...',
  '智慧生成': 'Smart generate',
  '影像表现、鉴别、建议...': 'Imaging findings, differential, recommendations...',
  '保存草稿': 'Save draft',
  '退回重拍': 'Return for retake',
  '确认阳性并转诊/随访': 'Confirm positive and refer/follow-up',
  '提交后将自动生成转诊单/通知，并创建随访节点（2周、1月）。':
    'After submission, referral notice and follow-up nodes (2w, 1m) are created automatically.',
  '结核概率': 'TB probability',
  '暂未发现明显异常。': 'No obvious abnormality found yet',
};

const th: Record<string, string> = {
  '个人健康档案': 'แฟ้มสุขภาพส่วนบุคคล',
  '智能问答': 'ถาม-ตอบอัจฉริยะ',
  '结核病风险自测': 'ประเมินความเสี่ยงวัณโรค',
  '筛查工作台': 'ศูนย์งานคัดกรอง',
  '报告中心': 'ศูนย์รายงาน',
  '转诊与上报': 'ส่งต่อและรายงาน',
  '随访管理': 'จัดการติดตามผล',
  '科研与教学': 'วิจัยและการสอน',
  '系统与审计': 'ระบบและการตรวจสอบ',
  '当前连接：': 'เชื่อมต่อ: ',
  'Agent 在线': 'เอเจนต์ออนไลน์',
  '深色': 'โหมดมืด',
  '浅色': 'โหมดสว่าง',
  '跟随系统': 'ตามระบบ',
  '待筛查': 'รอคัดกรอง',
  '高危': 'ความเสี่ยงสูง',
  '中危': 'ความเสี่ยงปานกลาง',
  '低危': 'ความเสี่ยงต่ำ',
  '草稿': 'ฉบับร่าง',
  '已定稿': 'สรุปแล้ว',
  '已上报': 'รายงานแล้ว',
  '状态：': 'สถานะ: ',
  '正在朗读': 'กำลังอ่าน',
  '待机': 'พร้อมใช้งาน',
  '发送': 'ส่ง',
  '停止朗读': 'หยุดอ่าน',
  '重置': 'รีเซ็ต',
  '创建档案': 'สร้างแฟ้ม',
  '数字人问答': 'ถาม-ตอบดิจิทัลฮิวแมน',
  '数字人预览': 'พรีวิวดิจิทัลฮิวแมน',
  '模型加载中...': 'กำลังโหลดโมเดล...',
  '当前问答服务暂不可用，请稍后重试。': 'บริการถาม-ตอบไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง',
  '文档': 'เอกสาร',
  '图片': 'รูปภาพ',
  '语音': 'เสียง',
  '视频': 'วิดีโอ',
};

const id: Record<string, string> = {
  '个人健康档案': 'Profil Kesehatan Pribadi',
  '智能问答': 'Tanya Jawab Cerdas',
  '结核病风险自测': 'Pemeriksaan Risiko TB',
  '筛查工作台': 'Meja Kerja Skrining',
  '报告中心': 'Pusat Laporan',
  '转诊与上报': 'Rujukan & Pelaporan',
  '随访管理': 'Manajemen Tindak Lanjut',
  '科研与教学': 'Riset & Pengajaran',
  '系统与审计': 'Sistem & Audit',
  '当前连接：': 'Terhubung: ',
  'Agent 在线': 'Agen Online',
  '深色': 'Gelap',
  '浅色': 'Terang',
  '跟随系统': 'Ikuti Sistem',
  '待筛查': 'Menunggu Skrining',
  '高危': 'Risiko Tinggi',
  '中危': 'Risiko Sedang',
  '低危': 'Risiko Rendah',
  '草稿': 'Draf',
  '已定稿': 'Final',
  '已上报': 'Dilaporkan',
  '状态：': 'Status: ',
  '正在朗读': 'Sedang membacakan',
  '待机': 'Siaga',
  '发送': 'Kirim',
  '停止朗读': 'Hentikan baca',
  '重置': 'Reset',
  '创建档案': 'Buat Profil',
  '数字人问答': 'Tanya Jawab Digital Human',
  '数字人预览': 'Pratinjau Digital Human',
  '模型加载中...': 'Memuat model...',
  '当前问答服务暂不可用，请稍后重试。': 'Layanan tanya jawab tidak tersedia, coba lagi nanti.',
  '文档': 'Dokumen',
  '图片': 'Gambar',
  '语音': 'Audio',
  '视频': 'Video',
};

const ms: Record<string, string> = {
  '个人健康档案': 'Profil Kesihatan Peribadi',
  '智能问答': 'Soal Jawab Pintar',
  '结核病风险自测': 'Saringan Risiko TB',
  '筛查工作台': 'Meja Kerja Saringan',
  '报告中心': 'Pusat Laporan',
  '转诊与上报': 'Rujukan & Pelaporan',
  '随访管理': 'Pengurusan Susulan',
  '科研与教学': 'Penyelidikan & Pengajaran',
  '系统与审计': 'Sistem & Audit',
  '当前连接：': 'Sambungan: ',
  'Agent 在线': 'Ejen Dalam Talian',
  '深色': 'Gelap',
  '浅色': 'Cerah',
  '跟随系统': 'Ikut Sistem',
  '待筛查': 'Menunggu Saringan',
  '高危': 'Risiko Tinggi',
  '中危': 'Risiko Sederhana',
  '低危': 'Risiko Rendah',
  '草稿': 'Draf',
  '已定稿': 'Dimuktamadkan',
  '已上报': 'Dilaporkan',
  '状态：': 'Status: ',
  '正在朗读': 'Sedang membaca',
  '待机': 'Sedia',
  '发送': 'Hantar',
  '停止朗读': 'Henti baca',
  '重置': 'Set semula',
  '创建档案': 'Cipta Profil',
  '数字人问答': 'Soal Jawab Digital Human',
  '数字人预览': 'Pratonton Digital Human',
  '模型加载中...': 'Memuat model...',
  '当前问答服务暂不可用，请稍后重试。': 'Perkhidmatan soal jawab tidak tersedia, sila cuba lagi nanti.',
  '文档': 'Dokumen',
  '图片': 'Imej',
  '语音': 'Audio',
  '视频': 'Video',
};

const translations: Record<Exclude<AppLocale, 'zh'>, Record<string, string>> = {
  en,
  th,
  id,
  ms,
};

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  tr: (text: string) => string;
  speechLang: string;
  localeLabels: Record<AppLocale, string>;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function normalizeLocale(input: string | null | undefined): AppLocale {
  if (input === 'en' || input === 'th' || input === 'id' || input === 'ms' || input === 'zh') return input;
  return 'zh';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === 'undefined') return 'zh';
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeLocale(saved);
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      document.documentElement.lang = speechLangMap[locale];
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(next),
      tr: (text: string) => {
        if (locale === 'zh') return text;
        return translations[locale]?.[text] || en[text] || text;
      },
      speechLang: speechLangMap[locale],
      localeLabels: localeLabelMap,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}



