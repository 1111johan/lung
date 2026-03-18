import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, Play, Shield } from 'lucide-react';
import { createPatientProfile } from '../lib/supabaseService';
import { useDataContext } from '../lib/dataContext';
import { useI18n, type AppLocale } from '../lib/i18n';
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

type LocaleText = Record<AppLocale, string>;

interface OnboardingUiLocale {
  requiredDonePrefix: string;
  validationRequiredPrefix: string;
  symptomPrefix: string;
  coughDurationPrefix: string;
  otherSymptomsPrefix: string;
  medicationsPrefix: string;
  complaintSeparator: string;
  listSeparator: string;
  testsPrefix: string;
  imagingLabel: string;
  tbTestLabel: string;
  notFilled: string;
  tbContactFallback: string;
  sputumDoneLabel: string;
  sputumNotDoneLabel: string;
  tbResultLabels: Record<'positive' | 'negative' | 'unknown', string>;
}

const formTitleLocaleMap: LocaleText = {
  zh: '个人健康档案表单',
  en: 'Health Profile Form',
  th: 'แบบฟอร์มแฟ้มสุขภาพส่วนบุคคล',
  id: 'Formulir Profil Kesehatan',
  ms: 'Borang Profil Kesihatan',
};

const submitTextLocaleMap: LocaleText = {
  zh: '提交档案',
  en: 'Submit Profile',
  th: 'ส่งแฟ้ม',
  id: 'Kirim Profil',
  ms: 'Hantar Profil',
};

const sectionTitleLocaleMap: Record<string, LocaleText> = {
  '基本信息': {
    zh: '基本信息',
    en: 'Basic Information',
    th: 'ข้อมูลพื้นฐาน',
    id: 'Informasi Dasar',
    ms: 'Maklumat Asas',
  },
  '基础情况': {
    zh: '基础情况',
    en: 'Baseline Status',
    th: 'สถานะพื้นฐาน',
    id: 'Kondisi Dasar',
    ms: 'Keadaan Asas',
  },
  '当前症状': {
    zh: '当前症状',
    en: 'Current Symptoms',
    th: 'อาการปัจจุบัน',
    id: 'Gejala Saat Ini',
    ms: 'Gejala Semasa',
  },
  '流行病学与高危因素': {
    zh: '流行病学与高危因素',
    en: 'Epidemiology & High-Risk Factors',
    th: 'ระบาดวิทยาและปัจจัยเสี่ยงสูง',
    id: 'Epidemiologi & Faktor Risiko Tinggi',
    ms: 'Epidemiologi & Faktor Risiko Tinggi',
  },
  '检查情况': {
    zh: '检查情况',
    en: 'Examination Status',
    th: 'สถานะการตรวจ',
    id: 'Status Pemeriksaan',
    ms: 'Status Pemeriksaan',
  },
  '补充信息': {
    zh: '补充信息',
    en: 'Additional Information',
    th: 'ข้อมูลเพิ่มเติม',
    id: 'Informasi Tambahan',
    ms: 'Maklumat Tambahan',
  },
  '知情确认': {
    zh: '知情确认',
    en: 'Consent Confirmation',
    th: 'การยืนยันความยินยอม',
    id: 'Konfirmasi Persetujuan',
    ms: 'Pengesahan Persetujuan',
  },
};

