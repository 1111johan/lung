import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { JSX } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Clock4,
  FileText,
  Home,
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

const navItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'enroll', label: '个人健康档案', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'qa', label: '智能问答', icon: <ClipboardList className="h-4 w-4 rotate-90" /> },
  { id: 'hospitalMap', label: '智慧地图', icon: <MapPin className="h-4 w-4" /> },
  { id: 'dashboard', label: '风险自测', icon: <Home className="h-4 w-4" /> },
  { id: 'workstation', label: '智能筛查', icon: <Layers className="h-4 w-4" /> },
  { id: 'reports', label: '报告中心', icon: <FileText className="h-4 w-4" /> },
  { id: 'referrals', label: '转诊与上报', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'followup', label: '随访管理', icon: <Clock4 className="h-4 w-4" /> },
  { id: 'research', label: '统计与分析', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'audit', label: '系统与审计', icon: <Shield className="h-4 w-4" /> },
];

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
    medication: string;
    schedule: string;
    nextAt: string;
    status: ReminderState;
  }

  interface AutoTaskItem {
    id: string;
    patientId: string;
    title: string;
    dueAt: string;
    priority: RiskLevel;
    status: AutoTaskStatus;
    source: string;
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
        medication: '异烟肼+利福平',
        schedule: '每日 08:00',
        nextAt: dueAtFromNow(0),
        status: 'pending' as ReminderState,
      },
      {
        id: `MR-${patient.id}-${index}-PM`,
        patientId: patient.id,
        medication: '乙胺丁醇',
        schedule: '每日 20:00',
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
            medication: '异烟肼+利福平',
            schedule: '每日 08:00',
            nextAt: dueAtFromNow(0),
            status: 'pending' as ReminderState,
          },
          {
            id: `MR-${patient.id}-${index}-PM`,
            patientId: patient.id,
            medication: '乙胺丁醇',
            schedule: '每日 20:00',
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
      const dedupKey = `${task.patientId}-${task.title}-${task.dueAt}`;
      const exists = prev.some((item) => `${item.patientId}-${item.title}-${item.dueAt}` === dedupKey);
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
        title: '48小时内电话复评（高危）',
        dueAt: dueAtFromNow(2),
        priority: 'high',
        status: 'pending',
        source: '症状追踪触发',
      });
    } else if (level === 'medium') {
      tasks.push({
        id: `AT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId: log.patientId,
        title: '7天内症状复核（中危）',
        dueAt: dueAtFromNow(7),
        priority: 'medium',
        status: 'pending',
        source: '症状追踪触发',
      });
    }

    if (log.adherence === 'poor') {
      tasks.push({
        id: `AT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId: log.patientId,
        title: '24小时内用药依从性干预',
        dueAt: dueAtFromNow(1),
        priority: 'high',
        status: 'pending',
        source: '用药提醒触发',
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
    if (risk === 'high') return 'bg-red-900 text-red-200';
    if (risk === 'medium') return 'bg-amber-900 text-amber-200';
    return 'bg-emerald-900 text-emerald-200';
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
          <div className="text-sm text-gray-200">院外症状追踪上报</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="text-gray-400 col-span-2">患者</label>
            <select
              className={uiStyles.input.default + ' col-span-2'}
              value={symptomDraft.patientId}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, patientId: e.target.value }))}
            >
              <option value="">请选择患者</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.id}）
                </option>
              ))}
            </select>

            <label className="text-gray-400">咳嗽程度</label>
            <label className="text-gray-400">发热程度</label>
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

            <label className="text-gray-400">乏力程度</label>
            <label className="text-gray-400">用药依从性</label>
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
              <option value="good">良好</option>
              <option value="partial">一般</option>
              <option value="poor">较差</option>
            </select>
            <textarea
              className={uiStyles.input.textarea + ' col-span-2 min-h-[70px]'}
              placeholder="补充说明（选填）"
              value={symptomDraft.note}
              onChange={(e) => setSymptomDraft((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <button className={uiStyles.button.primary + ' w-full'} onClick={submitSymptomLog}>
            提交症状追踪
          </button>
          <div className="text-[11px] text-gray-500">
            评分说明：症状 0-3 分，依从性差会触发风险加权。
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">药提醒（院外）</div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {medicationReminders.map((item) => (
              <div key={item.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                <div className="text-gray-200 font-semibold">{item.medication}</div>
                <div className="text-gray-400">{getPatientName(item.patientId)} · {item.schedule}</div>
                <div className="text-gray-500">下次提醒：{item.nextAt}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`px-2 py-0.5 rounded ${
                    item.status === 'pending'
                      ? 'bg-amber-900 text-amber-200'
                      : item.status === 'done'
                        ? 'bg-emerald-900 text-emerald-200'
                        : 'bg-red-900 text-red-200'
                  }`}>
                    {item.status === 'pending' ? '待提醒' : item.status === 'done' ? '已完成' : '漏服'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className={uiStyles.button.outline + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateReminderStatus(item.id, 'done')}
                    >
                      完成
                    </button>
                    <button
                      className={uiStyles.button.secondary + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateReminderStatus(item.id, 'missed')}
                    >
                      漏服
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="text-sm text-gray-200">医护端：自动风险分层 & 精准随访任务</div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {latestRiskRows.length === 0 ? (
              <div className="text-xs text-gray-500">暂无院外上报数据</div>
            ) : (
              latestRiskRows.map((row) => (
                <div key={row.patientId + row.recordedAt} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-gray-200">{row.patientName}</div>
                    <span className={`px-2 py-0.5 rounded ${riskBadgeClass(row.level)}`}>
                      {row.level === 'high' ? '高危' : row.level === 'medium' ? '中危' : '低危'}
                    </span>
                  </div>
                  <div className="text-gray-400 mt-1">风险分：{Math.round(row.score * 100)}% · 依从性：{row.adherence}</div>
                  <div className="text-gray-500">{row.recordedAt}</div>
                </div>
              ))
            )}
          </div>
          <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
            自动任务（待处理）：{pendingAutoTasks.length}
          </div>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {pendingAutoTasks.length === 0 ? (
              <div className="text-xs text-gray-500">暂无自动任务</div>
            ) : (
              pendingAutoTasks.map((task) => (
                <div key={task.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 text-xs">
                  <div className="text-gray-200">{task.title}</div>
                  <div className="text-gray-400">{getPatientName(task.patientId)} · 到期 {task.dueAt}</div>
                  <div className="text-gray-500">{task.source}</div>
                  <div className="mt-1">
                    <button
                      className={uiStyles.button.primary + ' text-[11px] px-2 py-0.5'}
                      onClick={() => updateAutoTaskStatus(task.id, 'done')}
                    >
                      标记已处理
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
        <div className="p-3 text-xs text-gray-400 border-b border-gray-700">院内随访任务</div>
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

  const openHospitalMap = (payload?: NearbyHospitalsMapPayload) => {
    if (payload) {
      saveNearbyHospitalsPayload(payload);
    }
    setActivePage('hospitalMap');
  };

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
      setActivePage((prev) => (prev === 'hospitalMap' ? 'enroll' : prev));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
      case 'hospitalMap':
        return <NearbyHospitalsMapPage onBack={() => setActivePage('dashboard')} />;
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={(page, _filter) => setActivePage(page)}
            onOpenHospitalMap={() => openHospitalMap()}
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
  }, [activePage, selectedAnalysis, selectedImage, selectedPatient]);

  return (
    <DataProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-[rgb(var(--bg))] text-gray-100">
        <Header />

        <div className="nav-bar px-4">
          <div className="flex gap-2 overflow-x-auto py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm border transition-colors ${
                  activePage === item.id
                    ? 'bg-[rgb(var(--card))] border-teal-600 text-teal-200'
                    : 'bg-[rgb(var(--bg))] border-[rgb(var(--border))] text-gray-400 hover:text-gray-200 hover:bg-[rgb(var(--card))]'
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






