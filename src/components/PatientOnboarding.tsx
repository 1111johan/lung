import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, Play, Shield } from 'lucide-react';
import { createPatientProfile } from '../lib/supabaseService';
import { useDataContext } from '../lib/dataContext';
import { useI18n } from '../lib/i18n';
import { DigitalHumanAvatar } from './DigitalHuman';
import { speakText } from '../lib/voice';
import tbSchemaRaw from '../formSchemas/TB.json';

type GenderCode = 'male' | 'female';
type RiskLevelCode = 'high' | 'suspected' | 'low';
type FieldType = 'input' | 'number' | 'textarea' | 'radio' | 'select' | 'checkbox';
type FieldValue = string | number | boolean;
type FormValues = Record<string, FieldValue>;

interface FormOption {
  label: string;
  value: FieldValue;
}

interface FormField {
  type: FieldType;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: FormOption[];
}

interface FormSection {
  title: string;
  fields: FormField[];
}

interface FormSchema {
  formId: string;
  formTitle: string;
  submitText: string;
  sections: FormSection[];
}

interface SubmitState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  patientId?: string;
  createdAt?: string;
  message?: string;
}

const tbFormSchema = tbSchemaRaw as FormSchema;

const symptomFieldNames = [
  'symptom_cough',
  'symptom_sputum',
  'symptom_hemoptysis',
  'symptom_fever',
  'symptom_night_sweats',
  'symptom_chest_pain',
  'symptom_weight_loss',
] as const;

const riskFactorFieldNames = ['past_tb_history', 'family_tb_history', 'immunosuppressed', 'chronic_disease'] as const;

function getDefaultFieldValue(field: FormField): FieldValue {
  if (field.type === 'checkbox') return false;
  if ((field.type === 'radio' || field.type === 'select') && field.options && field.options.length > 0) {
    return field.options[0].value;
  }
  return '';
}

function buildInitialValues(schema: FormSchema): FormValues {
  const values: FormValues = {};
  schema.sections.forEach((section) => {
    section.fields.forEach((field) => {
      values[field.name] = getDefaultFieldValue(field);
    });
  });
  return values;
}

function optionKey(value: FieldValue) {
  return JSON.stringify(value);
}

function parseSelectValue(field: FormField, rawValue: string): FieldValue {
  const matched = field.options?.find((option) => optionKey(option.value) === rawValue);
  return matched ? matched.value : rawValue;
}

function fieldRequiredMissing(field: FormField, value: FieldValue | undefined) {
  if (!field.required) return false;
  if (field.type === 'checkbox') return value !== true;
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized.length === 0;
}

const riskLevelLabel = (value: RiskLevelCode, tr: (text: string) => string) => {
  if (value === 'high') return tr('高危');
  if (value === 'suspected') return tr('疑似');
  return tr('低危');
};

function mapTbResultLabel(rawValue: string) {
  if (rawValue === 'positive') return '阳性';
  if (rawValue === 'negative') return '阴性';
  if (rawValue === 'unknown') return '不详';
  return null;
}

