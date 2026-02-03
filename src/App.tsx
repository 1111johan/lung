import { useMemo, useState, useEffect } from 'react';
import type { JSX } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Clock4,
  FileText,
  Home,
  Layers,
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
import type { PageId } from './lib/pageTypes';

const navItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'enroll', label: '个人健康档案', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'qa', label: '智能问答', icon: <ClipboardList className="h-4 w-4 rotate-90" /> },
  { id: 'dashboard', label: '结核病风险自测', icon: <Home className="h-4 w-4" /> },
  { id: 'workstation', label: '筛查工作台', icon: <Layers className="h-4 w-4" /> },
  { id: 'reports', label: '报告中心', icon: <FileText className="h-4 w-4" /> },
  { id: 'referrals', label: '转诊与上报', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'followup', label: '随访管理', icon: <Clock4 className="h-4 w-4" /> },
  { id: 'research', label: '科研与教学', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'audit', label: '系统与审计', icon: <Shield className="h-4 w-4" /> },
];

function DashboardPage({ onNavigate }: { onNavigate: (page: PageId, filter?: Record<string, string>) => void }) {
  const { patients, followups, reports } = useDataContext();
  const highRisk = patients.filter((p) => p.risk_level === 'high').length;
  const overdue = followups.filter((f) => f.status === 'overdue').length;
  const positiveToday = reports.filter((r) => r.status === 'pending_sign' || r.status === 'signed').length;
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
      { label: '本周', suspect: 13, positive: 5, cleared: 7 },
    ];
  }, []);

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
      title: '待审核影像',
      count: patients.filter((p) => p.medical_images?.some((m) => m.status === 'reviewing')).length,
      action: '转到阅片',
      page: 'workstation' as PageId,
      filter: { status: 'reviewing' },
    },
    {
      title: '待补全信息',
      count: patients.filter((p) => !p.contact_phone || !p.region).length,
      action: '完善建档',
      page: 'enroll' as PageId,
      filter: { missing: 'contact' },
    },
    {
      title: '待随访',
      count: followups.filter((f) => f.status === 'pending').length,
      action: '安排回访',
      page: 'followup' as PageId,
      filter: { status: 'pending' },
    },
    {
      title: '待上报/签署',
      count: reports.filter((r) => r.status === 'pending_sign').length,
      action: '前往报告',
      page: 'reports' as PageId,
      filter: { status: 'pending_sign' },
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
      label: '待筛查',
      value: patients.length.toString(),
      accent: 'bg-blue-600',
      trend: '+8% 较上周',
      hint: '待筛查=已登记但未完成影像/报告',
      onClick: () => drillTo('workstation'),
    },
    {
      label: '高危病例',
      value: highRisk.toString(),
      accent: 'bg-red-600',
      trend: '+2 较昨日',
      hint: '高危=AI 风险≥0.7 或医生标记',
      onClick: () => drillTo('workstation', { risk: 'high' }),
    },
    {
      label: '逾期随访',
      value: overdue.toString(),
      accent: 'bg-amber-500',
      trend: '-1 较昨日',
      hint: '逾期=随访 dueAt < 今天且未完成',
      onClick: () => drillTo('followup'),
    },
    {
      label: '阳性确认/签署',
      value: positiveToday.toString(),
      accent: 'bg-teal-500',
      trend: '+1 今日新增',
      hint: '含待签署与已签署报告数量',
      onClick: () => drillTo('reports'),
    },
  ];

  const explainRisk = (p: PatientWithAnalysis) => {
    const analysis = p.medical_images?.[0]?.ai_analyses?.[0];
    const tags: string[] = [];
    if (p.chief_complaint) tags.push(p.chief_complaint);
    if (p.tb_history) tags.push('既往结核');
    if (p.ppd_test_result?.includes('positive')) tags.push('PPD+');
    if (analysis?.tb_probability && analysis.tb_probability >= 70) tags.push('AI高概率');
    return tags.slice(0, 2);
  };

  const explainExam = (p: PatientWithAnalysis) => {
    const img = p.medical_images?.[0];
    if (!img) return '影像未上传';
    if (img.status === 'reviewed' || img.status === 'reported') return '影像已审核';
    if (img.status === 'reviewing') return '影像待审核';
    return '影像已上传';
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
    if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
    if (diff === 0) return '今日到期';
    return `剩余 ${diff} 天`;
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
              <div className="text-sm text-gray-200">点击查看</div>
            </div>
            <div className="mt-2 text-[11px] text-teal-200">{card.trend}</div>
            <div className="text-[11px] text-gray-500 mt-1">更新于 {formatDate(new Date().toISOString())}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            高危患者 Top5
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
                      {p.name} <span className="text-gray-500">({p.age}岁)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-200">{Math.round((p.risk_score || 0) * 100)}%</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] ${risk.color.badge} ${risk.color.badgeText}`}>{risk.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-[rgb(var(--card))] rounded text-[11px] text-gray-200">
                        {t}
                      </span>
                    ))}
                    {tags.length === 0 && <span className="text-gray-500">暂无症状/风险标签</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 flex justify-between items-center">
                    <span>{explainExam(p)}</span>
                    <button
                      onClick={() => drillTo('workstation')}
                      className="px-2 py-0.5 rounded border border-teal-600 text-teal-200 hover:bg-teal-900/40"
                    >
                      复核影像
                    </button>
                  </div>
                </div>
              );
            })}
            {topRisk.length === 0 && <div className="text-gray-500 text-xs">暂无高危患者</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Clock4 className="h-4 w-4 text-amber-400" />
            随访提醒
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
                    {f.status === 'overdue' ? '逾期' : f.status === 'pending' ? '待随访' : '已完成'}
                  </span>
                  <button
                    onClick={() => drillTo('followup')}
                    className="text-[11px] px-2 py-0.5 rounded border border-teal-600 text-teal-200 hover:bg-teal-900/40 transition-colors"
                  >
                    处理
                  </button>
                </div>
              </div>
            ))}
            {sortedFollowups.length === 0 && <div className="text-gray-500 text-xs">暂无待随访任务</div>}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Activity className="h-4 w-4 text-emerald-400" />
            最新报告
          </div>
          <div className="space-y-2">
            {latestReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-[rgb(var(--bg))] rounded px-2 py-1 border border-[rgb(var(--border))]">
                <div className="text-gray-200 flex items-center gap-2">
                  <span className="font-mono text-blue-300">{r.id}</span>
                  <span className="text-gray-400">{formatDate(r.updatedAt)}</span>
                  <span className="text-gray-500">· Dr.张 (最近操作)</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded ${
                    r.status === 'pending_sign'
                      ? 'bg-amber-900 text-amber-200'
                      : r.status === 'signed'
                      ? 'bg-emerald-900 text-emerald-200'
                      : r.status === 'retake'
                      ? 'bg-red-900 text-red-200'
                      : 'bg-[rgb(var(--card))] text-gray-300'
                  }`}
                >
                  {r.status === 'pending_sign' ? '待签署' : r.status === 'signed' ? '已签署' : r.status === 'retake' ? '重拍' : '草稿'}
                </span>
              </div>
            ))}
            {latestReports.length === 0 && <div className="text-gray-500 text-xs">暂无报告</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 aurora-card glass-card-hover p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-200 text-sm">
              <Activity className="h-4 w-4 text-teal-400" />
              近 8 周趋势（疑似 / 阳性 / 排除）
            </div>
            <span className="text-[11px] text-gray-500">可替换为 7/30/90 天</span>
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
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-amber-500 inline-block rounded"></span>疑似</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-500 inline-block rounded"></span>阳性</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-emerald-500 inline-block rounded"></span>排除/复查</span>
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <ClipboardList className="h-4 w-4 text-blue-400" />
            今日待办
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
              风险分层分布
            </div>
            <div className="space-y-1 text-[11px] text-gray-300">
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">高危</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-red-500" style={{ width: `${patients.length ? (highRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-red-200">{highRisk} 人</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">中危</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-amber-500" style={{ width: `${patients.length ? (mediumRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-amber-200">{mediumRisk} 人</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-gray-400">低危</span>
                <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-emerald-500" style={{ width: `${patients.length ? (lowRisk / patients.length) * 100 : 0}%` }}></div>
                </div>
                <span className="w-12 text-right text-emerald-200">{lowRisk} 人</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const { reports, patients } = useDataContext();
  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.name || id;
  const statusLabel = (status: string) => {
    if (status === 'pending_sign') return '待签署';
    if (status === 'signed') return '已签署';
    if (status === 'retake') return '退回重拍';
    return '草稿';
  };
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <FileText className="h-4 w-4 text-blue-400" />
          报告中心
        </div>
        <span className="text-[11px] text-gray-500">QA：必填校验 / 所见-印象一致性提示</span>
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
              <span className="text-gray-300">{row.type === 'screening' ? '筛查' : '转诊'}</span>
              <span className={`px-2 py-1 rounded ${
                row.status === 'pending_sign' ? 'bg-amber-900 text-amber-200' :
                row.status === 'signed' ? 'bg-emerald-900 text-emerald-200' :
                'bg-red-900 text-red-200'
              }`}>{statusLabel(row.status)}</span>
              <span className="text-amber-300">{row.qaNote || '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferralsPage() {
  const { referrals, patients, updateReferralStatus } = useDataContext();
  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.name || id;
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          转诊与上报
        </div>
        <span className="text-[11px] text-gray-500">必填字段校验，生成通知书/转诊单</span>
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
                缺失: {row.missingFields.join('、') || '—'}
              </span>
              <span className="text-gray-500">{row.updatedAt}</span>
              <div className="flex gap-1">
                <button onClick={() => updateReferralStatus(row.id, 'generated')} className={uiStyles.button.outline + ' text-[11px] px-2 py-1'}>
                  生成通知书
                </button>
                <button onClick={() => updateReferralStatus(row.id, 'submitted')} className={uiStyles.button.primary + ' text-[11px] px-2 py-1'}>
                  提交上报
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
  const { followups, patients, updateFollowupStatus } = useDataContext();
  const getPatientName = (id: string) => patients.find((p) => p.id === id)?.name || id;
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <Clock4 className="h-4 w-4 text-amber-400" />
          随访管理
        </div>
        <span className="text-[11px] text-gray-500">节点：2周 / 1月 / 3月；逾期自动提醒</span>
      </div>
      <div className="aurora-card glass-card-hover divide-y divide-gray-700">
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
              }`}>{row.status === 'overdue' ? '逾期' : row.status === 'pending' ? '待随访' : '已完成'}</span>
              <div className="flex gap-1">
                <button onClick={() => updateFollowupStatus(row.id, 'done')} className={uiStyles.button.primary + ' text-[11px] px-2 py-1'}>
                  完成
                </button>
                <button onClick={() => updateFollowupStatus(row.id, 'overdue')} className={uiStyles.button.secondary + ' text-[11px] px-2 py-1'}>
                  标记逾期
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
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Stethoscope className="h-4 w-4 text-teal-400" />
        科研与教学（脱敏导出/病例库）
      </div>
      <div className="aurora-card glass-card-hover p-3 text-sm space-y-3">
        <div className="text-gray-300">队列构建：地区 / 征象 / 检验 / 随访齐全</div>
        <div className="flex gap-2">
          <input className={uiStyles.input.default + ' flex-1'} placeholder="示例：百色 + 高危 + 结节" />
          <button className={uiStyles.button.primary}>生成队列</button>
        </div>
        <div className="flex gap-2">
          <button className={uiStyles.button.secondary}>导出脱敏 JSON</button>
          <button className={uiStyles.button.secondary}>导出 ROI/Mask</button>
        </div>
      </div>
      <div className="aurora-card glass-card-hover p-3 text-sm">
        <div className="text-gray-200 mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-300" />
          典型病例库（示例）
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['结节', '树芽征', '钙化'].map((tag) => (
            <div key={tag} className="bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded p-2 text-gray-300 text-xs">
              {tag} • 3 例占位
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPage() {
  const { auditLogs } = useDataContext();
  return (
    <div className="p-4 h-full overflow-y-auto bg-[rgb(var(--bg))] space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Shield className="h-4 w-4 text-emerald-400" />
        系统与审计
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
        当前模型：GX-TB-v4.2 • 阈值 0.75 • 角色：影像科/呼吸感染科/公卫护士（MVP）
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
  const [activePage, setActivePage] = useState<PageId>('enroll');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithAnalysis | null>(null);
  const [selectedImage, setSelectedImage] = useState<MedicalImage | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysis | null>(null);

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
        return <PatientQA />;
      case 'dashboard':
        return <DashboardPage onNavigate={(page, _filter) => setActivePage(page)} />;
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
      <div className="flex flex-col h-screen bg-[rgb(var(--bg))] text-gray-100">
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
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {pageContent}
      </div>
    </DataProvider>
  );
}

export default App;