const fieldLabelLocaleMap: Record<string, LocaleText> = {
  name: { zh: '姓名', en: 'Name', th: 'ชื่อ', id: 'Nama', ms: 'Nama' },
  gender: { zh: '性别', en: 'Gender', th: 'เพศ', id: 'Jenis kelamin', ms: 'Jantina' },
  age: { zh: '年龄', en: 'Age', th: 'อายุ', id: 'Usia', ms: 'Umur' },
  phone: { zh: '手机号', en: 'Phone number', th: 'เบอร์มือถือ', id: 'Nomor ponsel', ms: 'Nombor telefon' },
  idNumber: { zh: '身份证号', en: 'ID number', th: 'หมายเลขบัตรประชาชน', id: 'Nomor identitas', ms: 'Nombor kad pengenalan' },
  address: { zh: '居住地址', en: 'Address', th: 'ที่อยู่ปัจจุบัน', id: 'Alamat tempat tinggal', ms: 'Alamat kediaman' },
  height: { zh: '身高（cm）', en: 'Height (cm)', th: 'ส่วนสูง (ซม.)', id: 'Tinggi (cm)', ms: 'Tinggi (cm)' },
  weight: { zh: '体重（kg）', en: 'Weight (kg)', th: 'น้ำหนัก (กก.)', id: 'Berat (kg)', ms: 'Berat (kg)' },
  occupation: { zh: '职业', en: 'Occupation', th: 'อาชีพ', id: 'Pekerjaan', ms: 'Pekerjaan' },
  smoking: { zh: '是否吸烟', en: 'Smoking', th: 'สูบบุหรี่หรือไม่', id: 'Merokok', ms: 'Merokok' },
  drinking: { zh: '是否饮酒', en: 'Alcohol use', th: 'ดื่มแอลกอฮอล์หรือไม่', id: 'Konsumsi alkohol', ms: 'Pengambilan alkohol' },
  symptom_cough: { zh: '是否咳嗽', en: 'Cough', th: 'มีอาการไอหรือไม่', id: 'Batuk', ms: 'Batuk' },
  cough_duration: { zh: '咳嗽持续时间', en: 'Cough duration', th: 'ระยะเวลาไอ', id: 'Durasi batuk', ms: 'Tempoh batuk' },
  symptom_sputum: { zh: '是否咳痰', en: 'Sputum', th: 'มีเสมหะหรือไม่', id: 'Berdahak', ms: 'Kahak' },
  symptom_hemoptysis: { zh: '是否咯血', en: 'Hemoptysis', th: 'ไอเป็นเลือดหรือไม่', id: 'Batuk darah', ms: 'Batuk berdarah' },
  symptom_fever: { zh: '是否发热', en: 'Fever', th: 'มีไข้หรือไม่', id: 'Demam', ms: 'Demam' },
  symptom_night_sweats: { zh: '是否盗汗', en: 'Night sweats', th: 'เหงื่อออกกลางคืนหรือไม่', id: 'Keringat malam', ms: 'Peluh malam' },
  symptom_chest_pain: { zh: '是否胸痛', en: 'Chest pain', th: 'เจ็บหน้าอกหรือไม่', id: 'Nyeri dada', ms: 'Sakit dada' },
  symptom_weight_loss: { zh: '是否体重下降', en: 'Weight loss', th: 'น้ำหนักลดหรือไม่', id: 'Penurunan berat badan', ms: 'Penurunan berat badan' },
  other_symptoms: { zh: '其他不适', en: 'Other symptoms', th: 'อาการอื่นๆ', id: 'Gejala lain', ms: 'Gejala lain' },
  tb_contact_history: {
    zh: '是否接触过肺结核患者',
    en: 'Contact with TB patient',
    th: 'เคยสัมผัสผู้ป่วย TB หรือไม่',
    id: 'Kontak pasien TB',
    ms: 'Kontak pesakit TB',
  },
  past_tb_history: {
    zh: '是否有既往肺结核病史',
    en: 'Previous TB history',
    th: 'เคยป่วย TB มาก่อนหรือไม่',
    id: 'Riwayat TB sebelumnya',
    ms: 'Sejarah TB terdahulu',
  },
  family_tb_history: {
    zh: '家中是否有人患过结核',
    en: 'Family TB history',
    th: 'คนในครอบครัวเคยป่วย TB หรือไม่',
    id: 'Riwayat TB keluarga',
    ms: 'Sejarah TB keluarga',
  },
  poor_lifestyle: {
    zh: '是否长期熬夜/营养较差',
    en: 'Poor lifestyle',
    th: 'พักผ่อนน้อยหรือโภชนาการไม่ดี',
    id: 'Gaya hidup kurang sehat',
    ms: 'Gaya hidup tidak sihat',
  },
  chronic_disease: {
    zh: '是否有慢性疾病',
    en: 'Chronic disease',
    th: 'มีโรคเรื้อรังหรือไม่',
    id: 'Penyakit kronis',
    ms: 'Penyakit kronik',
  },
  immunosuppressed: {
    zh: '是否免疫力低下',
    en: 'Immunosuppressed',
    th: 'ภูมิคุ้มกันต่ำหรือไม่',
    id: 'Imunitas rendah',
    ms: 'Imuniti rendah',
  },
  has_chest_imaging: {
    zh: '是否做过胸部X线/CT',
    en: 'Chest X-ray/CT done',
    th: 'เคยตรวจเอกซเรย์หรือ CT ทรวงอกหรือไม่',
    id: 'Sudah foto toraks/CT',
    ms: 'Sudah X-ray/CT dada',
  },
  chest_imaging_result: {
    zh: '影像检查结果',
    en: 'Imaging result',
    th: 'ผลตรวจภาพ',
    id: 'Hasil pencitraan',
    ms: 'Keputusan imej',
  },
  has_sputum_test: {
    zh: '是否做过痰检',
    en: 'Sputum test done',
    th: 'เคยตรวจเสมหะหรือไม่',
    id: 'Sudah tes dahak',
    ms: 'Sudah ujian kahak',
  },
  has_tb_test: {
    zh: '是否做过结核感染检测（PPD/IGRA）',
    en: 'TB infection test (PPD/IGRA) done',
    th: 'เคยตรวจการติดเชื้อ TB (PPD/IGRA) หรือไม่',
    id: 'Sudah tes infeksi TB (PPD/IGRA)',
    ms: 'Sudah ujian jangkitan TB (PPD/IGRA)',
  },
  tb_test_result: { zh: '检测结果', en: 'Test result', th: 'ผลการตรวจ', id: 'Hasil tes', ms: 'Keputusan ujian' },
  surgery_history: { zh: '既往手术史', en: 'Surgery history', th: 'ประวัติการผ่าตัด', id: 'Riwayat operasi', ms: 'Sejarah pembedahan' },
  allergy_history: { zh: '过敏史', en: 'Allergy history', th: 'ประวัติแพ้ยา/สาร', id: 'Riwayat alergi', ms: 'Sejarah alahan' },
  current_medications: {
    zh: '正在服用的药物',
    en: 'Current medications',
    th: 'ยาที่กำลังใช้อยู่',
    id: 'Obat yang sedang dikonsumsi',
    ms: 'Ubat yang sedang diambil',
  },
  consent_confirm: {
    zh: '我确认以上信息由本人填写，内容基本真实',
    en: 'I confirm the information above was filled by myself and is basically true',
    th: 'ข้าพเจ้ายืนยันว่าข้อมูลข้างต้นกรอกโดยตนเองและเป็นความจริงโดยรวม',
    id: 'Saya mengonfirmasi informasi di atas diisi sendiri dan pada dasarnya benar',
    ms: 'Saya mengesahkan maklumat di atas diisi sendiri dan pada asasnya benar',
  },
};

