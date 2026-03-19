import { Activity } from 'lucide-react';
import { APP_CONFIG } from '../lib/constants';
import { uiStyles } from '../lib/theme';
import { ThemeToggleSimple } from './ThemeToggle';
import { useI18n } from '../lib/i18n';
import { LanguageToggle } from './LanguageToggle';

export function Header() {
  const { tr } = useI18n();
  return (
    <header className={`${uiStyles.header.default} topbar`}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-teal-700 rounded flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-semibold text-lg tracking-wide text-gray-100">{tr(APP_CONFIG.name)}</h1>
      </div>
      <div className="text-sm text-gray-400 flex items-center gap-4">
        <span>
          {tr('当前连接：')}
          {tr(APP_CONFIG.name)}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
            <span className="text-blue-400">{tr('Agent 在线')}</span>
          </div>
          <LanguageToggle />
          <ThemeToggleSimple />
        </div>
      </div>
    </header>
  );
}
