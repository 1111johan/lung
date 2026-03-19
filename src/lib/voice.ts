import type { AppLocale } from './i18n';

declare global {
  interface Window {
    __setMouth?: (v: number) => void;
  }
}

const speechLangByLocale: Record<AppLocale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  th: 'th-TH',
  id: 'id-ID',
  ms: 'ms-MY',
};

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => (v.lang || '').toLowerCase() === lang.toLowerCase());
  if (exact) return exact;

  const prefix = lang.split('-')[0].toLowerCase();
  const close = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix));
  if (close) return close;

  return null;
}

export function speakText(
  text: string,
  locale: AppLocale,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onStart?.();
    onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const targetLang = speechLangByLocale[locale] || 'en-US';
  utterance.lang = targetLang;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voice = pickVoice(targetLang);
  if (voice) utterance.voice = voice;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => {
    onEnd?.();
    window.__setMouth?.(0);
  };

  // 用边界事件模拟“嘴巴开合”节奏
  utterance.onboundary = () => {
    window.__setMouth?.(0.9);
    window.setTimeout(() => window.__setMouth?.(0.1), 80);
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function speakCN(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  speakText(text, 'zh', onStart, onEnd);
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.__setMouth?.(0);
}