export function PatientOnboarding() {
  const { locale, tr } = useI18n();
  const { addPatientFromSupabase } = useDataContext();

  const allFields = useMemo(() => tbFormSchema.sections.flatMap((section) => section.fields), []);
  const fieldMap = useMemo(() => new Map(allFields.map((field) => [field.name, field])), [allFields]);
  const requiredFields = useMemo(() => allFields.filter((field) => field.required), [allFields]);

  const [formValues, setFormValues] = useState<FormValues>(() => buildInitialValues(tbFormSchema));
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const [validationError, setValidationError] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const formId = 'tb-onboarding-form';

  const getString = (name: string) => {
    const value = formValues[name];
    if (value === undefined || value === null) return '';
    return String(value).trim();
  };

  const getBoolean = (name: string) => {
    const value = formValues[name];
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  };

  const getOptionLabel = (fieldName: string, value: FieldValue | undefined) => {
    const field = fieldMap.get(fieldName);
    const option = field?.options?.find((item) => optionKey(item.value) === optionKey(value ?? ''));
    return option?.label || '';
  };

  const completedRequiredCount = requiredFields.filter(
    (field) => !fieldRequiredMissing(field, formValues[field.name])
  ).length;
  const completionRate = requiredFields.length
    ? Math.round((completedRequiredCount / requiredFields.length) * 100)
    : 100;

  let score = 0;
  const symptomCount = symptomFieldNames.filter((name) => getBoolean(name)).length;
  score += symptomCount * 0.08;
  if (getString('tb_contact_history') === 'yes') score += 0.18;
  if (getString('tb_test_result') === 'positive') score += 0.22;
  if (getString('chest_imaging_result') === 'abnormal') score += 0.18;
  const riskFactorCount = riskFactorFieldNames.filter((name) => getBoolean(name)).length;
  score += riskFactorCount * 0.1;
  const riskScore = Math.min(score, 1);
  const riskLevel: RiskLevelCode = riskScore >= 0.7 ? 'high' : riskScore >= 0.4 ? 'suspected' : 'low';

  const setFieldValue = (name: string, value: FieldValue) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const buildChiefComplaint = () => {
    const symptoms = symptomFieldNames
      .filter((name) => getBoolean(name))
      .map((name) => fieldMap.get(name)?.label)
      .filter((label): label is string => Boolean(label));

    const chunks: string[] = [];
    if (symptoms.length > 0) chunks.push(`症状：${symptoms.join('、')}`);

    const coughDurationLabel = getOptionLabel('cough_duration', formValues.cough_duration);
    if (coughDurationLabel) chunks.push(`咳嗽时长：${coughDurationLabel}`);

    const otherSymptoms = getString('other_symptoms');
    if (otherSymptoms) chunks.push(`补充症状：${otherSymptoms}`);

    const medications = getString('current_medications');
    if (medications) chunks.push(`当前用药：${medications}`);

    return chunks.join('；');
  };

  const handleSubmit = async () => {
    setValidationError('');

    const missingFields = allFields.filter((field) => fieldRequiredMissing(field, formValues[field.name]));
    if (missingFields.length > 0) {
      const missingText = missingFields
        .slice(0, 5)
        .map((field) => field.label)
        .join('、');
      setValidationError(`请先完成必填项：${missingText}`);
      return;
    }

    setSubmitState({ status: 'submitting' });

    const patientCode = `GX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const tbTestRaw = getString('tb_test_result');
    const mappedTbResult = mapTbResultLabel(tbTestRaw);
    const sputumTestResult = getBoolean('has_sputum_test') ? mappedTbResult || '已做' : '未做';
    const chiefComplaint = buildChiefComplaint();

    try {
      const saved = await createPatientProfile({
        patient_code: patientCode,
        name: getString('name') || tr('未填写姓名'),
        gender: (getString('gender') === 'female' ? 'female' : 'male') as GenderCode,
        age: Number(getString('age')) || 0,
        region: getString('address') || tr('广西'),
        contact_phone: getString('phone') || null,
        tb_history: getBoolean('past_tb_history') || getString('tb_contact_history') === 'yes',
        ppd_test_result: mappedTbResult,
        sputum_test_result: sputumTestResult,
        chief_complaint: chiefComplaint || null,
      });

      addPatientFromSupabase(saved);

      setSubmitState({
        status: 'success',
        patientId: saved.patient_code,
        createdAt: new Date(saved.created_at).toLocaleString(),
        message: tr('已写入数据库'),
      });
    } catch (error) {
      const persistError = error instanceof Error ? error.message : 'unknown error';
      setSubmitState({
        status: 'error',
        patientId: patientCode,
        createdAt: new Date().toLocaleString(),
        message: `${tr('写库失败：')}${persistError}。${tr('请检查 Supabase URL、Anon Key 和 RLS 权限后重试。')}`,
      });
    }
  };

  const handleReset = () => {
    setFormValues(buildInitialValues(tbFormSchema));
    setValidationError('');
    setSubmitState({ status: 'idle' });
  };

  const previewReady = submitState.status !== 'idle';
  const genderLabel = getString('gender') === 'female' ? tr('女') : tr('男');
  const selectedSymptoms = symptomFieldNames
    .filter((name) => getBoolean(name))
    .map((name) => fieldMap.get(name)?.label)
    .filter((label): label is string => Boolean(label));
  const selectedRiskTags = [
    ...(getString('tb_contact_history') === 'yes' ? [fieldMap.get('tb_contact_history')?.label || '结核接触史'] : []),
    ...riskFactorFieldNames
      .filter((name) => getBoolean(name))
      .map((name) => fieldMap.get(name)?.label)
      .filter((label): label is string => Boolean(label)),
  ];

  return (
    <div className="health-profile-shell flex-1 min-h-0 h-full overflow-y-auto p-4 md:p-6 fade-in">
      <div className="health-profile-font mx-auto max-w-[1320px] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <ClipboardCheck className="h-4 w-4 text-[rgb(var(--accent))]" />
            <span>{tbFormSchema.formTitle || tr('个人健康档案')}</span>
          </div>
          <span className="text-[11px] text-gray-500">
            {tr('必填信息 + AI 智能匹配')} · {tr('完成度')} {completionRate}%
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <form
            id={formId}
            className="min-w-0 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {tbFormSchema.sections.map((section, sectionIndex) => {
              const requiredInSection = section.fields.filter((field) => field.required);
              const completedInSection = requiredInSection.filter(
                (field) => !fieldRequiredMissing(field, formValues[field.name])
              ).length;

              return (
                <section key={section.title} className="hp-section">
                  <div className="hp-section-top">
                    <div className="hp-section-index">{sectionIndex + 1}</div>
                    <div>
                      <h2 className="hp-section-title">{section.title}</h2>
                      <p className="hp-section-sub">
                        必填完成 {completedInSection}/{requiredInSection.length || 0}
                      </p>
                    </div>
                  </div>

                  <div className="hp-grid">
                    {section.fields.map((field) => {
                      const currentValue = formValues[field.name];
                      const wide = field.type === 'textarea' || field.type === 'checkbox';

                      return (
                        <div key={field.name} className={`hp-field ${wide ? 'hp-field-wide' : ''}`}>
                          {field.type !== 'checkbox' && (
                            <label className="hp-label" htmlFor={field.name}>
                              {field.label}
                              {field.required ? <span className="hp-required">*</span> : null}
                            </label>
                          )}

                          {(field.type === 'input' || field.type === 'number') && (
                            <input
                              id={field.name}
                              type={field.type === 'number' ? 'number' : 'text'}
                              min={field.min}
                              max={field.max}
                              className="hp-input"
                              value={String(currentValue ?? '')}
                              onChange={(e) => setFieldValue(field.name, e.target.value)}
                              placeholder={field.placeholder || ''}
                            />
                          )}

                          {field.type === 'textarea' && (
                            <textarea
                              id={field.name}
                              className="hp-textarea"
                              value={String(currentValue ?? '')}
                              onChange={(e) => setFieldValue(field.name, e.target.value)}
                              placeholder={field.placeholder || ''}
                            />
                          )}

                          {field.type === 'select' && (
                            <select
                              id={field.name}
                              className="hp-select"
                              value={optionKey(currentValue ?? '')}
                              onChange={(e) => setFieldValue(field.name, parseSelectValue(field, e.target.value))}
                            >
                              {(field.options || []).map((option) => (
                                <option key={`${field.name}-${optionKey(option.value)}`} value={optionKey(option.value)}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {field.type === 'radio' && (
                            <div className="hp-options">
                              {(field.options || []).map((option) => {
                                const active = optionKey(currentValue ?? '') === optionKey(option.value);
                                return (
                                  <button
                                    key={`${field.name}-${optionKey(option.value)}`}
                                    type="button"
                                    onClick={() => setFieldValue(field.name, option.value)}
                                    className={`hp-chip ${active ? 'hp-chip-active' : ''}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {field.type === 'checkbox' && (
                            <label className={`hp-check ${currentValue === true ? 'hp-check-active' : ''}`} htmlFor={field.name}>
                              <input
                                id={field.name}
                                type="checkbox"
                                checked={currentValue === true}
                                onChange={(e) => setFieldValue(field.name, e.target.checked)}
                                className="sr-only"
                              />
                              <span className="hp-check-indicator">{currentValue === true ? '✓' : ''}</span>
                              <span>
                                {field.label}
                                {field.required ? <span className="hp-required">*</span> : null}
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <div className="hp-action-card">
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-sm text-gray-200">
                <div className="flex items-center justify-between">
                  <span>{tr('风险等级')}</span>
                  <span className="hp-risk-badge">{riskLevelLabel(riskLevel, tr)}</span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {tr('风险分：')}
                  {Math.round(riskScore * 100)}%
                </div>
                <div className="mt-2 h-2 rounded-full overflow-hidden bg-[rgb(var(--card))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--accent))]"
                    style={{ width: `${Math.max(4, Math.round(riskScore * 100))}%` }}
                  ></div>
                </div>
              </div>

              {validationError && (
                <div className="rounded-2xl border border-amber-700/60 bg-amber-900/20 p-3 text-xs text-amber-200">
                  {validationError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="hp-btn hp-btn-secondary" onClick={handleReset}>
                  {tr('重置')}
                </button>
                <button
                  type="submit"
                  className="hp-btn hp-btn-primary"
                  disabled={submitState.status === 'submitting'}
                >
                  {submitState.status === 'submitting' ? tr('提交中...') : tbFormSchema.submitText || tr('创建档案')}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-3">
            <div className="aurora-card glass-card-hover p-3 min-h-[220px]">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-200">
                <Shield className="h-4 w-4 text-teal-400" />
                {tr('个人档案预览')}
              </div>

              {previewReady ? (
                <div className="space-y-2 text-sm">
                  <div className="text-gray-100">
                    {getString('name') || tr('未填写姓名')} · {genderLabel} · {getString('age') || '--'}{tr('岁')} ·{' '}
                    {getString('address') || tr('广西')}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {selectedSymptoms.map((label) => (
                      <span
                        key={label}
                        className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-[11px] text-blue-200"
                      >
                        {label}
                      </span>
                    ))}
                    {selectedRiskTags.map((label) => (
                      <span
                        key={label}
                        className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-[11px] text-amber-200"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-gray-300">
                    {tr('检查：')}影像 {getOptionLabel('chest_imaging_result', formValues.chest_imaging_result) || '未填'} / TB检测{' '}
                    {getOptionLabel('tb_test_result', formValues.tb_test_result) || '未填'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {tr('风险等级')}：{riskLevelLabel(riskLevel, tr)}，{tr('风险分：')}
                    {Math.round(riskScore * 100)}%
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">{tr('填写信息并点击“创建档案”后展示')}</div>
              )}
            </div>

            <div className="aurora-card glass-card-hover p-3 min-h-[220px]">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-200">
                <Database className="h-4 w-4 text-blue-400" />
                {tr('数据库入库展示')}
              </div>

              {submitState.status !== 'idle' ? (
                <div className="space-y-1 text-sm text-gray-200">
                  <div className="flex items-center gap-2">
                    {submitState.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                    <span>{submitState.status === 'success' ? tr('已写入数据库') : tr('当前未写入 Supabase（本地草稿）')}</span>
                  </div>
                  <div className="text-xs text-gray-400">{tr('表名：patients')}</div>
                  {submitState.patientId && <div className="text-xs text-gray-400">{tr('主键：')}{submitState.patientId}</div>}
                  {submitState.createdAt && <div className="text-xs text-gray-400">{tr('时间：')}{submitState.createdAt}</div>}
                  {submitState.status === 'error' && submitState.message && (
                    <div className="text-xs text-amber-300">{submitState.message}</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>{tr('待创建档案后展示写入信息')}</span>
                </div>
              )}
            </div>

            <div className="aurora-card glass-card-hover p-3 min-h-[260px] space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-200">
                <Shield className="h-4 w-4 text-teal-400" />
                {tr('数字人预览')}
              </div>
              <DigitalHumanAvatar speaking={speaking} />
              <button
                className="hp-btn hp-btn-secondary flex w-full items-center justify-center gap-2"
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
          </aside>
        </div>
      </div>
    </div>
  );
}
