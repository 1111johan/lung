import { useRef, useState } from 'react';
import { Send, ShieldAlert, MessageCircle, Sparkles, Pause, FileText, Image as ImageIcon, Mic, Video, X } from 'lucide-react';
import { uiStyles } from '../lib/theme';
import { askDeepseek } from '../lib/deepseek';
import { DigitalHumanAvatar } from './DigitalHuman';
import { speakText, stopSpeaking } from '../lib/voice';
import { useI18n } from '../lib/i18n';

interface ChatItem {
  sender: 'user' | 'bot';
  text: string;
  attachments?: Attachment[];
}

type AttachmentKind = 'doc' | 'video' | 'audio' | 'image';

interface Attachment {
  id: string;
  name: string;
  size: string;
  kind: AttachmentKind;
}

const quickQuestions = [
  '咳嗽≥2周、夜间盗汗、体重下降是结核的典型组合吗？',
  'IGRA/PPD 阳性但胸片正常，需要做什么复查？',
  '痰涂片阴性还能是肺结核吗，下一步怎么查？',
  '家庭成员确诊肺结核后，密接者要做哪些筛查？',
  '孕妇或哺乳期疑似结核，影像和用药注意什么？',
  '耐药结核（MDR/XDR）与普通结核有什么区别？',
  '长期低热+盗汗但咳嗽不明显，可能是结核吗？',
  '结核治疗需要服药多久，停药或漏服有什么风险？',
  '什么时候可以解除隔离，复查标准是什么？',
  '合并糖尿病或 HIV 时，结核管理有哪些特别注意？',
];

const attachmentLabel = (kind: AttachmentKind, tr: (text: string) => string) => {
  if (kind === 'doc') return tr('文档');
  if (kind === 'image') return tr('图片');
  if (kind === 'audio') return tr('语音');
  return tr('视频');
};

export function PatientQA() {
  const { locale, tr } = useI18n();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      sender: 'bot',
      text: tr('你好，这里是广西医科大学 TB 科智能助手，提供科普与流程建议，不替代线下诊断。'),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const handleFiles = (kind: AttachmentKind, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((file) => ({
      id: `${kind}-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: formatSize(file.size),
      kind,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q && attachments.length === 0) return;
    const outgoing: ChatItem = {
      sender: 'user',
      text: q || tr('已上传附件'),
      attachments: attachments.length ? attachments : undefined,
    };

    setMessages((prev) => [...prev, outgoing]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    try {
      const reply = await askDeepseek(q, undefined, locale);
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
      speakText(
        reply,
        locale,
        () => setSpeaking(true),
        () => setSpeaking(false)
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: tr('当前问答服务暂不可用，请稍后重试。') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex gap-4 p-4 bg-[rgb(var(--bg))] overflow-hidden">
      <div className="flex-1 min-w-0 aurora-card glass-card-hover flex flex-col">
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <MessageCircle className="h-4 w-4 text-teal-400" />
            {tr('智能问答')}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <ShieldAlert className="h-3 w-3 text-amber-400" />
            {tr('仅供科普与流程建议，不替代医生诊断')}
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-teal-900 text-teal-50 border border-teal-600'
                    : 'bg-gray-900 text-gray-200 border border-gray-700'
                }`}
              >
                <div>{msg.text}</div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
                      >
                        <span className="text-gray-300">{attachmentLabel(file.kind, tr)}</span>
                        <span className="text-gray-400">{file.name}</span>
                        <span className="text-gray-500">{file.size}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-gray-500">{tr('生成回答中...')}</div>}
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
                >
                  <span className="text-gray-300">{attachmentLabel(file.kind, tr)}</span>
                  <span className="text-gray-400">{file.name}</span>
                  <span className="text-gray-500">{file.size}</span>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="text-gray-400 hover:text-gray-200"
                    title={tr('移除')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-2xl p-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => docInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传文档')}
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传图片')}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => audioInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传语音')}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={() => videoInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传视频')}
              >
                <Video className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr('输入问题，支持多种附件')}
              className={uiStyles.input.textarea + ' min-h-[64px] flex-1 border-none bg-transparent'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading}
              className={
                uiStyles.button.primary +
                ' flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              <Send className="h-4 w-4" />
              {tr('发送')}
            </button>
            <button
              onClick={() => {
                stopSpeaking();
                setSpeaking(false);
              }}
              className={uiStyles.button.secondary + ' flex items-center gap-2 justify-center'}
            >
              <Pause className="h-4 w-4" />
              {tr('停止朗读')}
            </button>
          </div>

          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('doc', e.target.files)}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('image', e.target.files)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('audio', e.target.files)}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('video', e.target.files)}
          />
        </div>
      </div>

      <div className="w-[320px] h-full overflow-y-auto space-y-3 pr-1">
        <div className="aurora-card glass-card-hover p-3">
          <DigitalHumanAvatar speaking={speaking} />
          <div className="text-xs text-gray-500 mt-2 text-center">
            {tr('状态：')}{speaking ? tr('数字人正在朗读') : tr('待机')}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Sparkles className="h-4 w-4 text-blue-400" />
            {tr('快速提问')}
          </div>
          <div className="space-y-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="w-full text-left px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 text-sm text-gray-200 border border-gray-700"
              >
                {tr(q)}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 border border-gray-700 rounded p-2">
            {tr('提示：若出现高热、咳血、呼吸困难等急症，请立即线下就医')}
          </div>
        </div>
      </div>
    </div>
  );
}
