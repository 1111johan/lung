import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { JSX } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Clock4,
  FileText,
  Layers,
  MapPin,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Header } from './components/Header';
import { PatientQueue } from './components/PatientQueue';
import { ImageViewer } from './components/ImageViewer';
import { AIAnalysisPanel } from './components/AIAnalysisPanel';
import type { PatientWithAnalysis, MedicalImage, AIAnalysis } from './lib/database.types';
import { uiStyles, getRiskStyles } from './lib/theme';
import { DataProvider, useDataContext } from './lib/dataContext';
import { PatientOnboarding } from './components/PatientOnboarding';
import { PatientQA } from './components/PatientQA';
import { NearbyHospitalsCard } from './components/NearbyHospitalsCard';
import { NearbyHospitalsMapPage } from './components/NearbyHospitalsMapPage';
import { saveNearbyHospitalsPayload, type NearbyHospitalsMapPayload } from './lib/nearbyHospitalsState';
import type { PageId } from './lib/pageTypes';
import { useI18n } from './lib/i18n';

const HOSPITAL_MAP_PATH = '/nearby-hospitals/map';

type PortalId = 'patient' | 'clinician' | 'assistant';

const patientNavItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'enroll', label: '个人健康档案', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'hospitalMap', label: '智慧地图', icon: <MapPin className="h-4 w-4" /> },
  { id: 'patientCare', label: '康复管理', icon: <Activity className="h-4 w-4" /> },
];

const assistantNavItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'qa', label: '智能问答', icon: <ClipboardList className="h-4 w-4 rotate-90" /> },
];

const clinicianNavItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'clinicianOverview', label: '医护总览', icon: <Users className="h-4 w-4" /> },
  { id: 'workstation', label: '智能筛查', icon: <Layers className="h-4 w-4" /> },
  { id: 'reports', label: '报告中心', icon: <FileText className="h-4 w-4" /> },
  { id: 'referrals', label: '转诊与上报', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'followup', label: '随访管理', icon: <Clock4 className="h-4 w-4" /> },
  { id: 'research', label: '统计与分析', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'audit', label: '系统与审计', icon: <Shield className="h-4 w-4" /> },
];

const clinicianPages = new Set<PageId>(['clinicianOverview', 'dashboard', 'workstation', 'reports', 'referrals', 'followup', 'research', 'audit']);

const defaultPortalPage: Record<PortalId, PageId> = {
  patient: 'enroll',
  clinician: 'clinicianOverview',
  assistant: 'qa',
};

