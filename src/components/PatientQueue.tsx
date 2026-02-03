import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { PatientWithAnalysis } from '../lib/database.types';
import { AlertTriangle, MapPin, Trash2 } from 'lucide-react';
import { getRiskStyles, uiStyles } from '../lib/theme';
import { PATIENT_DISPLAY } from '../lib/constants';
import { useDataContext } from '../lib/dataContext';
import type { AnalysisFinding } from '../lib/analysisTypes';
import { filterFindings } from '../lib/analysisUtils';

interface PatientQueueProps {
  onSelectPatient: (patient: PatientWithAnalysis | null) => void;
  selectedPatientId: string | null;
}

export function PatientQueue({ onSelectPatient, selectedPatientId }: PatientQueueProps) {
  const { patients, removePatient } = useDataContext();

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  }, [patients]);

  const highRiskCount = sortedPatients.filter(p => p.risk_level === 'high').length;

  const riskAccent = {
    high: 'rgb(239 68 68)',
    medium: 'rgb(234 179 8)',
    low: 'rgb(34 197 94)',
  } as const;

  const getRiskBadgeColor = (riskLevel: 'high' | 'medium' | 'low') => {
    const styles = getRiskStyles(riskLevel);
    return `${styles.color.badge} ${styles.color.badgeText}`;
  };

  const canDelete = (patient: PatientWithAnalysis) => {
    const images = patient.medical_images ?? [];
    if (images.length === 0) return true;
    return images.some((img) => img.status === 'reviewing' || img.status === 'pending');
  };

  return (
    <aside className={`${uiStyles.sidebar.default} patient-queue workstation-panel workstation-panel-strong`}>
      <div className="p-3 border-b border-gray-700 font-medium flex justify-between items-center">
        <span className="text-gray-200">待筛查 ({sortedPatients.length})</span>
        {highRiskCount > 0 && (
          <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            高危优先
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {sortedPatients.map((patient) => {
          const analysis = patient.medical_images?.[0]?.ai_analyses?.[0];
          const riskLevel = (analysis?.risk_level || 'low') as 'high' | 'medium' | 'low';
          const riskScore = analysis?.risk_score || 0;
          const rawFindings = Array.isArray(analysis?.findings) ? (analysis.findings as AnalysisFinding[]) : [];
          const findingsArray = filterFindings(rawFindings);
          const findings = findingsArray[0];

          const riskClass =
            riskLevel === 'high' ? 'patient-card-danger' : riskLevel === 'medium' ? 'patient-card-warn' : 'patient-card-ok';

          return (
            <div
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              style={{ ['--risk-color' as string]: riskAccent[riskLevel] } as CSSProperties}
              className={`p-3 mb-2 cursor-pointer patient-card ${riskClass} ${
                selectedPatientId === patient.id ? 'patient-card-active' : ''
              }`}
            >
              <div className="flex justify-between mb-1 items-center gap-2">
                <span className="font-bold text-gray-200">
                  {PATIENT_DISPLAY.nameMaskPattern(patient.name)} ({patient.gender === 'male' ? '男' : '女'}, {patient.age}岁)
                </span>
                <div className="flex items-center gap-2">
                  {analysis && (
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${getRiskBadgeColor(riskLevel)}`}>
                      {(riskScore * 100).toFixed(0)}%
                    </span>
                  )}
                  {canDelete(patient) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm('确认删除该待筛查患者？')) return;
                        removePatient(patient.id);
                        if (selectedPatientId === patient.id) {
                          const next = sortedPatients.find((p) => p.id !== patient.id) || null;
                          onSelectPatient(next);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded border border-red-400/40 text-red-300 hover:bg-red-900/30 flex items-center gap-1"
                      title="删除待筛查患者"
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-secondary mb-2 flex items-center gap-2">
                <span>{patient.patient_code}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{patient.region}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {findings?.location && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded-full text-[rgb(var(--accent))]">
                    AI: {findings.location}
                  </span>
                )}
                {patient.chief_complaint && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded-full text-[rgb(var(--warning))]">
                    主诉: {patient.chief_complaint}
                  </span>
                )}
                {patient.tb_history && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded-full text-[rgb(var(--warning))]">
                    既往TB史
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