const fieldPlaceholderLocaleMap: Record<string, LocaleText> = {
  name: { zh: '请输入姓名', en: 'Enter name', th: 'กรอกชื่อ', id: 'Masukkan nama', ms: 'Masukkan nama' },
  age: { zh: '请输入年龄', en: 'Enter age', th: 'กรอกอายุ', id: 'Masukkan usia', ms: 'Masukkan umur' },
  phone: { zh: '请输入手机号', en: 'Enter phone number', th: 'กรอกเบอร์มือถือ', id: 'Masukkan nomor ponsel', ms: 'Masukkan nombor telefon' },
  idNumber: {
    zh: '请输入身份证号（可选）',
    en: 'Enter ID number (optional)',
    th: 'กรอกหมายเลขบัตรประชาชน (ไม่บังคับ)',
    id: 'Masukkan nomor identitas (opsional)',
    ms: 'Masukkan nombor kad pengenalan (pilihan)',
  },
  address: {
    zh: '请输入居住地址',
    en: 'Enter address',
    th: 'กรอกที่อยู่ปัจจุบัน',
    id: 'Masukkan alamat tempat tinggal',
    ms: 'Masukkan alamat kediaman',
  },
  height: { zh: '请输入身高', en: 'Enter height', th: 'กรอกส่วนสูง', id: 'Masukkan tinggi', ms: 'Masukkan tinggi' },
  weight: { zh: '请输入体重', en: 'Enter weight', th: 'กรอกน้ำหนัก', id: 'Masukkan berat', ms: 'Masukkan berat' },
  occupation: { zh: '请输入职业', en: 'Enter occupation', th: 'กรอกอาชีพ', id: 'Masukkan pekerjaan', ms: 'Masukkan pekerjaan' },
  other_symptoms: {
    zh: '请输入其他不适',
    en: 'Enter other symptoms',
    th: 'กรอกอาการเพิ่มเติม',
    id: 'Masukkan gejala tambahan',
    ms: 'Masukkan gejala tambahan',
  },
  surgery_history: {
    zh: '请输入既往手术史',
    en: 'Enter surgery history',
    th: 'กรอกประวัติการผ่าตัด',
    id: 'Masukkan riwayat operasi',
    ms: 'Masukkan sejarah pembedahan',
  },
  allergy_history: {
    zh: '请输入过敏史',
    en: 'Enter allergy history',
    th: 'กรอกประวัติแพ้ยา/สาร',
    id: 'Masukkan riwayat alergi',
    ms: 'Masukkan sejarah alahan',
  },
  current_medications: {
    zh: '请输入正在服用的药物',
    en: 'Enter current medications',
    th: 'กรอกยาที่กำลังใช้อยู่',
    id: 'Masukkan obat yang sedang dikonsumsi',
    ms: 'Masukkan ubat yang sedang diambil',
  },
};

