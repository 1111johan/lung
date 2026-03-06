import { useMemo, useState } from 'react';
import { ClipboardCheck, Sparkles, Shield, Database, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { uiStyles } from '../lib/theme';
import { DigitalHumanAvatar } from './DigitalHuman';
import { speakText } from '../lib/voice';
import { createPatientProfile } from '../lib/supabaseService';
import { useDataContext } from '../lib/dataContext';
import { useI18n, type AppLocale } from '../lib/i18n';

type SymptomKey =
  | 'cough_2w'
  | 'phlegm'
  | 'hemoptysis'
  | 'fever'
  | 'night_sweat'
  | 'weight_loss'
  | 'fatigue'
  | 'chest_pain';

type RiskKey =
  | 'contact'
  | 'tb_history'
  | 'dm'
  | 'immune'
  | 'hiv'
  | 'smoking'
  | 'elderly';

type GenderCode = 'male' | 'female';
type TbHistoryCode = 'none' | 'yes' | 'unknown';
type RiskLevelCode = 'high' | 'suspected' | 'low';

type PpdValue = 'not_done' | 'negative' | 'positive';
type IgraValue = 'not_done' | 'negative' | 'positive' | 'pending';
type SputumValue = 'not_collected' | 'negative' | 'positive' | 'pending';
type ImagingValue = 'not_done' | 'done_with_date';

type LabValue = PpdValue | IgraValue | SputumValue | ImagingValue;

interface BasicForm {
  name: string;
  gender: GenderCode;
  age: number;
  phone: string;
  region: string;
  tbHistory: TbHistoryCode;
}

interface LabForm {
  ppd: PpdValue;
  igra: IgraValue;
  sputum: SputumValue;
  imaging: ImagingValue;
}

interface Profile {
  patientId: string;
  createdAt: string;
  riskLevel: RiskLevelCode;
  symptomCount: number;
  labStatus: string;
  persisted: boolean;
  persistError?: string;
}

const localeToDate: Record<AppLocale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  th: 'th-TH',
  id: 'id-ID',
  ms: 'ms-MY',
};

const symptomOptions: { key: SymptomKey; label: string }[] = [
  { key: 'cough_2w', label: '咳嗽≥2周' },
  { key: 'phlegm', label: '咳痰' },
  { key: 'hemoptysis', label: '痰中带血/咳血' },
  { key: 'fever', label: '午后低热' },
  { key: 'night_sweat', label: '盗汗' },
  { key: 'weight_loss', label: '体重下降/消瘦' },
  { key: 'fatigue', label: '乏力' },
  { key: 'chest_pain', label: '胸痛/气促' },
];

const riskOptions: { key: RiskKey; label: string }[] = [
  { key: 'contact', label: '结核密接史' },
  { key: 'tb_history', label: '既往结核/复发风险' },
  { key: 'dm', label: '糖尿病' },
  { key: 'immune', label: '免疫抑制' },
  { key: 'hiv', label: 'HIV（如已知）' },
  { key: 'smoking', label: '吸烟史' },
  { key: 'elderly', label: '老年≥65' },
];

const labOptions: {
  ppd: PpdValue[];
  igra: IgraValue[];
  sputum: SputumValue[];
  imaging: ImagingValue[];
} = {
  ppd: ['not_done', 'negative', 'positive'],
  igra: ['not_done', 'negative', 'positive', 'pending'],
  sputum: ['not_collected', 'negative', 'positive', 'pending'],
  imaging: ['not_done', 'done_with_date'],
};

const labValueLabelMap: Record<LabValue, string> = {
  not_done: '未做',
  not_collected: '未采',
  negative: '阴性',
  positive: '阳性',
  pending: '待出',
  done_with_date: '已做（录入日期）',
};

