import { ListChecks } from 'lucide-react';
import type { PageId } from '../lib/pageTypes';
import { pageCases } from '../lib/cases';
import { useI18n } from '../lib/i18n';

interface CasesPanelProps {
  pageId: PageId;
}

export function CasesPanel({ pageId }: CasesPanelProps) {
  const { tr } = useI18n();
  const items = pageCases[pageId] || [];
  if (items.length === 0) return null;

  return (
    <section className="bg-gray-900 border-t border-gray-800 px-4 py-3">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-gray-100 text-sm">
            <ListChecks className="h-4 w-4 text-teal-400" />
            <span>
              {tr('参考用例')}（{items.length} {tr('条')}）
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            {tr('当前页')}：{pageId}
          </span>
        </header>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-72 overflow-y-auto pr-1">
          {items.map((text, idx) => (
            <div
              key={text}
              className="text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-md p-2 leading-relaxed flex gap-2"
            >
              <span className="text-teal-400 font-mono">{String(idx + 1).padStart(2, '0')}.</span>
              <span className="text-gray-200">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
