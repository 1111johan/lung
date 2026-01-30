declare global {
  interface Window {
    __setMouth?: (v: number) => void;
  }
}

export function speakCN(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onStart?.();
    onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find((v) => (v.lang || '').toLowerCase().includes('zh'));
  if (zh) utterance.voice = zh;

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

export function stopSpeaking() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.__setMouth?.(0);
}
