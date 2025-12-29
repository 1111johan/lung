import { useMemo, useState } from 'react';
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
import { uiStyles } from './lib/theme';
import { DataProvider, useDataContext } from './lib/dataContext';

type PageId = 'dashboard' | 'workstation' | 'reports' | 'referrals' | 'followup' | 'research' | 'audit';

const navItems: { id: PageId; label: string; icon: JSX.Element }[] = [
  { id: 'dashboard', label: '首页仪表盘', icon: <Home className="h-4 w-4" /> },
  { id: 'workstation', label: '筛查工作台', icon: <Layers className="h-4 w-4" /> },
  { id: 'reports', label: '报告中心', icon: <FileText className="h-4 w-4" /> },
  { id: 'referrals', label: '转诊与上报', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'followup', label: '随访管理', icon: <Clock4 className="h-4 w-4" /> },
  { id: 'research', label: '科研与教学', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'audit', label: '系统与审计', icon: <Shield className="h-4 w-4" /> },
];

function DashboardPage() {
  const { patients, followups, reports } = useDataContext();
  const highRisk = patients.filter((p) => p.risk_level === 'high').length;
  const overdue = followups.filter((f) => f.status === 'overdue').length;
  const positiveToday = reports.filter((r) => r.status === 'pending_sign' || r.status === 'signed').length;
  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto bg-gray-900">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '待筛查', value: patients.length.toString(), accent: 'bg-blue-600' },
          { label: '高危病例', value: highRisk.toString(), accent: 'bg-red-600' },
          { label: '逾期随访', value: overdue.toString(), accent: 'bg-amber-500' },
          { label: '阳性确认/签署', value: positiveToday.toString(), accent: 'bg-teal-500' },
        ].map((card) => (
          <div key={card.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="text-gray-400 text-xs">{card.label}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-8 w-1 rounded ${card.accent}`}></div>
              <div className="text-2xl font-bold text-gray-100">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-200 text-sm">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              高危分布（地区）
            </div>
            <span className="text-[11px] text-gray-500">Mock 数据</span>
          </div>
          <div className="h-40 bg-gray-900 rounded border border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-xs">
            图表占位：百色 / 玉林 / 南宁
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm mb-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            设备来源 & 推理耗时
          </div>
          <div className="h-40 bg-gray-900 rounded border border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-xs">
            图表占位：DR / CT / 移动DR
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
    <div className="p-4 h-full overflow-y-auto bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <FileText className="h-4 w-4 text-blue-400" />
          报告中心
        </div>
        <span className="text-[11px] text-gray-500">QA：必填校验 / 所见-印象一致性提示</span>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
        {reports.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-900 text-gray-200 font-mono text-xs">{row.id}</span>
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
    <div className="p-4 h-full overflow-y-auto bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          转诊与上报
        </div>
        <span className="text-[11px] text-gray-500">必填字段校验，生成通知书/转诊单</span>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
        {referrals.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-900 text-gray-200 font-mono text-xs">{row.id}</span>
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
    <div className="p-4 h-full overflow-y-auto bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <Clock4 className="h-4 w-4 text-amber-400" />
          随访管理
        </div>
        <span className="text-[11px] text-gray-500">节点：2周 / 1月 / 3月；逾期自动提醒</span>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
        {followups.map((row) => (
          <div key={row.id} className="p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-gray-900 text-gray-200 font-mono text-xs">{row.id}</span>
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
    <div className="p-4 h-full overflow-y-auto bg-gray-900 space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Stethoscope className="h-4 w-4 text-teal-400" />
        科研与教学（脱敏导出/病例库）
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm space-y-3">
        <div className="text-gray-300">队列构建：地区 / 征象 / 检验 / 随访齐全</div>
        <div className="flex gap-2">
          <input className={uiStyles.input.default + ' flex-1'} placeholder="示例：百色 + 高危 + 空洞" />
          <button className={uiStyles.button.primary}>生成队列</button>
        </div>
        <div className="flex gap-2">
          <button className={uiStyles.button.secondary}>导出脱敏 JSON</button>
          <button className={uiStyles.button.secondary}>导出 ROI/Mask</button>
        </div>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
        <div className="text-gray-200 mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-300" />
          典型病例库（示例）
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['空洞', '树芽征', '钙化'].map((tag) => (
            <div key={tag} className="bg-gray-900 border border-gray-700 rounded p-2 text-gray-300 text-xs">
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
    <div className="p-4 h-full overflow-y-auto bg-gray-900 space-y-3">
      <div className="flex items-center gap-2 text-gray-200 text-sm">
        <Shield className="h-4 w-4 text-emerald-400" />
        系统与审计
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
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
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-300">
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
  onSelectPatient: (p: PatientWithAnalysis) => void;
  selectedPatient: PatientWithAnalysis | null;
  selectedImage: MedicalImage | null;
  selectedAnalysis: AIAnalysis | null;
}) {
  return (
    <main className="flex-1 flex overflow-hidden bg-gray-900">
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
  const [activePage, setActivePage] = useState<PageId>('workstation');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithAnalysis | null>(null);
  const [selectedImage, setSelectedImage] = useState<MedicalImage | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysis | null>(null);

  const handleSelectPatient = (patient: PatientWithAnalysis) => {
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
      case 'dashboard':
        return <DashboardPage />;
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
      <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
        <Header />

        <div className="bg-gray-900 border-b border-gray-800 px-4">
          <div className="flex gap-2 overflow-x-auto py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm border ${
                  activePage === item.id
                    ? 'bg-gray-800 border-teal-600 text-teal-200'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
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
