import { useEffect, useState } from 'react';
import { Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { applyTheme, ThemeMode } from '../lib/theme';

const modes: ThemeMode[] = ['system', 'light', 'dark'];

function next(mode: ThemeMode): ThemeMode {
  const idx = modes.indexOf(mode);
  return modes[(idx + 1) % modes.length];
}

export function ThemeToggleSimple() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const icon =
    mode === 'dark' ? <Moon className="h-4 w-4" /> :
    mode === 'light' ? <Sun className="h-4 w-4" /> :
    <MonitorSmartphone className="h-4 w-4" />;

  const label = mode === 'dark' ? '深色' : mode === 'light' ? '浅色' : '跟随系统';

  return (
    <button
      onClick={() => setMode((m) => next(m))}
      className="glass-card-sm flex items-center gap-2 px-3 py-1.5 text-xs text-gray-200 border border-gray-700 hover:border-teal-500 transition-colors"
      title="切换主题（系统/浅色/深色）"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