const symptomKeywords: Record<SymptomKey, string[]> = {
  cough_2w: ['咳嗽', '咳', 'cough', 'batuk', 'ไอ'],
  phlegm: ['咳痰', 'phlegm', 'sputum', 'dahak', 'เสมหะ'],
  hemoptysis: ['咳血', '痰血', 'hemoptysis', 'blood in sputum', 'batuk darah', 'ไอเป็นเลือด'],
  fever: ['低热', '发热', '午后', 'fever', 'demam', 'ไข้'],
  night_sweat: ['盗汗', 'night sweat', 'keringat malam', 'peluh malam', 'เหงื่อออกตอนกลางคืน'],
  weight_loss: ['消瘦', '体重', '瘦', 'weight loss', 'penurunan berat badan', 'berat badan turun', 'น้ำหนักลด'],
  fatigue: ['乏力', 'fatigue', 'letih', 'kelelahan', 'เหนื่อยง่าย'],
  chest_pain: ['胸痛', '气促', 'chest pain', 'shortness of breath', 'sesak', 'sakit dada', 'เจ็บหน้าอก', 'หายใจลำบาก'],
};

const riskKeywords: Record<RiskKey, string[]> = {
  contact: ['密接', '同住', '家属', 'close contact', 'kontak erat', 'สัมผัสใกล้ชิด'],
  tb_history: ['既往', '复发', 'riwayat tb', 'riwayat tibi', 'sejarah tb', 'เคยเป็นวัณโรค'],
  dm: ['糖尿病', 'diabetes', 'kencing manis', 'เบาหวาน'],
  immune: ['激素', '免疫抑制', 'immunosuppress', 'imunitas rendah', 'ภูมิคุ้มกันต่ำ'],
  hiv: ['hiv'],
  smoking: ['吸烟', 'merokok', 'rokok', 'สูบบุหรี่'],
  elderly: ['老人', '老年', 'elderly', 'lansia', 'warga emas', 'สูงอายุ'],
};

const initialBasic: BasicForm = {
  name: '张*三',
  gender: 'male',
  age: 35,
  phone: '',
  region: '广西·南宁',
  tbHistory: 'none',
};

const initialLabs: LabForm = {
  ppd: 'not_done',
  igra: 'not_done',
  sputum: 'not_collected',
  imaging: 'not_done',
};

const hasAnyKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

const riskLevelLabel = (value: RiskLevelCode, tr: (text: string) => string) => {
  if (value === 'high') return tr('高危');
  if (value === 'suspected') return tr('疑似');
  return tr('低危');
};

const genderLabel = (value: GenderCode, tr: (text: string) => string) => (value === 'female' ? tr('女') : tr('男'));