const booleanOptionLocaleMap: Record<AppLocale, { trueLabel: string; falseLabel: string }> = {
  zh: { trueLabel: '是', falseLabel: '否' },
  en: { trueLabel: 'Yes', falseLabel: 'No' },
  th: { trueLabel: 'ใช่', falseLabel: 'ไม่ใช่' },
  id: { trueLabel: 'Ya', falseLabel: 'Tidak' },
  ms: { trueLabel: 'Ya', falseLabel: 'Tidak' },
};

const optionValueLocaleMap: Record<string, Record<string, LocaleText>> = {
  gender: {
    male: { zh: '男', en: 'Male', th: 'ชาย', id: 'Laki-laki', ms: 'Lelaki' },
    female: { zh: '女', en: 'Female', th: 'หญิง', id: 'Perempuan', ms: 'Perempuan' },
  },
  cough_duration: {
    lt_1_week: { zh: '少于1周', en: 'Less than 1 week', th: 'น้อยกว่า 1 สัปดาห์', id: 'Kurang dari 1 minggu', ms: 'Kurang daripada 1 minggu' },
    '1_2_weeks': { zh: '1-2周', en: '1-2 weeks', th: '1-2 สัปดาห์', id: '1-2 minggu', ms: '1-2 minggu' },
    gt_2_weeks: { zh: '2周以上', en: 'More than 2 weeks', th: 'มากกว่า 2 สัปดาห์', id: 'Lebih dari 2 minggu', ms: 'Lebih daripada 2 minggu' },
  },
  tb_contact_history: {
    yes: { zh: '是', en: 'Yes', th: 'ใช่', id: 'Ya', ms: 'Ya' },
    no: { zh: '否', en: 'No', th: 'ไม่ใช่', id: 'Tidak', ms: 'Tidak' },
    unknown: { zh: '不清楚', en: 'Unknown', th: 'ไม่แน่ใจ', id: 'Tidak tahu', ms: 'Tidak pasti' },
  },
  chest_imaging_result: {
    normal: { zh: '正常', en: 'Normal', th: 'ปกติ', id: 'Normal', ms: 'Normal' },
    abnormal: { zh: '异常', en: 'Abnormal', th: 'ผิดปกติ', id: 'Abnormal', ms: 'Tidak normal' },
    unknown: { zh: '不清楚', en: 'Unknown', th: 'ไม่แน่ใจ', id: 'Tidak tahu', ms: 'Tidak pasti' },
  },
  tb_test_result: {
    positive: { zh: '阳性', en: 'Positive', th: 'ผลบวก', id: 'Positif', ms: 'Positif' },
    negative: { zh: '阴性', en: 'Negative', th: 'ผลลบ', id: 'Negatif', ms: 'Negatif' },
    unknown: { zh: '不清楚', en: 'Unknown', th: 'ไม่แน่ใจ', id: 'Tidak tahu', ms: 'Tidak pasti' },
  },
};

