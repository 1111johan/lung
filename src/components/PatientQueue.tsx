import { useMemo } from 'react';
import type { PatientWithAnalysis } from '../lib/database.types';
import { AlertTriangle, MapPin } from 'lucide-react';
import { getRiskStyles, uiStyles } from '../lib/theme';
import { PATIENT_DISPLAY } from '../lib/constants';
import { useDataContext } from '../lib/dataContext';

interface PatientQueueProps {
  onSelectPatient: (patient: PatientWithAnalysis) => void;
  selectedPatientId: string | null;
}

export function PatientQueue({ onSelectPatient, selectedPatientId }: PatientQueueProps) {
  const { patients } = useDataContext();

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  }, [patients]);

  const highRiskCount = sortedPatients.filter(p => p.risk_level === 'high').length;

  const getRiskColor = (riskLevel: 'high' | 'medium' | 'low') => {
    const styles = getRiskStyles(riskLevel);
    return `${styles.color.border} ${styles.color.bg}`;
  };

  const getRiskBadgeColor = (riskLevel: 'high' | 'medium' | 'low') => {
    const styles = getRiskStyles(riskLevel);
    return `${styles.color.badge} ${styles.color.badgeText}`;
  };

  return (
    <aside className={uiStyles.sidebar.default}>
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
          const findings = analysis?.findings?.[0];

          return (
            <div
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              className={`p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer border-l-4 transition-colors ${
                getRiskColor(riskLevel)
              } ${selectedPatientId === patient.id ? 'bg-gray-800' : ''}`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-white">
                  {PATIENT_DISPLAY.nameMaskPattern(patient.name)} ({patient.gender === 'male' ? '男' : '女'}, {patient.age}岁)
                </span>
                {analysis && (
                  <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${getRiskBadgeColor(riskLevel)}`}>
                    {(riskScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                <span>{patient.patient_code}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{patient.region}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {findings?.location && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-blue-300">
                    AI: {findings.location}
                  </span>
                )}
                {patient.chief_complaint && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-yellow-300">
                    主诉: {patient.chief_complaint}
                  </span>
                )}
                {patient.tb_history && (
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-orange-300">
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
