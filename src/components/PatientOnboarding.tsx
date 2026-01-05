import { useMemo, useState } from 'react';
import { ClipboardCheck, Sparkles, Shield, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { uiStyles } from '../lib/theme';

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

type LabKey = 'ppd' | 'igra' | 'sputum' | 'imaging';

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

const labOptions: Record<LabKey, string[]> = {
  ppd: ['未做', '阴性', '阳性'],
  igra: ['未做', '阴性', '阳性', '待出'],
  sputum: ['未采', '阴性', '阳性', '待出'],
  imaging: ['未做', '已做（录入日期）'],
};

interface Profile {
  patientId: string;
  createdAt: string;
  riskLevel: '高危' | '疑似' | '低危';
  symptomCount: number;
  labStatus: string;
}

export function PatientOnboarding() {
  const [basic, setBasic] = useState({
    name: '张*三',
    gender: '男',
    age: 35,
    phone: '',
    region: '广西·南宁',
    tbHistory: '无',
  });
  const [symptoms, setSymptoms] = useState<SymptomKey[]>([]);
  const [risks, setRisks] = useState<RiskKey[]>([]);
  const [labs, setLabs] = useState<Record<LabKey, string>>({
    ppd: '未做',
    igra: '未做',
    sputum: '未采',
    imaging: '未做',
  });
  const [aiInput, setAiInput] = useState('咳嗽三周，夜间盗汗，午后低热，家属最近确诊结核');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matched, setMatched] = useState(false);

  const riskScore = useMemo(() => {
    let score = 0;
    score += symptoms.length * 0.12;
    score += risks.length * 0.1;
    if (labs.igra === '阳性' || labs.ppd === '阳性') score += 0.25;
    if (labs.sputum === '阳性') score += 0.3;
    return Math.min(score, 1);
  }, [symptoms, risks, labs]);

  const riskLevel = riskScore >= 0.7 ? '高危' : riskScore >= 0.4 ? '疑似' : '低危';

  const reasons = useMemo(() => {
    const list: string[] = [];
    if (symptoms.includes('cough_2w')) list.push('咳嗽≥2周');
    if (symptoms.includes('night_sweat') || symptoms.includes('fever')) list.push('盗汗/午后低热');
    if (risks.includes('contact')) list.push('有密接史');
    if (risks.includes('tb_history')) list.push('既往结核史');
    if (labs.igra === '阳性' || labs.ppd === '阳性') list.push('免疫学阳性');
    if (labs.sputum === '阳性') list.push('痰检阳性');
    return list.slice(0, 3);
  }, [symptoms, risks, labs]);

  const toggleSymptom = (key: SymptomKey) => {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const toggleRisk = (key: RiskKey) => {
    setRisks((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const handleAIMatch = () => {
    const text = aiInput;
    const matchedSymptoms: SymptomKey[] = [];
    const matchedRisks: RiskKey[] = [];

    const hit = (keywords: string[]) => keywords.some((k) => text.includes(k));
    if (hit(['咳嗽', '咳'])) matchedSymptoms.push('cough_2w');
    if (hit(['咳痰'])) matchedSymptoms.push('phlegm');
    if (hit(['咳血', '痰血'])) matchedSymptoms.push('hemoptysis');
    if (hit(['低热', '发热', '午后'])) matchedSymptoms.push('fever');
    if (hit(['盗汗'])) matchedSymptoms.push('night_sweat');
    if (hit(['消瘦', '体重', '瘦'])) matchedSymptoms.push('weight_loss');
    if (hit(['乏力'])) matchedSymptoms.push('fatigue');
    if (hit(['胸痛', '气促'])) matchedSymptoms.push('chest_pain');

    if (hit(['密接', '同住', '家属'])) matchedRisks.push('contact');
    if (hit(['既往', '复发'])) matchedRisks.push('tb_history');
    if (hit(['糖尿病'])) matchedRisks.push('dm');
    if (hit(['激素', '免疫抑制'])) matchedRisks.push('immune');
    if (hit(['hiv', 'HIV'])) matchedRisks.push('hiv');
    if (hit(['吸烟'])) matchedRisks.push('smoking');
    if (hit(['老人', '老年'])) matchedRisks.push('elderly');

    setSymptoms((prev) => Array.from(new Set([...prev, ...matchedSymptoms])));
    setRisks((prev) => Array.from(new Set([...prev, ...matchedRisks])));
    setMatched(true);
  };

  const handleCreateProfile = () => {
    const pid = `GX-2025${Math.floor(Math.random() * 9000 + 1000)}`;
    setProfile({
      patientId: pid,
      createdAt: new Date().toLocaleString(),
      riskLevel,
      symptomCount: symptoms.length,
      labStatus: `${labs.ppd}/${labs.igra}/${labs.sputum}`,
    });
  };

  const resetAll = () => {
    setBasic({ name: '张*三', gender: '男', age: 35, phone: '', region: '广西·南宁', tbHistory: '无' });
    setSymptoms([]);
    setRisks([]);
    setLabs({ ppd: '未做', igra: '未做', sputum: '未采', imaging: '未做' });
    setProfile(null);
    setMatched(false);
  };

  return (
    <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-y-auto bg-gray-900">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <ClipboardCheck className="h-4 w-4 text-teal-400" />
            患者建档（TB 指标）
          </div>
          <span className="text-[11px] text-gray-500">必填信息 + AI 智能匹配</span>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gray-400 mb-1">基础信息</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input className={uiStyles.input.default} value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} placeholder="姓名（可脱敏）" />
            <input className={uiStyles.input.default} value={basic.age} onChange={(e) => setBasic({ ...basic, age: Number(e.target.value) || 0 })} placeholder="年龄" />
            <select className={uiStyles.input.default} value={basic.gender} onChange={(e) => setBasic({ ...basic, gender: e.target.value })}>
              <option>男</option>
              <option>女</option>
            </select>
            <input className={uiStyles.input.default} value={basic.phone} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} placeholder="联系方式（选填）" />
            <input className={uiStyles.input.default + ' col-span-2'} value={basic.region} onChange={(e) => setBasic({ ...basic, region: e.target.value })} placeholder="地区（市/县/乡镇）" />
            <select className={uiStyles.input.default + ' col-span-2'} value={basic.tbHistory} onChange={(e) => setBasic({ ...basic, tbHistory: e.target.value })}>
              <option>无</option>
              <option>有</option>
              <option>不详</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gray-400">常见症状（多选）</div>
          <div className="flex flex-wrap gap-2">
            {symptomOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleSymptom(item.key)}
                className={`px-2 py-1 rounded text-xs border ${
                  symptoms.includes(item.key) ? 'bg-teal-900 text-teal-200 border-teal-500' : 'bg-gray-900 text-gray-300 border-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gray-400">流行病学 / 高危因素（多选）</div>
          <div className="flex flex-wrap gap-2">
            {riskOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleRisk(item.key)}
                className={`px-2 py-1 rounded text-xs border ${
                  risks.includes(item.key) ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-gray-900 text-gray-300 border-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gray-400">检查指标</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <select className={uiStyles.input.default} value={labs.ppd} onChange={(e) => setLabs({ ...labs, ppd: e.target.value })}>
              {labOptions.ppd.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.igra} onChange={(e) => setLabs({ ...labs, igra: e.target.value })}>
              {labOptions.igra.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.sputum} onChange={(e) => setLabs({ ...labs, sputum: e.target.value })}>
              {labOptions.sputum.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select className={uiStyles.input.default} value={labs.imaging} onChange={(e) => setLabs({ ...labs, imaging: e.target.value })}>
              {labOptions.imaging.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              AI 辅助填写（TB 智能匹配）
            </div>
            <span className="text-[11px] text-gray-500">{matched ? '已匹配结果' : '输入主诉自动匹配症状/风险'}</span>
          </div>
          <textarea
            className={uiStyles.input.textarea + ' min-h-[72px]'}
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
          />
          <button onClick={handleAIMatch} className={uiStyles.button.primary + ' w-full'}>
            一键 AI 匹配
          </button>

          <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/60">
            <div className="text-xs text-gray-400 mb-2">风险提示卡</div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded ${riskLevel === '高危' ? 'bg-red-900 text-red-200' : riskLevel === '疑似' ? 'bg-amber-900 text-amber-200' : 'bg-green-900 text-green-200'}`}>
                {riskLevel}
              </span>
              <span className="text-gray-300">风险分：{Math.round(riskScore * 100)}%</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">触发原因：{reasons.join('、') || '暂未识别'}</div>
            <div className="text-xs text-blue-200 mt-1">建议：完善 IGRA/痰检；如咳血/高热请及时就医</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className={uiStyles.button.secondary} onClick={resetAll}>重置</button>
          <button className={uiStyles.button.primary} onClick={handleCreateProfile}>创建档案</button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 min-h-[200px]">
          <div className="flex items-center gap-2 text-gray-200 text-sm mb-2">
            <Shield className="h-4 w-4 text-teal-400" />
            个人档案预览
          </div>
          {profile ? (
            <div className="space-y-2 text-sm">
              <div className="text-gray-100">{basic.name} · {basic.gender} · {basic.age}岁 · {basic.region}</div>
              <div className="flex flex-wrap gap-1">
                {symptomOptions.filter(s => symptoms.includes(s.key)).map((s) => (
                  <span key={s.key} className="px-2 py-1 rounded bg-gray-900 text-blue-200 text-[11px] border border-gray-700">{s.label}</span>
                ))}
                {riskOptions.filter(r => risks.includes(r.key)).map((r) => (
                  <span key={r.key} className="px-2 py-1 rounded bg-gray-900 text-amber-200 text-[11px] border border-gray-700">{r.label}</span>
                ))}
              </div>
              <div className="text-xs text-gray-300">检查：PPD {labs.ppd} / IGRA {labs.igra} / 痰检 {labs.sputum}</div>
              <div className="text-xs text-gray-400">AI 建议：风险 {riskLevel}，建议完善 IGRA/痰检，症状加重及时就医</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">填写信息并点击“创建档案”后展示</div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 min-h-[200px]">
          <div className="flex items-center gap-2 text-gray-200 text-sm mb-2">
            <Database className="h-4 w-4 text-blue-400" />
            数据库入库展示
          </div>
          {profile ? (
            <div className="text-sm text-gray-200 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>已写入数据库</span>
              </div>
              <div className="text-xs text-gray-400">表名：tb_patient_profiles</div>
              <div className="text-xs text-gray-400">主键：{profile.patientId}</div>
              <div className="text-xs text-gray-400">时间：{profile.createdAt}</div>
              <div className="text-xs text-gray-400">字段摘要：risk_level={profile.riskLevel}，symptom_count={profile.symptomCount}，lab_status={profile.labStatus}</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>待创建档案后展示写入信息</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