const onboardingUiLocaleMap: Record<AppLocale, OnboardingUiLocale> = {
  zh: {
    requiredDonePrefix: '必填完成',
    validationRequiredPrefix: '请先完成必填项：',
    symptomPrefix: '症状',
    coughDurationPrefix: '咳嗽时长',
    otherSymptomsPrefix: '补充症状',
    medicationsPrefix: '当前用药',
    complaintSeparator: '；',
    listSeparator: '、',
    testsPrefix: '检查：',
    imagingLabel: '影像',
    tbTestLabel: 'TB检测',
    notFilled: '未填',
    tbContactFallback: '结核接触史',
    sputumDoneLabel: '已做',
    sputumNotDoneLabel: '未做',
    tbResultLabels: { positive: '阳性', negative: '阴性', unknown: '不详' },
  },
  en: {
    requiredDonePrefix: 'Required done',
    validationRequiredPrefix: 'Please complete required fields: ',
    symptomPrefix: 'Symptoms',
    coughDurationPrefix: 'Cough duration',
    otherSymptomsPrefix: 'Additional symptoms',
    medicationsPrefix: 'Current medications',
    complaintSeparator: '; ',
    listSeparator: ', ',
    testsPrefix: 'Tests:',
    imagingLabel: 'Imaging',
    tbTestLabel: 'TB test',
    notFilled: 'Not filled',
    tbContactFallback: 'TB contact history',
    sputumDoneLabel: 'Done',
    sputumNotDoneLabel: 'Not done',
    tbResultLabels: { positive: 'Positive', negative: 'Negative', unknown: 'Unknown' },
  },
  th: {
    requiredDonePrefix: 'กรอกที่จำเป็น',
    validationRequiredPrefix: 'กรุณากรอกข้อมูลบังคับก่อน: ',
    symptomPrefix: 'อาการ',
    coughDurationPrefix: 'ระยะเวลาไอ',
    otherSymptomsPrefix: 'อาการเพิ่มเติม',
    medicationsPrefix: 'ยาที่ใช้อยู่',
    complaintSeparator: '; ',
    listSeparator: ', ',
    testsPrefix: 'การตรวจ:',
    imagingLabel: 'ภาพถ่ายรังสี',
    tbTestLabel: 'การตรวจ TB',
    notFilled: 'ยังไม่กรอก',
    tbContactFallback: 'ประวัติสัมผัสวัณโรค',
    sputumDoneLabel: 'ตรวจแล้ว',
    sputumNotDoneLabel: 'ยังไม่ตรวจ',
    tbResultLabels: { positive: 'ผลบวก', negative: 'ผลลบ', unknown: 'ไม่ทราบ' },
  },
  id: {
    requiredDonePrefix: 'Wajib terisi',
    validationRequiredPrefix: 'Harap lengkapi kolom wajib terlebih dahulu: ',
    symptomPrefix: 'Gejala',
    coughDurationPrefix: 'Durasi batuk',
    otherSymptomsPrefix: 'Gejala tambahan',
    medicationsPrefix: 'Obat saat ini',
    complaintSeparator: '; ',
    listSeparator: ', ',
    testsPrefix: 'Pemeriksaan:',
    imagingLabel: 'Pencitraan',
    tbTestLabel: 'Tes TB',
    notFilled: 'Belum diisi',
    tbContactFallback: 'Riwayat kontak TB',
    sputumDoneLabel: 'Sudah dilakukan',
    sputumNotDoneLabel: 'Belum dilakukan',
    tbResultLabels: { positive: 'Positif', negative: 'Negatif', unknown: 'Tidak diketahui' },
  },
  ms: {
    requiredDonePrefix: 'Wajib siap',
    validationRequiredPrefix: 'Sila lengkapkan medan wajib dahulu: ',
    symptomPrefix: 'Gejala',
    coughDurationPrefix: 'Tempoh batuk',
    otherSymptomsPrefix: 'Gejala tambahan',
    medicationsPrefix: 'Ubat semasa',
    complaintSeparator: '; ',
    listSeparator: ', ',
    testsPrefix: 'Pemeriksaan:',
    imagingLabel: 'Imej',
    tbTestLabel: 'Ujian TB',
    notFilled: 'Belum diisi',
    tbContactFallback: 'Sejarah kontak TB',
    sputumDoneLabel: 'Sudah dibuat',
    sputumNotDoneLabel: 'Belum dibuat',
    tbResultLabels: { positive: 'Positif', negative: 'Negatif', unknown: 'Tidak pasti' },
  },
};

function pickLocaleText(map: LocaleText | undefined, locale: AppLocale, fallback: string) {
  if (!map) return fallback;
  return map[locale] || map.en || fallback;
}

function localizeOptionLabel(fieldName: string, option: FormOption, locale: AppLocale) {
  if (typeof option.value === 'boolean') {
    return option.value ? booleanOptionLocaleMap[locale].trueLabel : booleanOptionLocaleMap[locale].falseLabel;
  }

  const valueMap = optionValueLocaleMap[fieldName]?.[String(option.value)];
  return pickLocaleText(valueMap, locale, option.label);
}