export function PatientOnboarding() {
  const { locale, tr } = useI18n();
  const [basic, setBasic] = useState<BasicForm>(initialBasic);
  const [symptoms, setSymptoms] = useState<SymptomKey[]>([]);
  const [risks, setRisks] = useState<RiskKey[]>([]);
  const [labs, setLabs] = useState<LabForm>(initialLabs);
  const [aiInput, setAiInput] = useState('咳嗽三周，夜间盗汗，午后低热，家属最近确诊结核');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matched, setMatched] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const riskScore = useMemo(() => {
    let score = 0;
    score += symptoms.length * 0.12;
    score += risks.length * 0.1;
    if (labs.igra === 'positive' || labs.ppd === 'positive') score += 0.25;
    if (labs.sputum === 'positive') score += 0.3;
    return Math.min(score, 1);
  }, [symptoms, risks, labs]);

  const riskLevel: RiskLevelCode = riskScore >= 0.7 ? 'high' : riskScore >= 0.4 ? 'suspected' : 'low';

  const reasons = useMemo(() => {
    const list: string[] = [];
    if (symptoms.includes('cough_2w')) list.push(tr('咳嗽≥2周'));
    if (symptoms.includes('night_sweat') || symptoms.includes('fever')) list.push(tr('盗汗/午后低热'));
    if (risks.includes('contact')) list.push(tr('有密接史'));
    if (risks.includes('tb_history')) list.push(tr('既往结核史'));
    if (labs.igra === 'positive' || labs.ppd === 'positive') list.push(tr('免疫学阳性'));
    if (labs.sputum === 'positive') list.push(tr('痰检阳性'));
    return list.slice(0, 3);
  }, [symptoms, risks, labs, tr]);

  const toggleSymptom = (key: SymptomKey) => {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const toggleRisk = (key: RiskKey) => {
    setRisks((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const handleAIMatch = () => {
    const text = aiInput.toLowerCase();
    const matchedSymptoms: SymptomKey[] = [];
    const matchedRisks: RiskKey[] = [];

    (Object.entries(symptomKeywords) as [SymptomKey, string[]][]).forEach(([key, keywords]) => {
      if (hasAnyKeyword(text, keywords)) matchedSymptoms.push(key);
    });

    (Object.entries(riskKeywords) as [RiskKey, string[]][]).forEach(([key, keywords]) => {
      if (hasAnyKeyword(text, keywords)) matchedRisks.push(key);
    });

    setSymptoms((prev) => Array.from(new Set([...prev, ...matchedSymptoms])));
    setRisks((prev) => Array.from(new Set([...prev, ...matchedRisks])));
    setMatched(true);
  };

  const { addPatientFromSupabase } = useDataContext();

  const handleCreateProfile = async () => {
    const pid = `GX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const hasHistory = basic.tbHistory === 'yes';
    const localeDate = localeToDate[locale];

    try {
      const saved = await createPatientProfile({
        patient_code: pid,
        name: basic.name || tr('未填写姓名'),
        gender: basic.gender,
        age: Number(basic.age) || 0,
        region: basic.region || tr('广西'),
        contact_phone: basic.phone || null,
        tb_history: hasHistory,
        ppd_test_result: labValueLabelMap[labs.ppd] || null,
        sputum_test_result: labValueLabelMap[labs.sputum] || null,
        chief_complaint: aiInput || null,
      });

      addPatientFromSupabase(saved);

      setProfile({
        patientId: saved.patient_code,
        createdAt: new Date(saved.created_at).toLocaleString(localeDate),
        riskLevel,
        symptomCount: symptoms.length,
        labStatus: `${tr(labValueLabelMap[labs.ppd])}/${tr(labValueLabelMap[labs.igra])}/${tr(labValueLabelMap[labs.sputum])}`,
        persisted: true,
      });
    } catch (error) {
      console.error('create patient failed, keeping local profile', error);
      const persistError = error instanceof Error ? error.message : 'unknown error';
      setProfile({
        patientId: pid,
        createdAt: new Date().toLocaleString(localeDate),
        riskLevel,
        symptomCount: symptoms.length,
        labStatus: `${tr(labValueLabelMap[labs.ppd])}/${tr(labValueLabelMap[labs.igra])}/${tr(labValueLabelMap[labs.sputum])}`,
        persisted: false,
        persistError,
      });
    }
  };

  const resetAll = () => {
    setBasic(initialBasic);
    setSymptoms([]);
    setRisks([]);
    setLabs(initialLabs);
    setAiInput(tr('咳嗽三周，夜间盗汗，午后低热，家属最近确诊结核'));
    setProfile(null);
    setMatched(false);
  };

  return (
    <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-y-auto bg-gray-900 fade-in">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <ClipboardCheck className="h-4 w-4 text-teal-400" />
            {tr('个人健康档案')}
          </div>
          <span className="text-[11px] text-gray-500">{tr('必填信息 + AI 智能匹配')}</span>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-xs text-gray-400 mb-1">{tr('基础信息')}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input className={uiStyles.input.default} value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} placeholder={tr('姓名（可脱敏）')} />
            <input className={uiStyles.input.default} value={basic.age} onChange={(e) => setBasic({ ...basic, age: Number(e.target.value) || 0 })} placeholder={tr('年龄')} />
            <select className={uiStyles.input.default} value={basic.gender} onChange={(e) => setBasic({ ...basic, gender: e.target.value as GenderCode })}>
              <option value="male">{tr('男')}</option>
              <option value="female">{tr('女')}</option>
            </select>
            <input className={uiStyles.input.default} value={basic.phone} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} placeholder={tr('联系方式（选填）')} />
            <input className={uiStyles.input.default + ' col-span-2'} value={basic.region} onChange={(e) => setBasic({ ...basic, region: e.target.value })} placeholder={tr('地区（市/县/乡镇）')} />
            <select className={uiStyles.input.default + ' col-span-2'} value={basic.tbHistory} onChange={(e) => setBasic({ ...basic, tbHistory: e.target.value as TbHistoryCode })}>
              <option value="none">{tr('无')}</option>
              <option value="yes">{tr('有')}</option>
              <option value="unknown">{tr('不详')}</option>
            </select>
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-xs text-gray-400">{tr('常见症状（多选）')}</div>
          <div className="flex flex-wrap gap-2">
            {symptomOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleSymptom(item.key)}
                className={`px-2 py-1 rounded text-xs border ${
                  symptoms.includes(item.key) ? 'bg-teal-900 text-teal-200 border-teal-500' : 'bg-gray-900 text-gray-300 border-gray-700'
                }`}
              >
                {tr(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-xs text-gray-400">{tr('流行病学 / 高危因素（多选）')}</div>
          <div className="flex flex-wrap gap-2">
            {riskOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleRisk(item.key)}
                className={`px-2 py-1 rounded text-xs border ${
                  risks.includes(item.key) ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-gray-900 text-gray-300 border-gray-700'
                }`}
              >
                {tr(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-xs text-gray-400">{tr('检查指标')}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <select className={uiStyles.input.default} value={labs.ppd} onChange={(e) => setLabs({ ...labs, ppd: e.target.value as PpdValue })}>
              {labOptions.ppd.map((v) => <option key={v} value={v}>{tr(labValueLabelMap[v])}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.igra} onChange={(e) => setLabs({ ...labs, igra: e.target.value as IgraValue })}>
              {labOptions.igra.map((v) => <option key={v} value={v}>{tr(labValueLabelMap[v])}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.sputum} onChange={(e) => setLabs({ ...labs, sputum: e.target.value as SputumValue })}>
              {labOptions.sputum.map((v) => <option key={v} value={v}>{tr(labValueLabelMap[v])}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.imaging} onChange={(e) => setLabs({ ...labs, imaging: e.target.value as ImagingValue })}>
              {labOptions.imaging.map((v) => <option key={v} value={v}>{tr(labValueLabelMap[v])}</option>)}
            </select>
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              {tr('AI 辅助填写（TB 智能匹配）')}
            </div>
            <span className="text-[11px] text-gray-500">{matched ? tr('已匹配结果') : tr('输入主诉自动匹配症状/风险')}</span>
          </div>
          <textarea
            className={uiStyles.input.textarea + ' min-h-[72px]'}
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
          />
          <button onClick={handleAIMatch} className={uiStyles.button.primary + ' w-full'}>
            {tr('一键 AI 匹配')}
          </button>

          <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/60">
            <div className="text-xs text-gray-400 mb-2">{tr('风险提示卡')}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded ${riskLevel === 'high' ? 'bg-red-900 text-red-200' : riskLevel === 'suspected' ? 'bg-amber-900 text-amber-200' : 'bg-green-900 text-green-200'}`}>
                {riskLevelLabel(riskLevel, tr)}
              </span>
              <span className="text-gray-300">{tr('风险分：')}{Math.round(riskScore * 100)}%</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">{tr('触发原因：')}{reasons.join('、') || tr('暂未识别')}</div>
            <div className="text-xs text-blue-200 mt-1">{tr('建议：完善 IGRA/痰检；如咳血/高热请及时就医')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className={uiStyles.button.secondary} onClick={resetAll}>{tr('重置')}</button>
          <button className={uiStyles.button.primary} onClick={handleCreateProfile}>{tr('创建档案')}</button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="aurora-card glass-card-hover p-3 min-h-[200px]">
          <div className="flex items-center gap-2 text-gray-200 text-sm mb-2">
            <Shield className="h-4 w-4 text-teal-400" />
            {tr('个人档案预览')}
          </div>
          {profile ? (
            <div className="space-y-2 text-sm">
              <div className="text-gray-100">{basic.name} · {genderLabel(basic.gender, tr)} · {basic.age}{tr('岁')} · {basic.region}</div>
              <div className="flex flex-wrap gap-1">
                {symptomOptions.filter(s => symptoms.includes(s.key)).map((s) => (
                  <span key={s.key} className="px-2 py-1 rounded bg-gray-900 text-blue-200 text-[11px] border border-gray-700">{tr(s.label)}</span>
                ))}
                {riskOptions.filter(r => risks.includes(r.key)).map((r) => (
                  <span key={r.key} className="px-2 py-1 rounded bg-gray-900 text-amber-200 text-[11px] border border-gray-700">{tr(r.label)}</span>
                ))}
              </div>
              <div className="text-xs text-gray-300">{tr('检查：')}PPD {tr(labValueLabelMap[labs.ppd])} / IGRA {tr(labValueLabelMap[labs.igra])} / {tr('痰检')} {tr(labValueLabelMap[labs.sputum])}</div>
              <div className="text-xs text-gray-400">{tr('AI 建议')}：{tr('风险')} {riskLevelLabel(riskLevel, tr)}，{tr('建议：完善 IGRA/痰检；如咳血/高热请及时就医')}</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">{tr('填写信息并点击“创建档案”后展示')}</div>
          )}
        </div>

        <div className="aurora-card glass-card-hover p-3 min-h-[200px]">
          <div className="flex items-center gap-2 text-gray-200 text-sm mb-2">
            <Database className="h-4 w-4 text-blue-400" />
            {tr('数据库入库展示')}
          </div>
          {profile ? (
            <div className="text-sm text-gray-200 space-y-1">
              <div className="flex items-center gap-2">
                {profile.persisted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
                <span>{profile.persisted ? tr('已写入数据库') : tr('当前未写入 Supabase（本地草稿）')}</span>
              </div>
              <div className="text-xs text-gray-400">{tr('表名：patients')}</div>
              <div className="text-xs text-gray-400">{tr('主键：')}{profile.patientId}</div>
              <div className="text-xs text-gray-400">{tr('时间：')}{profile.createdAt}</div>
              <div className="text-xs text-gray-400">{tr('字段摘要：')}risk_level={riskLevelLabel(profile.riskLevel, tr)}，symptom_count={profile.symptomCount}，lab_status={profile.labStatus}</div>
              {!profile.persisted && (
                <div className="text-xs text-amber-300">
                  {tr('写库失败：')}{profile.persistError || tr('未知原因')}。{tr('请检查 Supabase URL、Anon Key 和 RLS 权限后重试。')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>{tr('待创建档案后展示写入信息')}</span>
            </div>
          )}
        </div>

        <div className="aurora-card glass-card-hover p-3 min-h-[200px] space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Shield className="h-4 w-4 text-teal-400" />
            {tr('数字人预览')}
          </div>
          <DigitalHumanAvatar speaking={speaking} />
          <button
            className={uiStyles.button.secondary + ' flex items-center gap-2 justify-center w-full text-sm'}
            onClick={() => {
              speakText(
                tr('您好，我是肺结核筛查数字助手，已为您记录档案信息，请继续完善检查与随访计划。'),
                locale,
                () => setSpeaking(true),
                () => setSpeaking(false)
              );
            }}
          >
            <Play className="h-4 w-4" />
            {tr('让数字人播报问候')}
          </button>
        </div>
      </div>
    </div>
  );
}
