import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PatientWithAnalysis } from './database.types';
import { fetchPatientsWithAnalysis } from './supabaseService';

export type ReportStatus = 'draft' | 'finalized' | 'reported';
export type ReferralStatus = 'pending' | 'generated' | 'submitted';
export type FollowupStatus = 'pending' | 'overdue' | 'done';

export interface ReportEntry {
  id: string;
  patientId: string;
  status: ReportStatus;
  type: 'screening' | 'referral';
  updatedAt: string;
  qaNote?: string;
  content?: string;
}

export interface ReferralEntry {
  id: string;
  patientId: string;
  status: ReferralStatus;
  missingFields: string[];
  updatedAt: string;
}

export interface FollowupEntry {
  id: string;
  patientId: string;
  title: string;
  dueAt: string;
  status: FollowupStatus;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  time: string;
}

interface DataContextValue {
  patients: PatientWithAnalysis[];
  reports: ReportEntry[];
  referrals: ReferralEntry[];
  followups: FollowupEntry[];
  auditLogs: AuditEntry[];
  loadingSupabase: boolean;
  reloadFromSupabase: () => Promise<void>;
  addPatientFromSupabase: (patient: PatientWithAnalysis) => void;
  removePatient: (patientId: string) => void;
  saveReportDraft: (patientId: string, content: string) => void;
  rejectForRetake: (patientId: string) => void;
  confirmPositive: (patientId: string) => void;
  updateReferralStatus: (id: string, status: ReferralStatus) => void;
  updateFollowupStatus: (id: string, status: FollowupStatus) => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

// 简易时间格式
function nowText() {
  return new Date().toLocaleString();
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dueAtFromToday(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDateOnly(date);
}

// 初始 mock 数据（可替换为接口数据）
const initialPatients: PatientWithAnalysis[] = [
  {
    id: 'p1',
    patient_code: 'GXMU-001',
    name: '覃强',
    gender: 'male',
    age: 45,
    region: '百色',
    contact_phone: '135****1123',
    tb_history: true,
    ppd_test_result: 'strong_positive',
    sputum_test_result: 'pending',
    chief_complaint: '咳嗽2周',
    created_at: nowText(),
    medical_images: [
      {
        id: 'img1',
        patient_id: 'p1',
        image_type: 'CT',
        image_url: '/dicom-case.jpg',
        acquisition_date: '2024-12-28T09:00:00Z',
        modality: 'CT',
        series_description: 'Chest CT',
        status: 'reviewing',
        created_at: nowText(),
        ai_analyses: [
          {
            id: 'a1',
            image_id: 'img1',
            patient_id: 'p1',
            risk_score: 0.82,
            risk_level: 'high',
            tb_probability: 88,
            active_tb_likelihood: '高度疑似活动期',
            findings: [],
            reasoning_chain: [
              { text: '上肺野异常伴周围浸润' },
              { text: 'TB 概率 88%，建议痰检+隔离评估' },
            ],
            differential_diagnosis: [
              { condition: '结核性病灶', score: 0.82, next_tests: ['痰涂片', '培养', 'IGRA'] },
              { condition: '真菌感染', score: 0.34, next_tests: ['GM/BDG'] },
            ],
            model_version: 'GX-TB-v4.2',
            analysis_timestamp: nowText(),
            created_at: nowText(),
          },
        ],
      },
    ],
    risk_score: 0.82,
    risk_level: 'high',
  },
  {
    id: 'p2',
    patient_code: 'GXMU-002',
    name: '韦丽',
    gender: 'female',
    age: 38,
    region: '南宁',
    contact_phone: '139****8899',
    tb_history: false,
    ppd_test_result: 'weak_positive',
    sputum_test_result: 'negative',
    chief_complaint: '低热盗汗',
    created_at: nowText(),
    medical_images: [
      {
        id: 'img2',
        patient_id: 'p2',
        image_type: 'X-ray',
        image_url: null,
        acquisition_date: '2024-12-27T10:00:00Z',
        modality: 'DR',
        series_description: 'CXR PA',
        status: 'reviewing',
        created_at: nowText(),
        ai_analyses: [
          {
            id: 'a2',
            image_id: 'img2',
            patient_id: 'p2',
            risk_score: 0.42,
            risk_level: 'medium',
            tb_probability: 55,
            active_tb_likelihood: '疑似活动期',
            findings: [
              { location: '右中肺', type: '条索影', confidence: 0.6, slice_range: '—' },
            ],
            reasoning_chain: [{ text: '右中肺轻度条索影，需结合临床' }],
            differential_diagnosis: [
              { condition: '疑似 TB', score: 0.55, next_tests: ['IGRA'] },
              { condition: '炎症后纤维化', score: 0.2, next_tests: [] },
            ],
            model_version: 'GX-TB-v4.2',
            analysis_timestamp: nowText(),
            created_at: nowText(),
          },
        ],
      },
    ],
    risk_score: 0.42,
    risk_level: 'medium',
  },
  {
    id: 'p3',
    patient_code: 'GXMU-003',
    name: '黄文',
    gender: 'male',
    age: 50,
    region: '玉林',
    contact_phone: '136****6677',
    tb_history: false,
    ppd_test_result: 'negative',
    sputum_test_result: 'pending',
    chief_complaint: '体检发现异常',
    created_at: nowText(),
    medical_images: [
      {
        id: 'img3',
        patient_id: 'p3',
        image_type: 'CT',
        image_url: null,
        acquisition_date: '2024-12-25T11:30:00Z',
        modality: 'CT',
        series_description: 'Chest CT',
        status: 'pending',
        created_at: nowText(),
        ai_analyses: [
          {
            id: 'a3',
            image_id: 'img3',
            patient_id: 'p3',
            risk_score: 0.18,
            risk_level: 'low',
            tb_probability: 20,
            active_tb_likelihood: '未见明显活动',
            findings: [],
            reasoning_chain: [{ text: '未见明显异常，建议随访观察' }],
            differential_diagnosis: [{ condition: '正常/非特异性', score: 0.2, next_tests: [] }],
            model_version: 'GX-TB-v4.2',
            analysis_timestamp: nowText(),
            created_at: nowText(),
          },
        ],
      },
    ],
    risk_score: 0.18,
    risk_level: 'low',
  },
];

const demoCase = initialPatients[0];

const mergeDemoCase = (list: PatientWithAnalysis[]) => {
  const filtered = list.filter((p) => p.id !== demoCase.id);
  return [demoCase, ...filtered];
};

const initialReports: ReportEntry[] = [
  { id: 'R-001', patientId: 'p1', status: 'draft', type: 'screening', updatedAt: nowText(), qaNote: '缺少病灶大小' },
  { id: 'R-002', patientId: 'p2', status: 'finalized', type: 'screening', updatedAt: nowText(), qaNote: '通过' },
  { id: 'R-003', patientId: 'p3', status: 'draft', type: 'screening', updatedAt: nowText(), qaNote: '退回重拍：体位不佳' },
];

const initialReferrals: ReferralEntry[] = [
  { id: 'REF-001', patientId: 'p1', status: 'pending', missingFields: ['联系电话'], updatedAt: nowText() },
];

const initialFollowups: FollowupEntry[] = [
  { id: 'FU-001', patientId: 'p1', title: '2周电话随访', dueAt: dueAtFromToday(14), status: 'pending' },
  { id: 'FU-002', patientId: 'p1', title: '1个月痰培养回传', dueAt: dueAtFromToday(-7), status: 'overdue' },
  { id: 'FU-003', patientId: 'p2', title: '3个月影像复查', dueAt: dueAtFromToday(90), status: 'pending' },
];

const initialAudit: AuditEntry[] = [
  { id: createId('audit'), actor: 'rad_A', action: '生成草稿', target: 'R-001', detail: '模型 GX-TB-v4.2 阈值0.75', time: nowText() },
  { id: createId('audit'), actor: 'rad_A', action: '确认阳性', target: '患者 p1', detail: '触发转诊/随访', time: nowText() },
  { id: createId('audit'), actor: 'nurse_B', action: '创建随访', target: 'FU-001/FU-002', detail: '2周/1月节点', time: nowText() },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientWithAnalysis[]>(initialPatients);
  const [reports, setReports] = useState<ReportEntry[]>(initialReports);
  const [referrals, setReferrals] = useState<ReferralEntry[]>(initialReferrals);
  const [followups, setFollowups] = useState<FollowupEntry[]>(initialFollowups);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>(initialAudit);
  const [loadingSupabase, setLoadingSupabase] = useState(false);

  const reloadFromSupabase = useCallback(async () => {
    setLoadingSupabase(true);
    try {
      const remotePatients = await fetchPatientsWithAnalysis();
      if (remotePatients?.length) {
        setPatients(mergeDemoCase(remotePatients));
      }
    } catch (err) {
      console.warn('Supabase load failed, falling back to mock data', err);
    } finally {
      setLoadingSupabase(false);
    }
  }, []);

  useEffect(() => {
    reloadFromSupabase();
  }, [reloadFromSupabase]);

  const addPatientFromSupabase = useCallback((patient: PatientWithAnalysis) => {
    setPatients((prev) => {
      const filtered = prev.filter((p) => p.id !== patient.id && p.id !== demoCase.id);
      return [demoCase, patient, ...filtered];
    });
  }, []);

  const appendAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'time'>) => {
    setAuditLogs((prev) => [
      { id: createId('audit'), time: nowText(), ...entry },
      ...prev,
    ]);
  }, []);