function localizeSchema(schema: FormSchema, locale: AppLocale): FormSchema {
  return {
    ...schema,
    formTitle: pickLocaleText(formTitleLocaleMap, locale, schema.formTitle),
    submitText: pickLocaleText(submitTextLocaleMap, locale, schema.submitText),
    sections: schema.sections.map((section) => ({
      ...section,
      title: pickLocaleText(sectionTitleLocaleMap[section.title], locale, section.title),
      fields: section.fields.map((field) => ({
        ...field,
        label: pickLocaleText(fieldLabelLocaleMap[field.name], locale, field.label),
        placeholder: field.placeholder
          ? pickLocaleText(fieldPlaceholderLocaleMap[field.name], locale, field.placeholder)
          : field.placeholder,
        options: field.options?.map((option) => ({
          ...option,
          label: localizeOptionLabel(field.name, option, locale),
        })),
      })),
    })),
  };
}

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

function mapTbResultLabel(rawValue: string, uiLocale: OnboardingUiLocale) {
  if (rawValue === 'positive') return uiLocale.tbResultLabels.positive;
  if (rawValue === 'negative') return uiLocale.tbResultLabels.negative;
  if (rawValue === 'unknown') return uiLocale.tbResultLabels.unknown;
  return null;
}

export function PatientOnboarding() {
  const { locale, tr } = useI18n();
  const { addPatientFromSupabase } = useDataContext();
  const uiLocale = onboardingUiLocaleMap[locale];
  const localizedSchema = useMemo(() => localizeSchema(tbFormSchema, locale), [locale]);

  const allFields = useMemo(() => localizedSchema.sections.flatMap((section) => section.fields), [localizedSchema]);
  const fieldMap = useMemo(() => new Map(allFields.map((field) => [field.name, field])), [allFields]);
  const requiredFields = useMemo(() => allFields.filter((field) => field.required), [allFields]);

  const [formValues, setFormValues] = useState<FormValues>(() => buildInitialValues(localizedSchema));
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
    if (symptoms.length > 0) chunks.push(`${uiLocale.symptomPrefix}: ${symptoms.join(uiLocale.listSeparator)}`);

    const coughDurationLabel = getOptionLabel('cough_duration', formValues.cough_duration);
    if (coughDurationLabel) chunks.push(`${uiLocale.coughDurationPrefix}: ${coughDurationLabel}`);

    const otherSymptoms = getString('other_symptoms');
    if (otherSymptoms) chunks.push(`${uiLocale.otherSymptomsPrefix}: ${otherSymptoms}`);

    const medications = getString('current_medications');
    if (medications) chunks.push(`${uiLocale.medicationsPrefix}: ${medications}`);

    return chunks.join(uiLocale.complaintSeparator);
  };

  const handleSubmit = async () => {
    setValidationError('');

    const missingFields = allFields.filter((field) => fieldRequiredMissing(field, formValues[field.name]));
    if (missingFields.length > 0) {
      const missingText = missingFields
        .slice(0, 5)
        .map((field) => field.label)
        .join(uiLocale.listSeparator);
      setValidationError(`${uiLocale.validationRequiredPrefix}${missingText}`);
      return;
    }

    setSubmitState({ status: 'submitting' });

    const patientCode = `GX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const tbTestRaw = getString('tb_test_result');
    const mappedTbResult = mapTbResultLabel(tbTestRaw, uiLocale);
    const sputumTestResult = getBoolean('has_sputum_test')
      ? mappedTbResult || uiLocale.sputumDoneLabel
      : uiLocale.sputumNotDoneLabel;
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
    setFormValues(buildInitialValues(localizedSchema));
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
    ...(getString('tb_contact_history') === 'yes'
      ? [fieldMap.get('tb_contact_history')?.label || uiLocale.tbContactFallback]
      : []),
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
            <span>{localizedSchema.formTitle || tr('个人健康档案')}</span>
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
            {localizedSchema.sections.map((section, sectionIndex) => {
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
                        {uiLocale.requiredDonePrefix} {completedInSection}/{requiredInSection.length || 0}
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
                  {submitState.status === 'submitting' ? tr('提交中...') : localizedSchema.submitText || tr('创建档案')}
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
                    {uiLocale.testsPrefix} {uiLocale.imagingLabel}{' '}
                    {getOptionLabel('chest_imaging_result', formValues.chest_imaging_result) || uiLocale.notFilled} / {uiLocale.tbTestLabel}{' '}
                    {getOptionLabel('tb_test_result', formValues.tb_test_result) || uiLocale.notFilled}
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