function getPortalFromPage(page: PageId): PortalId {
  if (page === 'qa') return 'assistant';
  return clinicianPages.has(page) ? 'clinician' : 'patient';
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dueAtFromNow(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDateOnly(date);
}

function DashboardPage({
  onNavigate,
  onOpenHospitalMap,
}: {
  onNavigate: (page: PageId, filter?: Record<string, string>) => void;
  onOpenHospitalMap: () => void;
}) {
  const { tr } = useI18n();
  const { patients, followups, reports } = useDataContext();
  const highRisk = patients.filter((p) => p.risk_level === 'high').length;
  const overdue = followups.filter((f) => f.status === 'overdue').length;
  const positiveToday = reports.filter((r) => r.status === 'finalized' || r.status === 'reported').length;
  const lowRisk = patients.filter((p) => p.risk_level === 'low').length;
  const mediumRisk = patients.filter((p) => p.risk_level === 'medium').length;

  const trend = useMemo(() => {
    // 近 8 周趋势占位数据，可替换为真实接口
    return [
      { label: 'W-7', suspect: 6, positive: 2, cleared: 3 },
      { label: 'W-6', suspect: 8, positive: 2, cleared: 4 },
      { label: 'W-5', suspect: 10, positive: 3, cleared: 5 },
      { label: 'W-4', suspect: 12, positive: 4, cleared: 6 },
      { label: 'W-3', suspect: 11, positive: 3, cleared: 7 },
      { label: 'W-2', suspect: 14, positive: 5, cleared: 6 },
      { label: 'W-1', suspect: 15, positive: 6, cleared: 8 },
      { label: tr('本周'), suspect: 13, positive: 5, cleared: 7 },
    ];
  }, [tr]);

  const topRisk = [...patients]
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 5);
  const upcomingFollowups = [...followups]
    .filter((f) => f.status !== 'done')
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const latestReports = [...reports]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const tasks: {
    title: string;
    count: number;
    action: string;
    page: PageId;
    filter?: Record<string, string>;
  }[] = [
    {
      title: tr('待审核影像'),
      count: patients.filter((p) => p.medical_images?.some((m) => m.status === 'reviewing')).length,
      action: tr('转到阅片'),
      page: 'workstation' as PageId,
      filter: { status: 'reviewing' },
    },
    {
      title: tr('待补全信息'),
      count: patients.filter((p) => !p.contact_phone || !p.region).length,
      action: tr('完善建档'),
      page: 'enroll' as PageId,
      filter: { missing: 'contact' },
    },
    {
      title: tr('待随访'),
      count: followups.filter((f) => f.status === 'pending').length,
      action: tr('安排回访'),
      page: 'followup' as PageId,
      filter: { status: 'pending' },
    },
    {
      title: tr('待上报/签署'),
      count: reports.filter((r) => r.status === 'finalized').length,
      action: tr('前往报告'),
      page: 'reports' as PageId,
      filter: { status: 'finalized' },
    },
  ];

  const drillTo = (page: PageId, filter?: Record<string, string>) => {
    const sanitized = filter
      ? Object.fromEntries(
          Object.entries(filter).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        )
      : undefined;
    onNavigate(page, sanitized);
  };

  const kpiCards = [
    {
      label: tr('待筛查'),
      value: patients.length.toString(),
      accent: 'bg-blue-600',
      trend: tr('+8% 较上周'),
      hint: tr('待筛查=已登记但未完成影像/报告'),
      onClick: () => drillTo('workstation'),
    },
    {
      label: tr('高危病例'),
      value: highRisk.toString(),
      accent: 'bg-red-600',
      trend: tr('+2 较昨日'),
      hint: tr('高危=AI 风险≥0.7 或医生标记'),
      onClick: () => drillTo('workstation', { risk: 'high' }),
    },
    {
      label: tr('逾期随访'),
      value: overdue.toString(),
      accent: 'bg-amber-500',
      trend: tr('-1 较昨日'),
      hint: tr('逾期=随访 dueAt < 今天且未完成'),
      onClick: () => drillTo('followup'),
    },
    {
      label: tr('阳性确认/签署'),
      value: positiveToday.toString(),
      accent: 'bg-teal-500',
      trend: tr('+1 今日新增'),
      hint: tr('含已定稿与已上报报告数量'),
      onClick: () => drillTo('reports'),
    },
  ];

  const explainRisk = (p: PatientWithAnalysis) => {
    const analysis = p.medical_images?.[0]?.ai_analyses?.[0];
    const tags: string[] = [];
    if (p.chief_complaint) tags.push(p.chief_complaint);
    if (p.tb_history) tags.push(tr('既往结核'));
    if (p.ppd_test_result?.includes('positive')) tags.push('PPD+');
    if (analysis?.tb_probability && analysis.tb_probability >= 70) tags.push(tr('AI高概率'));
    return tags.slice(0, 2);
  };

  const explainExam = (p: PatientWithAnalysis) => {
    const img = p.medical_images?.[0];
    if (!img) return tr('影像未上传');
    if (img.status === 'reviewed' || img.status === 'reported') return tr('影像已审核');
    if (img.status === 'reviewing') return tr('影像待审核');
    return tr('影像已上传');
  };

  const sortedFollowups = [...upcomingFollowups].sort((a, b) => {
    const da = new Date(a.dueAt).getTime();
    const db = new Date(b.dueAt).getTime();
    const now = Date.now();
    const diffA = da - now;
    const diffB = db - now;
    const overdueA = diffA < 0;
    const overdueB = diffB < 0;
    if (overdueA !== overdueB) return overdueA ? -1 : 1;
    return diffA - diffB;
  });

  const daysDelta = (date: string) => {
    const diff = Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${tr('逾期')} ${Math.abs(diff)} ${tr('天')}`;
    if (diff === 0) return tr('今日到期');
    return `${tr('剩余')} ${diff} ${tr('天')}`;
  };
  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="grid grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className="aurora-card glass-card-hover p-3 text-left hover:border-teal-600 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-2">{card.label}</span>
              <span title={card.hint} className="text-[11px] text-gray-500 cursor-help">
                ℹ︎
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className={`h-8 w-1 rounded ${card.accent}`}></div>
              <div className="text-sm text-gray-200">{tr('点击查看')}</div>
            </div>
            <div className="mt-2 text-[11px] text-teal-200">{card.trend}</div>
            <div className="text-[11px] text-gray-500 mt-1">{tr('更新于')} {formatDate(new Date().toISOString())}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <NearbyHospitalsCard onOpenMap={onOpenHospitalMap} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            {tr('高危患者')} Top5
          </div>
          <div className="space-y-2">
            {topRisk.map((p) => {
              const risk = getRiskStyles(p.risk_level || 'low');
              const tags = explainRisk(p);
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 text-xs bg-[rgb(var(--bg))] rounded px-2 py-2 border border-[rgb(var(--border))] hover:border-teal-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-gray-200 font-semibold">
                      {p.name} <span className="text-gray-500">({p.age}{tr('岁')})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-200">{Math.round((p.risk_score || 0) * 100)}%</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] ${risk.color.badge} ${risk.color.badgeText}`}>{tr(risk.label)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-[rgb(var(--card))] rounded text-[11px] text-gray-200">
                        {t}
                      </span>
                    ))}
                    {tags.length === 0 && <span className="text-gray-500">{tr('暂无症状/风险标签')}</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 flex justify-between items-center">
                    <span>{explainExam(p)}</span>
                    <button
                      onClick={() => drillTo('workstation')}
                      className="px-2 py-0.5 rounded border border-teal-600 text-teal-200 hover:bg-teal-900/40"
                    >
                      {tr('复核影像')}
                    </button>
                  </div>
                </div>
              );
            })}
            {topRisk.length === 0 && <div className="text-gray-500 text-xs">{tr('暂无高危患者')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Clock4 className="h-4 w-4 text-amber-400" />
            {tr('随访提醒')}
          </div>
          <div className="space-y-2">
            {sortedFollowups.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs bg-[rgb(var(--bg))] rounded px-2 py-1 border border-[rgb(var(--border))]">
                <div className="text-gray-200">{f.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{daysDelta(f.dueAt)}</span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      f.status === 'overdue'
                        ? 'bg-red-900 text-red-200'
                        : f.status === 'pending'
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-emerald-900 text-emerald-200'
                    }`}
                  >
                    {f.status === 'overdue' ? tr('逾期') : f.status === 'pending' ? tr('待随访') : tr('已完成')}
                  </span>
                  <button
                    onClick={() => drillTo('followup')}
                    className="text-[11px] px-2 py-0.5 rounded border border-teal-600 text-teal-200 hover:bg-teal-900/40 transition-colors"
                  >
                    {tr('处理')}
                  </button>
                </div>
              </div>
            ))}
            {sortedFollowups.length === 0 && <div className="text-gray-500 text-xs">{tr('暂无待随访任务')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Activity className="h-4 w-4 text-emerald-400" />
            {tr('最新报告')}
          </div>
          <div className="space-y-2">
            {latestReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-[rgb(var(--bg))] rounded px-2 py-1 border border-[rgb(var(--border))]">
                <div className="text-gray-200 flex items-center gap-2">
                  <span className="font-mono text-blue-300">{r.id}</span>
                  <span className="text-gray-400">{formatDate(r.updatedAt)}</span>
                  <span className="text-gray-500">· Dr. Zhang ({tr('最近操作')})</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded ${
                    r.status === 'finalized'
                      ? 'bg-amber-900 text-amber-200'
                      : r.status === 'reported'
                      ? 'bg-emerald-900 text-emerald-200'
                      : 'bg-[rgb(var(--card))] text-gray-300'
                  }`}
                >
                  {r.status === 'finalized' ? tr('已定稿') : r.status === 'reported' ? tr('已上报') : tr('草稿')}
                </span>
              </div>
            ))}
            {latestReports.length === 0 && <div className="text-gray-500 text-xs">{tr('暂无报告')}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 aurora-card glass-card-hover p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-200 text-sm">
              <Activity className="h-4 w-4 text-teal-400" />
              {tr('近 8 周趋势（疑似 / 阳性 / 排除）')}
            </div>
            <span className="text-[11px] text-gray-500">{tr('可替换为 7/30/90 天')}</span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {trend.map((p) => (
              <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded p-1 flex flex-col gap-1">
                  <div className="h-2.5 bg-amber-500 rounded" style={{ width: `${Math.min(p.suspect * 5, 100)}%` }}></div>
                  <div className="h-2.5 bg-red-500 rounded" style={{ width: `${Math.min(p.positive * 8, 100)}%` }}></div>
                  <div className="h-2.5 bg-emerald-500 rounded" style={{ width: `${Math.min(p.cleared * 5, 100)}%` }}></div>
                </div>
                <span className="text-[10px] text-gray-500">{p.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 text-[11px] text-gray-400 mt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-amber-500 inline-block rounded"></span>{tr('疑似')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-500 inline-block rounded"></span>{tr('阳性')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-emerald-500 inline-block rounded"></span>{tr('排除/复查')}</span>
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <ClipboardList className="h-4 w-4 text-blue-400" />
            {tr('今日待办')}
          </div>
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.title} className="flex items-center justify-between text-xs bg-[rgb(var(--bg))] rounded px-2 py-2 border border-[rgb(var(--border))] hover:border-teal-600 transition-colors">
                <div className="text-gray-200">{t.title}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => drillTo(t.page, t.filter)}
                    className="text-[11px] px-2 py-0.5 rounded border border-teal-600 text-teal-200 hover:bg-teal-900/40 transition-colors"
                  >
                    {t.action}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-200 text-sm">
              <Shield className="h-4 w-4 text-rose-400" />
              {tr('风险分层分布')}
            </div>
            <div className="space-y-1 text-[11px] text-gray-300">
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">{tr('高危')}</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-red-500" style={{ width: `${patients.length ? (highRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-red-200">{highRisk} {tr('人')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">{tr('中危')}</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-amber-500" style={{ width: `${patients.length ? (mediumRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-amber-200">{mediumRisk} {tr('人')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">{tr('低危')}</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-emerald-500" style={{ width: `${patients.length ? (lowRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-emerald-200">{lowRisk} {tr('人')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const { tr } = useI18n();
  const { reports, patients } = useDataContext();
  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.name || id;
  const statusLabel = (status: string) => {
    if (status === 'finalized') return tr('已定稿');
    if (status === 'reported') return tr('已上报');
    return tr('草稿');
  };
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <FileText className="h-4 w-4 text-blue-400" />
          {tr('报告中心')}
        </div>
        <span className="text-[11px] text-gray-500">{tr('QA：必填校验 / 所见-印象一致性提示')}</span>
      </div>

      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
        {reports.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-[rgb(var(--bg))] text-gray-200 font-mono text-xs">{row.id}</span>
              <div>
                <div className="text-gray-100">{getPatientName(row.patientId)}</div>
                <div className="text-gray-500 text-xs">{row.updatedAt}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-300">{row.type === 'screening' ? tr('筛查') : tr('转诊')}</span>
              <span className={`px-2 py-1 rounded ${
                row.status === 'finalized' ? 'bg-amber-900 text-amber-200' :
                row.status === 'reported' ? 'bg-emerald-900 text-emerald-200' :
                'bg-gray-800 text-gray-300'
              }`}>{statusLabel(row.status)}</span>
              <span className="text-amber-300">{row.qaNote || tr('—')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferralsPage() {
  const { tr } = useI18n();
  const { referrals, patients, updateReferralStatus } = useDataContext();
  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.name || id;
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          {tr('转诊与上报')}
        </div>
        <span className="text-[11px] text-gray-500">{tr('必填字段校验，生成通知书/转诊单')}</span>
      </div>
      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
        {referrals.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-[rgb(var(--bg))] text-gray-200 font-mono text-xs">{row.id}</span>
              <div className="text-gray-100">{getPatientName(row.patientId)}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-1 rounded ${
                row.status === 'pending' ? 'bg-amber-900 text-amber-200' :
                row.status === 'generated' ? 'bg-blue-900 text-blue-200' :
                'bg-emerald-900 text-emerald-200'
              }`}>{row.status}</span>
              <span className={row.missingFields.length === 0 ? 'text-gray-400' : 'text-red-300'}>
                {tr('缺失')}: {row.missingFields.join('、') || tr('—')}
              </span>
              <span className="text-gray-500">{row.updatedAt}</span>
              <div className="flex gap-1">
                <button onClick={() => updateReferralStatus(row.id, 'generated')} className={uiStyles.button.outline + ' text-[11px] px-2 py-1'}>
                  {tr('生成通知书')}
                </button>
                <button onClick={() => updateReferralStatus(row.id, 'submitted')} className={uiStyles.button.primary + ' text-[11px] px-2 py-1'}>
                  {tr('提交上报')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowupPage() {
  const { tr } = useI18n();
  const { followups, patients, updateFollowupStatus } = useDataContext();
  const getPatientName = useCallback(
    (id: string) => patients.find((p) => p.id === id)?.name || id,
    [patients]
  );

  type AdherenceLevel = 'good' | 'partial' | 'poor';
  type ReminderState = 'pending' | 'done' | 'missed';
  type AutoTaskStatus = 'pending' | 'done';
  type RiskLevel = 'high' | 'medium' | 'low';

  interface SymptomLogEntry {
    id: string;
    patientId: string;
    recordedAt: string;
    cough: number;
    fever: number;
    fatigue: number;
    adherence: AdherenceLevel;
    note: string;
  }

  interface MedicationReminderItem {
    id: string;
    patientId: string;
    medicationKey: string;
    scheduleKey: string;
    nextAt: string;
    status: ReminderState;
  }

  interface AutoTaskItem {
    id: string;
    patientId: string;
    titleKey: string;
    dueAt: string;
    priority: RiskLevel;
    status: AutoTaskStatus;
    sourceKey: string;
  }

  const [symptomDraft, setSymptomDraft] = useState<{
    patientId: string;
    cough: number;
    fever: number;
    fatigue: number;
    adherence: AdherenceLevel;
    note: string;
  }>({
    patientId: '',
    cough: 0,
    fever: 0,
    fatigue: 0,
    adherence: 'good',
    note: '',
  });

  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);

  const [medicationReminders, setMedicationReminders] = useState<MedicationReminderItem[]>(() =>
    patients.slice(0, 3).flatMap((patient, index) => [
      {
        id: `MR-${patient.id}-${index}-AM`,
        patientId: patient.id,
        medicationKey: '异烟肼+利福平',
        scheduleKey: '每日 08:00',
        nextAt: dueAtFromNow(0),
        status: 'pending' as ReminderState,
      },
      {
        id: `MR-${patient.id}-${index}-PM`,
        patientId: patient.id,
        medicationKey: '乙胺丁醇',
        scheduleKey: '每日 20:00',
        nextAt: dueAtFromNow(0),
        status: 'pending' as ReminderState,
      },
    ])
  );
  const [autoTasks, setAutoTasks] = useState<AutoTaskItem[]>([]);

  useEffect(() => {
    if (!symptomDraft.patientId && patients[0]?.id) {
      setSymptomDraft((prev) => ({ ...prev, patientId: patients[0].id }));
    }
  }, [patients, symptomDraft.patientId]);

  useEffect(() => {
    if (medicationReminders.length === 0 && patients.length > 0) {
      setMedicationReminders(
        patients.slice(0, 3).flatMap((patient, index) => [
          {
            id: `MR-${patient.id}-${index}-AM`,
            patientId: patient.id,
            medicationKey: '异烟肼+利福平',
            scheduleKey: '每日 08:00',
            nextAt: dueAtFromNow(0),
            status: 'pending' as ReminderState,
          },
          {
            id: `MR-${patient.id}-${index}-PM`,
            patientId: patient.id,
            medicationKey: '乙胺丁醇',
            scheduleKey: '每日 20:00',
            nextAt: dueAtFromNow(0),
            status: 'pending' as ReminderState,
          },
        ])
      );
    }
  }, [medicationReminders.length, patients]);

  const calcRiskFromSymptomLog = useCallback((log: SymptomLogEntry) => {
    const symptomScore = (log.cough + log.fever + log.fatigue) / 9;
    const adherencePenalty = log.adherence === 'poor' ? 0.35 : log.adherence === 'partial' ? 0.18 : 0;
    const score = Math.min(1, symptomScore * 0.7 + adherencePenalty);
    const level: RiskLevel = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    return { score, level };
  }, []);

  const latestRiskRows = useMemo(() => {
    const latestLogByPatient = new Map<string, SymptomLogEntry>();
    symptomLogs.forEach((item) => {
      if (!latestLogByPatient.has(item.patientId)) {
        latestLogByPatient.set(item.patientId, item);
      }
    });

    return Array.from(latestLogByPatient.values()).map((log) => {
      const risk = calcRiskFromSymptomLog(log);
      return {
        patientId: log.patientId,
        patientName: getPatientName(log.patientId),
        recordedAt: log.recordedAt,
        adherence: log.adherence,
        score: risk.score,
        level: risk.level,
      };
    });
  }, [symptomLogs, calcRiskFromSymptomLog, getPatientName]);

  const upsertAutoTask = (task: AutoTaskItem) => {
    setAutoTasks((prev) => {
      const dedupKey = `${task.patientId}-${task.titleKey}-${task.dueAt}`;
      const exists = prev.some((item) => `${item.patientId}-${item.titleKey}-${item.dueAt}` === dedupKey);
      if (exists) return prev;
      return [task, ...prev].slice(0, 100);
    });
  };

  const createAutoTasksFromLog = (log: SymptomLogEntry) => {
    const { level } = calcRiskFromSymptomLog(log);
    const tasks: AutoTaskItem[] = [];

    if (level === 'high') {
      tasks.push({
        id: `AT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId: log.patientId,
        titleKey: '48小时内电话复评（高危）',
        dueAt: dueAtFromNow(2),
        priority: 'high',
        status: 'pending',
        sourceKey: '症状追踪触发',
      });
    } else if (level === 'medium') {
      tasks.push({
        id: `AT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId: log.patientId,
        titleKey: '7天内症状复核（中危）',
        dueAt: dueAtFromNow(7),
        priority: 'medium',
        status: 'pending',
        sourceKey: '症状追踪触发',
      });
    }

    if (log.adherence === 'poor') {
      tasks.push({
        id: `AT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId: log.patientId,
        titleKey: '24小时内用药依从性干预',
        dueAt: dueAtFromNow(1),
        priority: 'high',
        status: 'pending',
        sourceKey: '用药提醒触发',
      });
    }

    tasks.forEach(upsertAutoTask);
  };

  const submitSymptomLog = () => {
    if (!symptomDraft.patientId) return;
    const entry: SymptomLogEntry = {
      id: `SYM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      patientId: symptomDraft.patientId,
      recordedAt: new Date().toLocaleString(),
      cough: symptomDraft.cough,
      fever: symptomDraft.fever,
      fatigue: symptomDraft.fatigue,
      adherence: symptomDraft.adherence,
      note: symptomDraft.note.trim(),
    };
    setSymptomLogs((prev) => [entry, ...prev].slice(0, 100));
    createAutoTasksFromLog(entry);
    setSymptomDraft((prev) => ({ ...prev, cough: 0, fever: 0, fatigue: 0, adherence: 'good', note: '' }));
  };

  const updateReminderStatus = (id: string, status: ReminderState) => {
    setMedicationReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              nextAt: status === 'done' ? dueAtFromNow(1) : item.nextAt,
            }
          : item
      )
    );
  };

  const updateAutoTaskStatus = (id: string, status: AutoTaskStatus) => {
    setAutoTasks((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const riskBadgeClass = (risk: RiskLevel) => {
    if (risk === 'high') return 'border border-red-700 bg-red-600 text-white';
    if (risk === 'medium') return 'border border-amber-600 bg-amber-400 text-slate-900';
    return 'border border-emerald-700 bg-emerald-600 text-white';
  };

  const getAdherenceLabel = (adherence: AdherenceLevel) => {
    if (adherence === 'good') return tr('良好');
    if (adherence === 'partial') return tr('一般');
    return tr('较差');
  };

  const getReminderStatusLabel = (status: ReminderState) => {
    if (status === 'pending') return tr('待提醒');
    if (status === 'done') return tr('已完成');
    return tr('漏服');
  };

  const symptomOptions = [0, 1, 2, 3];
  const pendingAutoTasks = autoTasks.filter((task) => task.status === 'pending');

  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <Clock4 className="h-4 w-4 text-amber-400" />
          {tr('随访管理')}
        </div>
        <span className="text-[11px] text-gray-500">{tr('节点：2周 / 1月 / 3月；逾期自动提醒')}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="text-sm text-gray-200">{tr('院外症状追踪上报')}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="text-gray-400 col-span-2">{tr('患者')}</label>
            <select
              className={uiStyles.input.default + ' col-span-2'}
              value={symptomDraft.patientId}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, patientId: e.target.value }))}
            >
              <option value="">{tr('请选择患者')}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.id}）
                </option>
              ))}
            </select>

            <label className="text-gray-400">{tr('咳嗽程度')}</label>
            <label className="text-gray-400">{tr('发热程度')}</label>
            <select
              className={uiStyles.input.default}
              value={symptomDraft.cough}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, cough: Number(e.target.value) }))}
            >
              {symptomOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className={uiStyles.input.default}
              value={symptomDraft.fever}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, fever: Number(e.target.value) }))}
            >
              {symptomOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <label className="text-gray-400">{tr('乏力程度')}</label>
            <label className="text-gray-400">{tr('用药依从性')}</label>
            <select
              className={uiStyles.input.default}
              value={symptomDraft.fatigue}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, fatigue: Number(e.target.value) }))}
            >
              {symptomOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className={uiStyles.input.default}
              value={symptomDraft.adherence}
              onChange={(e) =>
                setSymptomDraft((prev) => ({ ...prev, adherence: e.target.value as AdherenceLevel }))
              }
            >
              <option value="good">{tr('良好')}</option>
              <option value="partial">{tr('一般')}</option>
              <option value="poor">{tr('较差')}</option>
            </select>
            <textarea
              className={uiStyles.input.textarea + ' col-span-2 min-h-[70px]'}
              placeholder={tr('补充说明（选填）')}
              value={symptomDraft.note}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <button className={uiStyles.button.primary + ' w-full'} onClick={submitSymptomLog}>
            {tr('提交症状追踪')}
          </button>
          <div className="text-[11px] text-gray-500">
            {tr('评分说明：症状 0-3 分，依从性差会触发风险加权。')}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">{tr('药提醒（院外）')}</div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {medicationReminders.map((item) => (
              <div key={item.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                <div className="text-gray-200 font-semibold">{tr(item.medicationKey)}</div>
                <div className="text-gray-400">{getPatientName(item.patientId)} · {tr(item.scheduleKey)}</div>
                <div className="text-gray-500">{tr('下次提醒：')}{item.nextAt}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`px-2 py-0.5 rounded ${
                    item.status === 'pending'
                      ? 'bg-amber-900 text-amber-200'
                      : item.status === 'done'
                        ? 'bg-emerald-900 text-emerald-200'
                        : 'bg-red-900 text-red-200'
                  }`}>
                    {getReminderStatusLabel(item.status)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className={uiStyles.button.outline + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateReminderStatus(item.id, 'done')}
                    >
                      {tr('完成')}
                    </button>
                    <button
                      className={uiStyles.button.secondary + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateReminderStatus(item.id, 'missed')}
                    >
                      {tr('漏服')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">{tr('医护端：自动风险分层 & 精准随访任务')}</div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {latestRiskRows.length === 0 ? (
              <div className="text-xs text-gray-500">{tr('暂无院外上报数据')}</div>
            ) : (
              latestRiskRows.map((row) => (
                <div key={row.patientId + row.recordedAt} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-gray-200">{row.patientName}</div>
                    <span className={`px-2 py-0.5 rounded ${riskBadgeClass(row.level)}`}>
                      {row.level === 'high' ? tr('高危') : row.level === 'medium' ? tr('中危') : tr('低危')}
                    </span>
                  </div>
                  <div className="text-gray-400 mt-1">
                    {tr('风险分：')}{Math.round(row.score * 100)}% · {tr('依从性：')}{getAdherenceLabel(row.adherence)}
                  </div>
                  <div className="text-gray-500">{row.recordedAt}</div>
                </div>
              ))
            )}
          </div>
          <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
            {tr('自动任务（待处理）：')}{pendingAutoTasks.length}
          </div>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {pendingAutoTasks.length === 0 ? (
              <div className="text-xs text-gray-500">{tr('暂无自动任务')}</div>
            ) : (
              pendingAutoTasks.map((task) => (
                <div key={task.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                  <div className="text-gray-200">{tr(task.titleKey)}</div>
                  <div className="text-gray-400">{getPatientName(task.patientId)} · {tr('到期')} {task.dueAt}</div>
                  <div className="text-gray-500">{tr(task.sourceKey)}</div>
                  <div className="mt-1">
                    <button
                      className={uiStyles.button.primary + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateAutoTaskStatus(task.id, 'done')}
                    >
                      {tr('标记已处理')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
        <div className="p-3 text-xs text-gray-400 border-b border-gray-700">{tr('院内随访任务')}</div>
        {followups.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-[rgb(var(--bg))] text-gray-200 font-mono text-xs">{row.id}</span>
              <div className="text-gray-100">{row.title}</div>
              <div className="text-gray-500 text-xs">{getPatientName(row.patientId)}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400">{row.dueAt}</span>
              <span className={`px-2 py-1 rounded ${
                row.status === 'overdue' ? 'bg-red-900 text-red-200' :
                row.status === 'pending' ? 'bg-amber-900 text-amber-200' :
                'bg-emerald-900 text-emerald-200'
              }`}>{row.status === 'overdue' ? tr('逾期') : row.status === 'pending' ? tr('待随访') : tr('已完成')}</span>
              <div className="flex gap-1">
                <button onClick={() => updateFollowupStatus(row.id, 'done')} className={uiStyles.button.primary + ' text-[11px] px-2 py-1'}>
                  {tr('完成')}
                </button>
                <button onClick={() => updateFollowupStatus(row.id, 'overdue')} className={uiStyles.button.secondary + ' text-[11px] px-2 py-1'}>
                  {tr('标记逾期')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientCarePage() {
  const { tr } = useI18n();
  const { patients } = useDataContext();

  type ReminderState = 'pending' | 'done' | 'missed';
  interface MedicationReminderItem {
    id: string;
    patientId: string;
    medicationKey: string;
    scheduleKey: string;
    nextAt: string;
    status: ReminderState;
  }

  interface SymptomLogEntry {
    id: string;
    patientId: string;
    recordedAt: string;
    cough: number;
    fever: number;
    fatigue: number;
    sleep: number;
    appetite: number;
    note: string;
  }

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [tipText, setTipText] = useState('');

  const [reminders, setReminders] = useState<MedicationReminderItem[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  const [symptomDraft, setSymptomDraft] = useState({
    cough: 0,
    fever: 0,
    fatigue: 0,
    sleep: 0,
    appetite: 0,
    note: '',
  });

  useEffect(() => {
    if (!selectedPatientId && patients[0]?.id) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  useEffect(() => {
    if (patients.length === 0 || reminders.length > 0) return;
    setReminders(
      patients.slice(0, 3).flatMap((patient, index) => [
        {
          id: `PMR-${patient.id}-${index}-AM`,
          patientId: patient.id,
          medicationKey: '异烟肼+利福平',
          scheduleKey: '每日 08:00',
          nextAt: dueAtFromNow(0),
          status: 'pending' as ReminderState,
        },
        {
          id: `PMR-${patient.id}-${index}-PM`,
          patientId: patient.id,
          medicationKey: '乙胺丁醇',
          scheduleKey: '每日 20:00',
          nextAt: dueAtFromNow(0),
          status: 'pending' as ReminderState,
        },
      ])
    );
  }, [patients, reminders.length]);

  const currentPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );
  const currentReminders = useMemo(
    () => reminders.filter((item) => item.patientId === selectedPatientId),
    [reminders, selectedPatientId]
  );
  const currentSymptomLogs = useMemo(
    () => symptomLogs.filter((item) => item.patientId === selectedPatientId),
    [selectedPatientId, symptomLogs]
  );
  const latestLog = currentSymptomLogs[0] || null;

  const getReminderStatusLabel = (status: ReminderState) => {
    if (status === 'pending') return tr('待提醒');
    if (status === 'done') return tr('已完成');
    return tr('漏服');
  };

  const updateReminderStatus = (id: string, status: ReminderState) => {
    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              nextAt: status === 'done' ? dueAtFromNow(1) : item.nextAt,
            }
          : item
      )
    );
  };

  const symptomScale = [0, 1, 2, 3];

  const submitSymptomLog = () => {
    if (!selectedPatientId) return;
    const log: SymptomLogEntry = {
      id: `PS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      patientId: selectedPatientId,
      recordedAt: new Date().toLocaleString(),
      cough: symptomDraft.cough,
      fever: symptomDraft.fever,
      fatigue: symptomDraft.fatigue,
      sleep: symptomDraft.sleep,
      appetite: symptomDraft.appetite,
      note: symptomDraft.note.trim(),
    };
    setSymptomLogs((prev) => [log, ...prev].slice(0, 100));
    setSymptomDraft({ cough: 0, fever: 0, fatigue: 0, sleep: 0, appetite: 0, note: '' });
  };

  const recoveryScore = useMemo(() => {
    if (!latestLog) return 0;
    const burden = latestLog.cough + latestLog.fever + latestLog.fatigue + latestLog.sleep + latestLog.appetite;
    const normalized = Math.min(1, burden / 15);
    return Math.round(normalized * 100);
  }, [latestLog]);

  const recoveryLevel = recoveryScore >= 67 ? tr('重度') : recoveryScore >= 34 ? tr('中度') : tr('轻度');
  const recoveryAdvice =
    recoveryScore >= 67
      ? tr('建议立即联系医生或前往线下复诊。')
      : recoveryScore >= 34
        ? tr('建议保持规范服药并在 48 小时内复查症状。')
        : tr('当前状态稳定，请继续康复训练与规律作息。');

  const generatePlan = () => {
    setTipText(tr('已生成，请按建议执行并记录症状变化。'));
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <Activity className="h-4 w-4 text-blue-400" />
          {tr('康复管理')}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{tr('当前患者')}</span>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className={uiStyles.input.default + ' min-w-[220px]'}
          >
            <option value="">{tr('请选择患者')}</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}（{patient.patient_code}）
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">{tr('服药提醒')}</div>
          <div className="text-xs text-gray-500">{tr('今日用药计划')}</div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {currentReminders.map((item) => (
              <div key={item.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                <div className="text-gray-200 font-semibold">{tr(item.medicationKey)}</div>
                <div className="text-gray-400">{tr(item.scheduleKey)}</div>
                <div className="text-gray-500">{tr('下次提醒：')}{item.nextAt}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded ${
                    item.status === 'pending'
                      ? 'bg-amber-900 text-amber-200'
                      : item.status === 'done'
                        ? 'bg-emerald-900 text-emerald-200'
                        : 'bg-red-900 text-red-200'
                  }`}>
                    {getReminderStatusLabel(item.status)}
                  </span>
                  <div className="flex gap-1">
                    <button className={uiStyles.button.outline + ' text-[11px] px-2 py-0.5'} onClick={() => updateReminderStatus(item.id, 'done')}>
                      {tr('完成')}
                    </button>
                    <button className={uiStyles.button.secondary + ' text-[11px] px-2 py-0.5'} onClick={() => updateReminderStatus(item.id, 'missed')}>
                      {tr('漏服')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {currentReminders.length === 0 && <div className="text-xs text-gray-500">{tr('暂无自动任务')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">{tr('症状追踪')}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="text-gray-400">{tr('咳嗽程度')}</label>
            <label className="text-gray-400">{tr('发热程度')}</label>
            <select className={uiStyles.input.default} value={symptomDraft.cough} onChange={(e) => setSymptomDraft((prev) => ({ ...prev, cough: Number(e.target.value) }))}>
              {symptomScale.map((value) => (
                <option key={`c-${value}`} value={value}>{value}</option>
              ))}
            </select>
            <select className={uiStyles.input.default} value={symptomDraft.fever} onChange={(e) => setSymptomDraft((prev) => ({ ...prev, fever: Number(e.target.value) }))}>
              {symptomScale.map((value) => (
                <option key={`f-${value}`} value={value}>{value}</option>
              ))}
            </select>

            <label className="text-gray-400">{tr('乏力程度')}</label>
            <label className="text-gray-400">{tr('睡眠质量')}</label>
            <select className={uiStyles.input.default} value={symptomDraft.fatigue} onChange={(e) => setSymptomDraft((prev) => ({ ...prev, fatigue: Number(e.target.value) }))}>
              {symptomScale.map((value) => (
                <option key={`fa-${value}`} value={value}>{value}</option>
              ))}
            </select>
            <select className={uiStyles.input.default} value={symptomDraft.sleep} onChange={(e) => setSymptomDraft((prev) => ({ ...prev, sleep: Number(e.target.value) }))}>
              {symptomScale.map((value) => (
                <option key={`s-${value}`} value={value}>{value}</option>
              ))}
            </select>

            <label className="text-gray-400">{tr('食欲情况')}</label>
            <span />
            <select className={uiStyles.input.default} value={symptomDraft.appetite} onChange={(e) => setSymptomDraft((prev) => ({ ...prev, appetite: Number(e.target.value) }))}>
              {symptomScale.map((value) => (
                <option key={`a-${value}`} value={value}>{value}</option>
              ))}
            </select>
            <span />

            <textarea
              className={uiStyles.input.textarea + ' col-span-2 min-h-[78px]'}
              placeholder={tr('补充说明（选填）')}
              value={symptomDraft.note}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <button className={uiStyles.button.primary + ' w-full'} onClick={submitSymptomLog}>
            {tr('提交今日症状')}
          </button>
          <div className="text-xs text-gray-400">{tr('最近记录')}</div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {currentSymptomLogs.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-[11px] text-gray-300">
                {item.recordedAt} · {tr('症状评分')} {item.cough + item.fever + item.fatigue + item.sleep + item.appetite}
              </div>
            ))}
            {currentSymptomLogs.length === 0 && <div className="text-[11px] text-gray-500">{tr('暂无院外上报数据')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="text-sm text-gray-200">{tr('康复指导')}</div>
          <div className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3">
            <div className="text-xs text-gray-400">{tr('当前恢复等级')}</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-lg text-gray-100">{recoveryLevel}</div>
              <div className="text-sm text-cyan-300">{tr('症状评分')} {recoveryScore}%</div>
            </div>
            <div className="mt-2 text-xs text-gray-300">{recoveryAdvice}</div>
          </div>

          <div className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-xs text-gray-300 space-y-2">
            <div>{tr('呼吸训练：每日 2 次，每次 10 分钟。')}</div>
            <div>{tr('步行训练：每日 20-30 分钟，避免过度疲劳。')}</div>
            <div>{tr('营养建议：优先高蛋白、足量饮水。')}</div>
            <div>{tr('作息建议：保证 7-8 小时睡眠。')}</div>
          </div>
          <button className={uiStyles.button.secondary + ' w-full'} onClick={generatePlan}>
            {tr('生成今日康复建议')}
          </button>
          {tipText && <div className="text-xs text-emerald-300">{tipText}</div>}
          {!currentPatient && <div className="text-xs text-gray-500">{tr('请选择患者')}</div>}
        </div>
      </div>
    </div>
  );
}

function ResearchPage() {
  const { tr } = useI18n();
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Stethoscope className="h-4 w-4 text-teal-400" />
        {tr('统计与分析（脱敏导出/病例库）')}
      </div>
      <div className="aurora-card glass-card-hover p-3 text-sm space-y-3">
        <div className="text-gray-300">{tr('队列构建：地区 / 征象 / 检验 / 随访齐全')}</div>
        <div className="flex gap-2">
          <input className={uiStyles.input.default + ' flex-1'} placeholder={tr('示例：百色 + 高危 + 结节')} />
          <button className={uiStyles.button.primary}>{tr('生成队列')}</button>
        </div>
        <div className="flex gap-2">
          <button className={uiStyles.button.secondary}>{tr('导出脱敏 JSON')}</button>
          <button className={uiStyles.button.secondary}>{tr('导出 ROI/Mask')}</button>
        </div>
      </div>
      <div className="aurora-card glass-card-hover p-3 text-sm">
        <div className="text-gray-200 mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-300" />
          {tr('典型病例库（示例）')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['结节', '树芽征', '钙化'].map((tag) => (
            <div key={tag} className="bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded p-2 text-gray-300 text-xs">
              {tr(tag)} • {tr('3 例占位')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPage() {
  const { tr } = useI18n();
  const { auditLogs } = useDataContext();
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Shield className="h-4 w-4 text-emerald-400" />
        {tr('系统与审计')}
      </div>
      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
        {auditLogs.map((row) => (
          <div key={row.id} className="p-3 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-gray-200">{row.actor}</span>
              <span className="text-gray-400">{row.action}</span>
              <span className="text-gray-200">{row.target}</span>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>{row.detail}</span>
              <span>{row.time}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="aurora-card glass-card-hover p-3 text-xs text-gray-300">
        {tr('当前模型：GX-TB-v4.2 • 阈值 0.75 • 角色：影像科/呼吸感染科/公卫护士（MVP）')}
      </div>
    </div>
  );
}

function ClinicianOverviewPage({
  onNavigate,
  onSelectPatient,
  selectedPatient,
  selectedAnalysis,
}: {
  onNavigate: (page: PageId) => void;
  onSelectPatient: (patient: PatientWithAnalysis | null) => void;
  selectedPatient: PatientWithAnalysis | null;
  selectedAnalysis: AIAnalysis | null;
}) {
  const { tr } = useI18n();
  const { patients, followups, reports, referrals } = useDataContext();

  const rankedPatients = useMemo(
    () =>
      [...patients].sort((a, b) => {
        const riskDelta = (b.risk_score || 0) - (a.risk_score || 0);
        if (riskDelta !== 0) return riskDelta;
        return b.created_at.localeCompare(a.created_at);
      }),
    [patients]
  );

  useEffect(() => {
    if (!selectedPatient && rankedPatients[0]) {
      onSelectPatient(rankedPatients[0]);
    }
  }, [onSelectPatient, rankedPatients, selectedPatient]);

  const highRiskPatients = rankedPatients.filter((patient) => patient.risk_level === 'high');
  const overdueFollowups = followups.filter((item) => item.status === 'overdue');
  const pendingReports = reports.filter((item) => item.status === 'finalized');
  const pendingReferrals = referrals.filter((item) => item.status === 'pending');

  const riskRows = rankedPatients.slice(0, 6).map((patient) => ({
    id: patient.id,
    name: patient.name,
    code: patient.patient_code,
    riskLevel: patient.risk_level || 'low',
    riskScore: Math.round((patient.risk_score || 0) * 100),
    region: patient.region || tr('广西'),
    complaint: patient.chief_complaint || tr('暂无症状/风险标签'),
  }));

  const alertRows = useMemo(() => {
    const alerts: { id: string; title: string; detail: string; severity: 'high' | 'medium' | 'low'; page: PageId }[] = [];

    highRiskPatients.slice(0, 3).forEach((patient) => {
      alerts.push({
        id: `risk-${patient.id}`,
        title: tr('高危优先处理'),
        detail: `${patient.name} · ${tr('结核概率')} ${Math.round((patient.risk_score || 0) * 100)}%`,
        severity: 'high',
        page: 'workstation',
      });
    });

    overdueFollowups.slice(0, 2).forEach((item) => {
      alerts.push({
        id: `followup-${item.id}`,
        title: tr('逾期任务'),
        detail: `${item.title} · ${item.dueAt}`,
        severity: 'medium',
        page: 'followup',
      });
    });

    pendingReports.slice(0, 2).forEach((item) => {
      alerts.push({
        id: `report-${item.id}`,
        title: tr('待上报'),
        detail: `${item.id} · ${item.updatedAt}`,
        severity: 'medium',
        page: 'reports',
      });
    });

    pendingReferrals
      .filter((item) => item.missingFields.length > 0)
      .slice(0, 2)
      .forEach((item) => {
        alerts.push({
          id: `referral-${item.id}`,
          title: tr('待补录联系信息'),
          detail: `${item.id} · ${item.missingFields.join('、')}`,
          severity: 'low',
          page: 'referrals',
        });
      });

    return alerts.slice(0, 6);
  }, [highRiskPatients, overdueFollowups, pendingReferrals, pendingReports, tr]);

  const followupRows = useMemo(
    () =>
      [...followups]
        .sort((a, b) => {
          const orderA = a.status === 'overdue' ? 0 : a.status === 'pending' ? 1 : 2;
          const orderB = b.status === 'overdue' ? 0 : b.status === 'pending' ? 1 : 2;
          if (orderA !== orderB) return orderA - orderB;
          return a.dueAt.localeCompare(b.dueAt);
        })
        .slice(0, 6),
    [followups]
  );

  const selectedFindings = Array.isArray(selectedAnalysis?.findings) ? selectedAnalysis.findings.slice(0, 4) : [];
  const selectedDifferentials = Array.isArray(selectedAnalysis?.differential_diagnosis)
    ? selectedAnalysis.differential_diagnosis.slice(0, 3)
    : [];

  const riskBadgeClass = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'border border-red-700 bg-red-600 text-white';
    if (level === 'medium') return 'border border-amber-600 bg-amber-400 text-slate-900';
    return 'border border-emerald-700 bg-emerald-600 text-white';
  };

  const clinicianCards = [
    { label: tr('高危病例'), value: highRiskPatients.length, hint: tr('待医生确认'), page: 'workstation' as PageId },
    { label: tr('逾期随访'), value: overdueFollowups.length, hint: tr('今日需处理'), page: 'followup' as PageId },
    { label: tr('待上报'), value: pendingReports.length, hint: tr('报告中心'), page: 'reports' as PageId },
    { label: tr('转诊与上报'), value: pendingReferrals.length, hint: tr('预警提示'), page: 'referrals' as PageId },
  ];

  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-4">
      <div className="rounded-3xl border border-[rgb(var(--border))] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.88))] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">{tr('医护端')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{tr('医护总览')}</div>
            <div className="mt-2 max-w-2xl text-sm text-slate-300">
              {tr('集中查看自动分层、预警提示、随访任务与 AI 辅助决策。')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
            {clinicianCards.map((card) => (
              <button
                key={card.label}
                onClick={() => onNavigate(card.page)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10"
              >
                <div className="text-[11px] text-slate-400">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
                <div className="mt-1 text-[11px] text-cyan-200">{card.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="aurora-card glass-card-hover p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-100">
            <BarChart3 className="h-4 w-4 text-cyan-300" />
            {tr('自动风险分层')}
          </div>
          <div className="space-y-2">
            {riskRows.map((row) => (
              <button
                key={row.id}
                onClick={() => {
                  const patient = rankedPatients.find((item) => item.id === row.id) || null;
                  onSelectPatient(patient);
                }}
                className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left transition hover:border-cyan-500/60"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-100">{row.name}</div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${riskBadgeClass(row.riskLevel as 'high' | 'medium' | 'low')}`}>
                    {row.riskLevel === 'high' ? tr('高危') : row.riskLevel === 'medium' ? tr('中危') : tr('低危')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{row.code} · {row.region}</div>
                <div className="mt-2 text-xs text-cyan-200">{tr('风险分：')}{row.riskScore}%</div>
                <div className="mt-1 text-xs text-gray-500">{row.complaint}</div>
              </button>
            ))}
            {riskRows.length === 0 && <div className="text-xs text-gray-500">{tr('暂无高危患者')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-100">
            <Activity className="h-4 w-4 text-amber-300" />
            {tr('预警提示')}
          </div>
          <div className="space-y-2">
            {alertRows.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.page)}
                className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left transition hover:border-amber-500/60"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-100">{item.title}</div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${riskBadgeClass(item.severity)}`}>
                    {item.severity === 'high' ? tr('高危') : item.severity === 'medium' ? tr('中危') : tr('低危')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-400">{item.detail}</div>
              </button>
            ))}
            {alertRows.length === 0 && <div className="text-xs text-gray-500">{tr('暂无自动任务')}</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-100">
            <Clock4 className="h-4 w-4 text-teal-300" />
            {tr('随访任务')}
          </div>
          <div className="space-y-2">
            {followupRows.map((row) => (
              <button
                key={row.id}
                onClick={() => onNavigate('followup')}
                className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left transition hover:border-teal-500/60"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-100">{row.title}</div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${
                    row.status === 'overdue'
                      ? 'bg-red-900 text-red-200'
                      : row.status === 'pending'
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-emerald-900 text-emerald-200'
                  }`}>
                    {row.status === 'overdue' ? tr('逾期') : row.status === 'pending' ? tr('待随访') : tr('已完成')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{row.id} · {row.dueAt}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {patients.find((patient) => patient.id === row.patientId)?.name || row.patientId}
                </div>
              </button>
            ))}
            {followupRows.length === 0 && <div className="text-xs text-gray-500">{tr('暂无待随访任务')}</div>}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <Shield className="h-4 w-4 text-blue-600" />
            {tr('辅助决策界面')}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              onClick={() => onNavigate('workstation')}
            >
              {tr('进入智能筛查')}
            </button>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              onClick={() => onNavigate('reports')}
            >
              {tr('进入报告中心')}
            </button>
          </div>
        </div>

        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 bg-slate-50/60 p-4 lg:border-b-0 lg:border-r">
            <div className="text-xs text-slate-600">{tr('选择患者查看 AI 辅助决策')}</div>
            <div className="mt-3 space-y-2">
              {rankedPatients.slice(0, 8).map((patient) => {
                const active = selectedPatient?.id === patient.id;
                return (
                  <button
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900">{patient.name}</div>
                      <span className={`rounded-full px-2 py-1 text-[11px] ${riskBadgeClass((patient.risk_level || 'low') as 'high' | 'medium' | 'low')}`}>
                        {patient.risk_level === 'high' ? tr('高危') : patient.risk_level === 'medium' ? tr('中危') : tr('低危')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{patient.patient_code}</div>
                    <div className="mt-2 text-xs text-slate-700">{patient.chief_complaint || tr('暂无症状/风险标签')}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 p-4">
            {selectedPatient && selectedAnalysis ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{selectedPatient.name}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {selectedPatient.patient_code} · {selectedPatient.region || tr('广西')} · {selectedPatient.age}{tr('岁')}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${riskBadgeClass((selectedAnalysis.risk_level || 'low') as 'high' | 'medium' | 'low')}`}>
                        {selectedAnalysis.risk_level === 'high' ? tr('高危') : selectedAnalysis.risk_level === 'medium' ? tr('中危') : tr('低危')}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-600">{tr('结核概率')}</div>
                        <div className="mt-2 text-2xl font-semibold text-cyan-700">{selectedAnalysis.tb_probability}%</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-600">{tr('活动性判断')}</div>
                        <div className="mt-2 text-sm text-slate-800">{selectedAnalysis.active_tb_likelihood || tr('待进一步评估')}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-600">{tr('影像状态')}</div>
                        <div className="mt-2 text-sm text-slate-800">
                          {selectedPatient.medical_images?.[0]?.status === 'reviewing'
                            ? tr('影像待审核')
                            : selectedPatient.medical_images?.[0]?.status === 'reviewed' || selectedPatient.medical_images?.[0]?.status === 'reported'
                              ? tr('影像已审核')
                              : tr('影像已上传')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-800">{tr('核心所见')}</div>
                    <div className="mt-3 space-y-2">
                      {selectedFindings.length > 0 ? (
                        selectedFindings.map((item, index) => {
                          const finding = item as Record<string, unknown>;
                          return (
                            <div key={`finding-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                              <div>{String(finding.location || tr('肺野'))} · {String(finding.type || tr('异常'))}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                {String(finding.size || finding.diameter_mm || tr('—'))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-600">{tr('未见结构化所见')}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-800">{tr('鉴别诊断')}</div>
                    <div className="mt-3 space-y-2">
                      {selectedDifferentials.length > 0 ? (
                        selectedDifferentials.map((item, index) => {
                          const differential = item as Record<string, unknown>;
                          const nextTests = Array.isArray(differential.next_tests)
                            ? (differential.next_tests as unknown[]).map((entry) => String(entry)).join('、')
                            : tr('—');
                          return (
                            <div key={`dx-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between text-sm text-slate-800">
                                <span>{String(differential.condition || differential.dx || tr('待进一步评估'))}</span>
                                <span className="font-medium text-cyan-700">{Math.round(Number(differential.score || 0) * 100)}%</span>
                              </div>
                              <div className="mt-2 text-xs text-slate-600">{tr('下一步')}：{nextTests}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-600">{tr('暂无鉴别诊断')}</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-800">{tr('建议动作')}</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">{tr('高危病例需医生确认，提交后自动生成转诊/随访。')}</div>
                      <button className={uiStyles.button.primary + ' w-full'} onClick={() => onNavigate('workstation')}>
                        {tr('进入智能筛查')}
                      </button>
                      <button className={uiStyles.button.secondary + ' w-full'} onClick={() => onNavigate('followup')}>
                        {tr('进入随访管理')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                {tr('系统将基于所选患者显示 AI 风险、所见、鉴别诊断与下一步建议。')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkstationPage({
  onSelectPatient,
  selectedPatient,
  selectedImage,
  selectedAnalysis,
}: {
  onSelectPatient: (p: PatientWithAnalysis | null) => void;
  selectedPatient: PatientWithAnalysis | null;
  selectedImage: MedicalImage | null;
  selectedAnalysis: AIAnalysis | null;
}) {
  const { patients } = useDataContext();

  useEffect(() => {
    if (!selectedPatient && patients.length > 0) {
      onSelectPatient(patients[0]);
    }
  }, [patients, onSelectPatient, selectedPatient]);

  return (
    <main className="workstation-scope flex-1 flex overflow-hidden">
      <PatientQueue
        onSelectPatient={onSelectPatient}
        selectedPatientId={selectedPatient?.id || null}
      />
      <ImageViewer image={selectedImage} analysis={selectedAnalysis} />
      <AIAnalysisPanel analysis={selectedAnalysis} patient={selectedPatient} />
    </main>
  );
}

function App() {
  const { tr } = useI18n();
  const [activePage, setActivePage] = useState<PageId>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === HOSPITAL_MAP_PATH) {
      return 'hospitalMap';
    }
    return 'enroll';
  });
  const [selectedPatient, setSelectedPatient] = useState<PatientWithAnalysis | null>(null);
  const [selectedImage, setSelectedImage] = useState<MedicalImage | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysis | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [portalLastPage, setPortalLastPage] = useState<Record<PortalId, PageId>>({
    patient: defaultPortalPage.patient,
    clinician: defaultPortalPage.clinician,
    assistant: defaultPortalPage.assistant,
  });
  const [mapBackPage, setMapBackPage] = useState<PageId>(defaultPortalPage.patient);

  const activePortal = getPortalFromPage(activePage);

  const handlePageChange = useCallback((page: PageId) => {
    setActivePage(page);
    if (page !== 'hospitalMap') {
      const portal = getPortalFromPage(page);
      setMapBackPage(page);
      setPortalLastPage((prev) => ({ ...prev, [portal]: page }));
    }
  }, []);

  const handlePortalChange = useCallback(
    (portal: PortalId) => {
      const targetPage = portalLastPage[portal] || defaultPortalPage[portal];
      handlePageChange(targetPage);
    },
    [handlePageChange, portalLastPage]
  );

  const openHospitalMap = useCallback(
    (payload?: NearbyHospitalsMapPayload) => {
      if (payload) {
        saveNearbyHospitalsPayload(payload);
      }
      setMapBackPage(activePage);
      setActivePage('hospitalMap');
    },
    [activePage]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [activePage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      if (window.location.pathname === HOSPITAL_MAP_PATH) {
        setActivePage('hospitalMap');
        return;
      }
      setActivePage((prev) => (prev === 'hospitalMap' ? mapBackPage : prev));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [mapBackPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const atMapPath = window.location.pathname === HOSPITAL_MAP_PATH;
    if (activePage === 'hospitalMap' && !atMapPath) {
      window.history.pushState({}, '', HOSPITAL_MAP_PATH);
      return;
    }
    if (activePage !== 'hospitalMap' && atMapPath) {
      window.history.pushState({}, '', '/');
    }
  }, [activePage]);

  const handleSelectPatient = (patient: PatientWithAnalysis | null) => {
    if (!patient) {
      setSelectedPatient(null);
      setSelectedImage(null);
      setSelectedAnalysis(null);
      return;
    }
    setSelectedPatient(patient);
    const firstImage = patient.medical_images?.[0];
    if (firstImage) {
      setSelectedImage(firstImage);
      const firstAnalysis = firstImage.ai_analyses?.[0];
      setSelectedAnalysis(firstAnalysis || null);
    } else {
      setSelectedImage(null);
      setSelectedAnalysis(null);
    }
  };

  const pageContent = useMemo(() => {
    switch (activePage) {
      case 'enroll':
        return <PatientOnboarding />;
      case 'qa':
        return <PatientQA onOpenHospitalMap={openHospitalMap} />;
      case 'patientCare':
        return <PatientCarePage />;
      case 'hospitalMap':
        return <NearbyHospitalsMapPage onBack={() => handlePageChange(mapBackPage)} />;
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={(page, _filter) => handlePageChange(page)}
            onOpenHospitalMap={() => openHospitalMap()}
          />
        );
      case 'clinicianOverview':
        return (
          <ClinicianOverviewPage
            onNavigate={handlePageChange}
            onSelectPatient={handleSelectPatient}
            selectedPatient={selectedPatient}
            selectedAnalysis={selectedAnalysis}
          />
        );
      case 'reports':
        return <ReportsPage />;
      case 'referrals':
        return <ReferralsPage />;
      case 'followup':
        return <FollowupPage />;
      case 'research':
        return <ResearchPage />;
      case 'audit':
        return <AuditPage />;
      case 'workstation':
      default:
        return (
          <WorkstationPage
            onSelectPatient={handleSelectPatient}
            selectedPatient={selectedPatient}
            selectedImage={selectedImage}
            selectedAnalysis={selectedAnalysis}
          />
        );
    }
  }, [activePage, handlePageChange, mapBackPage, openHospitalMap, selectedAnalysis, selectedImage, selectedPatient]);

  const activeNavItems = activePortal === 'patient'
    ? patientNavItems
    : activePortal === 'assistant'
      ? assistantNavItems
      : clinicianNavItems;

  return (
    <DataProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-[rgb(var(--bg))] text-gray-100">
        <Header />

        <div className="nav-bar px-4 pt-3">
          <div className="grid grid-cols-1 gap-2 pb-3 md:grid-cols-3">
            <button
              onClick={() => handlePortalChange('patient')}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                activePortal === 'patient'
                  ? 'border-blue-700 bg-blue-700 text-white shadow-[0_8px_18px_rgba(29,78,216,0.35)]'
                  : 'border-[rgb(var(--border))] bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`text-sm font-semibold ${activePortal === 'patient' ? 'text-white' : 'text-slate-800'}`}>{tr('患者端')}</div>
              <div className={`mt-1 text-xs ${activePortal === 'patient' ? 'text-white/85' : 'text-slate-600'}`}>{tr('建档、康复、智慧地图')}</div>
            </button>
            <button
              onClick={() => handlePortalChange('assistant')}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                activePortal === 'assistant'
                  ? 'border-slate-700 bg-slate-700 text-white shadow-[0_8px_18px_rgba(51,65,85,0.35)]'
                  : 'border-[rgb(var(--border))] bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`text-sm font-semibold ${activePortal === 'assistant' ? 'text-white' : 'text-slate-800'}`}>{tr('智慧问答端')}</div>
              <div className={`mt-1 text-xs ${activePortal === 'assistant' ? 'text-white/85' : 'text-slate-600'}`}>{tr('独立问答入口')}</div>
            </button>
            <button
              onClick={() => handlePortalChange('clinician')}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                activePortal === 'clinician'
                  ? 'border-cyan-800 bg-cyan-800 text-white shadow-[0_8px_18px_rgba(21,94,117,0.35)]'
                  : 'border-[rgb(var(--border))] bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`text-sm font-semibold ${activePortal === 'clinician' ? 'text-white' : 'text-slate-800'}`}>{tr('医护端')}</div>
              <div className={`mt-1 text-xs ${activePortal === 'clinician' ? 'text-white/90' : 'text-slate-600'}`}>{tr('自动分层、预警、随访、辅助决策')}</div>
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto py-2">
            {activeNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handlePageChange(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm border transition-colors ${
                  activePage === item.id
                    ? 'bg-white border-[rgb(var(--accent))] text-[rgb(var(--accent))] shadow-sm'
                    : 'bg-white/70 border-[rgb(var(--border))] text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {item.icon}
                {tr(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div ref={contentRef} className="flex-1 min-h-0 overflow-hidden">{pageContent}</div>
      </div>
    </DataProvider>
  );
}

export default App;