  const removePatient = useCallback(
    (patientId: string) => {
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      setReports((prev) => prev.filter((r) => r.patientId !== patientId));
      setReferrals((prev) => prev.filter((r) => r.patientId !== patientId));
      setFollowups((prev) => prev.filter((f) => f.patientId !== patientId));
      appendAudit({ actor: 'system', action: '删除患者', target: patientId, detail: '待筛查删除' });
    },
    [appendAudit]
  );

  const saveReportDraft = useCallback(
    (patientId: string, content: string) => {
      let updated: ReportEntry | undefined;
      setReports((prev) => {
        const existing = prev.find((r) => r.patientId === patientId);
        updated = existing
          ? { ...existing, status: 'draft', updatedAt: nowText(), content }
          : { id: createId('R'), patientId, status: 'draft', type: 'screening', updatedAt: nowText(), content };
        const others = prev.filter((r) => r.id !== (updated as ReportEntry).id);
        return [updated as ReportEntry, ...others];
      });
      appendAudit({ actor: 'rad_A', action: '保存草稿', target: (updated as ReportEntry).id, detail: '报告草稿已更新' });
    },
    [appendAudit]
  );

  const rejectForRetake = useCallback(
    (patientId: string) => {
      let targetId = patientId;
      setReports((prev) => {
        const existing = prev.find((r) => r.patientId === patientId);
        if (existing) {
          targetId = existing.id;
          return prev.map((r) =>
            r.id === existing.id
              ? { ...r, status: 'draft', qaNote: '退回重拍：影像需重拍', updatedAt: nowText() }
              : r
          );
        }
        const created: ReportEntry = {
          id: createId('R'),
          patientId,
          status: 'draft',
          type: 'screening',
          qaNote: '退回重拍：影像需重拍',
          updatedAt: nowText(),
        };
        targetId = created.id;
        return [created, ...prev];
      });
      appendAudit({ actor: 'rad_A', action: '驳回重拍', target: targetId, detail: '影像需重拍' });
    },
    [appendAudit]
  );

