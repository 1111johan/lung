import { Activity } from 'lucide-react';
import { APP_CONFIG } from '../lib/constants';
import { uiStyles } from '../lib/theme';

export function Header() {
  return (
    <header className={uiStyles.header.default}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-teal-700 rounded flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-semibold text-lg tracking-wide text-gray-100">
          {APP_CONFIG.name.split(' ')[0]} <span className="text-teal-500">{APP_CONFIG.name.split(' ')[1]}</span>
        </h1>
      </div>
      <div className="text-sm text-gray-400 flex items-center gap-4">
        <span>当前连接：{APP_CONFIG.hospital} {APP_CONFIG.department}</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
          <span className="text-blue-400">Agent 在线</span>
        </div>
      </div>
    </header>
  );
}
