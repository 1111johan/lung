import { useState } from 'react';
import { Send, ShieldAlert, MessageCircle, Sparkles } from 'lucide-react';
import { uiStyles } from '../lib/theme';

interface ChatItem {
  sender: 'user' | 'bot';
  text: string;
}

const quickQuestions = [
  '肺结核有哪些常见症状？',
  '结核会传染吗？怎么预防？',
  'IGRA/PPD 是什么？',
  '咳嗽多久需要就医？',
  '痰检阴性就能排除结核吗？',
];

function buildAnswer(question: string): string {
  return [
    `Q: ${question}`,
    '1) 回答：肺结核主要通过飞沫核传播，常见症状包括咳嗽、咳痰、低热、盗汗、体重下降等。',
    '2) 建议：若症状持续≥2周或出现咳血/胸痛，请尽快到结核门诊或呼吸科就诊，完善痰检/影像/IGRA。',
    '3) 安全提示：如出现咳血量多、高热不退、呼吸困难，请立即就医或急诊处理。',
  ].join('\n');
}

export function PatientQA() {
  const [messages, setMessages] = useState<ChatItem[]>([
    { sender: 'bot', text: '您好，这里是广西医科大学 TB 科普智能体。提供科普与就医建议，不替代医生诊断。' },
  ]);
  const [input, setInput] = useState('');

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { sender: 'user', text }, { sender: 'bot', text: buildAnswer(text) }]);
    setInput('');
  };

  return (
    <div className="flex-1 grid grid-cols-[2fr_1fr] gap-4 p-4 bg-gray-900 overflow-y-auto">
      <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col">
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <MessageCircle className="h-4 w-4 text-teal-400" />
            患者问答（TB 科普）
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <ShieldAlert className="h-3 w-3 text-amber-400" />
            提供科普与就医建议，不替代诊断
          </div>
        </div>

        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded text-sm whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-teal-900 text-teal-50 border border-teal-600'
                    : 'bg-gray-900 text-gray-200 border border-gray-700'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="请输入您的结核相关问题..."
            className={uiStyles.input.textarea + ' min-h-[80px]'}
          />
          <button onClick={() => send(input)} className={uiStyles.button.primary + ' flex items-center gap-2 justify-center'}>
            <Send className="h-4 w-4" />
            发送
          </button>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2 text-gray-200 text-sm">
          <Sparkles className="h-4 w-4 text-blue-400" />
          快捷问题
        </div>
        <div className="space-y-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="w-full text-left px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 text-sm text-gray-200 border border-gray-700"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 border border-gray-700 rounded p-2">
          提示：本助手提供科普和就医建议，紧急情况（咳血量多、高热不退、呼吸困难）请立即就医或急诊。
        </div>
      </div>
    </div>
  );
}
