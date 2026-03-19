import { Languages } from 'lucide-react';
import { useI18n, type AppLocale } from '../lib/i18n';

const localeOrder: AppLocale[] = ['zh', 'en', 'th', 'id', 'ms'];

export function LanguageToggle() {
  const { locale, setLocale, localeLabels } = useI18n();

  return (
    <label className="glass-card-sm flex items-center gap-2 px-2 py-1.5 text-xs text-gray-200 border border-gray-700 hover:border-teal-500 transition-colors">
      <Languages className="h-4 w-4" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as AppLocale)}
        className="bg-transparent outline-none text-xs text-gray-200"
        aria-label="language switcher"
      >
        {localeOrder.map((code) => (
          <option key={code} value={code} className="text-black">
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