  const confirmPositive = useCallback(
    (patientId: string) => {
      let reportId = '';
      setReports((prev) => {
        const existing = prev.find((r) => r.patientId === patientId);
        const updated: ReportEntry = existing
          ? { ...existing, status: 'finalized', qaNote: existing.qaNote || '待上报', updatedAt: nowText() }
          : { id: createId('R'), patientId, status: 'finalized', type: 'screening', qaNote: '待上报', updatedAt: nowText() };
        reportId = updated.id;
        const others = prev.filter((r) => r.id !== updated.id);
        return [updated, ...others];
      });

      const referral: ReferralEntry = {
        id: createId('REF'),
        patientId,
        status: 'pending',
        missingFields: ['联系电话'],
        updatedAt: nowText(),
      };
      setReferrals((prev) => [referral, ...prev]);

      const fu1: FollowupEntry = {
        id: createId('FU'),
        patientId,
        title: '2周电话随访',
        dueAt: dueAtFromToday(14),
        status: 'pending',
      };
      const fu2: FollowupEntry = {
        id: createId('FU'),
        patientId,
        title: '1个月痰培养回传',
        dueAt: dueAtFromToday(30),
        status: 'pending',
      };
      setFollowups((prev) => [fu1, fu2, ...prev]);

      appendAudit({ actor: 'rad_A', action: '确认阳性', target: reportId || patientId, detail: '生成转诊/随访' });
    },
    [appendAudit]
  );

  const updateReferralStatus = useCallback(
    (id: string, status: ReferralStatus) => {
      setReferrals((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, missingFields: status === 'submitted' ? [] : r.missingFields, updatedAt: nowText() } : r))
      );
      appendAudit({ actor: 'nurse_B', action: '更新转诊', target: id, detail: status });
    },
    [appendAudit]
  );

  const updateFollowupStatus = useCallback(
    (id: string, status: FollowupStatus) => {
      setFollowups((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
      appendAudit({ actor: 'nurse_B', action: '更新随访', target: id, detail: status });
    },
    [appendAudit]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      patients,
      reports,
      referrals,
      followups,
      auditLogs,
      loadingSupabase,
      reloadFromSupabase,
      addPatientFromSupabase,
      removePatient,
      saveReportDraft,
      rejectForRetake,
      confirmPositive,
      updateReferralStatus,
      updateFollowupStatus,
    }),
    [
      patients,
      reports,
      referrals,
      followups,
      auditLogs,
      loadingSupabase,
      reloadFromSupabase,
      addPatientFromSupabase,
      removePatient,
      saveReportDraft,
      rejectForRetake,
      confirmPositive,
      updateReferralStatus,
      updateFollowupStatus,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataContext must be used within DataProvider');
  return ctx;
}
