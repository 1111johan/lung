import { useState } from 'react';
import { Send, ShieldAlert, MessageCircle, Sparkles, Pause } from 'lucide-react';
import { uiStyles } from '../lib/theme';
import { askDeepseek } from '../lib/deepseek';
import { DigitalHumanAvatar } from './DigitalHuman';
import { speakCN, stopSpeaking } from '../lib/voice';

interface ChatItem {
  sender: 'user' | 'bot';
  text: string;
}

const quickQuestions = [
  '咳嗽 ≥2 周、夜间盗汗、体重下降是结核的典型组合吗？',
  'IGRA/PPD 阳性但胸片正常，需要做什么复查？',
  '痰涂片阴性还能是肺结核吗，下一步怎么查？',
  '家庭成员确诊肺结核后，密接者要做哪些筛查？',
  '孕妇/哺乳期怀疑结核，影像和用药注意什么？',
  '耐药结核（MDR/XDR）与普通结核有什么区别？',
  '长期低热+盗汗但咳嗽不明显，可能是结核吗？',
  '结核治疗需要服药多久？停药或漏服有什么风险？',
  '什么时候可以解除隔离？复查标准是什么？',
  '合并糖尿病或 HIV 时，结核管理有什么特别注意？',
];

export function PatientQA() {
  const [messages, setMessages] = useState<ChatItem[]>([
    { sender: 'bot', text: '你好，这里是广西医科大 TB 科智能助手，提供科普与流程建议，不替代线下诊断。' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setInput('');
    setLoading(true);

    const reply = await askDeepseek(q);
    setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    speakCN(
      reply,
      () => setSpeaking(true),
      () => setSpeaking(false)
    );
    setLoading(false);
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
            仅供科普与流程建议，不替代医生诊断
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
          {loading && <div className="text-xs text-gray-500">生成回答中...</div>}
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="请输入你的结核相关问题..."
            className={uiStyles.input.textarea + ' min-h-[80px]'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => send(input)}
              disabled={loading}
              className={
                uiStyles.button.primary +
                ' flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              <Send className="h-4 w-4" />
              发送
            </button>
            <button
              onClick={() => {
                stopSpeaking();
                setSpeaking(false);
              }}
              className={uiStyles.button.secondary + ' flex items-center gap-2 justify-center'}
            >
              <Pause className="h-4 w-4" />
              停止朗读
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <DigitalHumanAvatar speaking={speaking} />
          <div className="text-xs text-gray-500 mt-2 text-center">
            状态：{speaking ? '数字人正在朗读' : '待机'}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Sparkles className="h-4 w-4 text-blue-400" />
            快捷提问
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
            提示：若出现高热、咯血、呼吸困难等紧急症状，请立即线下就医。
          </div>
        </div>
      </div>
    </div>
  );
}
