import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Lightbulb,
  Code2,
  FileText,
  Atom,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';
import { ChatMessage, UserProfile } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LunaOrb } from './LunaOrb';
import { DexterLoader } from './DexterLoader';
import { copyText } from '../utils/clipboard';
import { getModelLabel } from '../utils/modelLabel';
import { splitAttachment } from '../utils/attachment';

interface ChatViewProps {
  messages: ChatMessage[];
  currentUser: UserProfile;
  isLoading: boolean;
  onSendPrompt: (prompt: string) => void;
  onRegenerate: () => void;
  onSwitchToCoder?: (userPrompt?: string) => void;
}

function renderUserContent(content: string) {
  if (!content.includes('**') && !content.includes('==')) return content;
  const parts = content.split(/(\*\*[^*]+\*\*|==[^=]+==)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="important-highlight">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      return (
        <mark key={i} className="important-highlight">
          {part.slice(2, -2)}
        </mark>
      );
    }
    return part;
  });
}

const SUGGESTIONS = [
  {
    title: 'Konsep Startup AI',
    subtitle: 'Rancang ide bisnis dan solusi berbasis kecerdasan buatan',
    prompt:
      'Buatkan konsep ide startup berbasis AI yang memecahkan masalah nyata di Asia Tenggara beserta rencana monetisasinya.',
    icon: <Lightbulb className="h-5 w-5 text-amber-400" />,
  },
  {
    title: 'Pemrograman & Software',
    subtitle: 'Tulis kode, algoritma, atau debugging (mode Luna Coder)',
    prompt: 'Tuliskan arsitektur dan kode TypeScript untuk implementasi rate-limiting queue dengan exponential backoff.',
    icon: <Code2 className="h-5 w-5 text-emerald-400" />,
  },
  {
    title: 'Analisis & Rangkuman',
    subtitle: 'Ekstrak poin kunci dan susun kerangka strategis',
    prompt: 'Bantu saya menyusun kerangka analisis SWOT dan roadmap implementasi transformasi digital untuk perusahaan.',
    icon: <FileText className="h-5 w-5 text-purple-400" />,
  },
  {
    title: 'Sains & Teknologi',
    subtitle: 'Pahami konsep mutakhir lewat analogi sederhana',
    prompt: 'Jelaskan bagaimana model transformer mengolah perhatian kontekstual (self-attention mechanism) secara intuitif.',
    icon: <Atom className="h-5 w-5 text-blue-400" />,
  },
];

interface MessageRowProps {
  msg: ChatMessage;
  userQuestion?: string;
  avatarLetter: string;
  avatarColor: string;
  isLastAssistant: boolean;
  copied: boolean;
  speaking: boolean;
  codingNoticeDismissed: boolean;
  isBusy: boolean;
  onCopy: (id: string, text: string) => void;
  onSpeak: (id: string, text: string) => void;
  onRegenerate: () => void;
  onSwitchToCoder?: (userPrompt?: string) => void;
  onDismissCodingNotice: (id: string) => void;
}

const MessageRow = React.memo(function MessageRow({
  msg,
  userQuestion,
  avatarLetter,
  avatarColor,
  isLastAssistant,
  copied,
  speaking,
  codingNoticeDismissed,
  isBusy,
  onCopy,
  onSpeak,
  onRegenerate,
  onSwitchToCoder,
  onDismissCodingNotice,
}: MessageRowProps) {
  if (msg.role === 'user') {
    const { name, body, text } = splitAttachment(msg.content);
    return (
      <div className="msg-in flex items-start justify-end gap-2.5 sm:gap-3 w-full">
        <div className="max-w-[88%] sm:max-w-[80%] min-w-0 flex flex-col items-end gap-1.5">
          {name && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-neutral-700/60 bg-[#222426] px-3 py-1.5 text-xs text-neutral-300">
              <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate font-medium">{name}</span>
              <span className="shrink-0 text-neutral-500">{body.length.toLocaleString('id-ID')} karakter</span>
            </div>
          )}
          {(text || !name) && (
            <div className="rounded-3xl rounded-tr-lg bg-[#282a2c] px-4 py-2.5 sm:px-5 sm:py-3 text-[15px] text-neutral-100 border border-neutral-700/50 leading-relaxed chat-wrap-down">
              {renderUserContent(text || msg.content)}
            </div>
          )}
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md select-none"
          style={{ backgroundColor: avatarColor }}
          aria-hidden="true"
        >
          {avatarLetter}
        </div>
      </div>
    );
  }

  const isCodingNotice = /tidak mendukung coding/i.test(msg.content) || /khusus coding/i.test(msg.content);

  return (
    <div className="msg-in flex items-start gap-3 sm:gap-4 w-full min-w-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18191c] border border-amber-500/30 shadow-[0_0_12px_rgba(255,191,72,0.18)] select-none">
        <LunaOrb size={0.28} animated={!!msg.isStreaming} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-semibold text-neutral-200">{getModelLabel(msg.model)}</span>
          <span className="hidden sm:inline text-[10px] text-amber-400/80 font-medium">(oleh Gimoy Studio)</span>
          {msg.isStreaming ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {msg.content ? 'sedang mengetik...' : 'sedang berpikir...'}
            </span>
          ) : (
            <span className="text-[11px] text-neutral-500 font-mono">
              {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {msg.isStreaming && !msg.content ? (
          <DexterLoader />
        ) : (
          <div className="text-neutral-200 break-words [overflow-wrap:anywhere] max-w-full">
            <MarkdownRenderer content={msg.content} isStreaming={msg.isStreaming} userQuestion={userQuestion} />
          </div>
        )}

        {!msg.isStreaming && msg.content && (
          <div className="mt-2 -ml-2 flex items-center gap-0.5 text-xs text-neutral-400">
            <button
              onClick={() => onCopy(msg.id, msg.content)}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 hover:bg-[#282a2c] hover:text-white transition-colors"
              title="Salin pesan"
              aria-label="Salin pesan"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Salin</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSpeak(msg.id, msg.content)}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors ${
                speaking ? 'text-amber-400 bg-amber-950/40' : 'hover:bg-[#282a2c] hover:text-white'
              }`}
              title="Bacakan dengan suara"
              aria-label={speaking ? 'Hentikan suara' : 'Bacakan dengan suara'}
            >
              {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{speaking ? 'Hentikan' : 'Dengarkan'}</span>
            </button>

            {isLastAssistant && (
              <button
                onClick={onRegenerate}
                disabled={isBusy}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 hover:bg-[#282a2c] hover:text-white transition-colors disabled:opacity-40"
                title="Buat ulang jawaban"
                aria-label="Buat ulang jawaban"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Buat ulang</span>
              </button>
            )}
          </div>
        )}

        {isCodingNotice && !msg.isStreaming && !codingNoticeDismissed && (
          <div className="fade-in mt-3.5 rounded-2xl border border-emerald-500/40 bg-[#161a18] p-3.5 sm:p-4 shadow-lg shadow-emerald-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Code2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white leading-snug">
                  Saat ini model Luna tidak mendukung coding, apakah anda ingin beralih ke mode bahasa khusus coding?
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Beralih ke Luna Coder untuk langsung membuat program, struktur kode, dan arsitektur aplikasi.
                </p>
                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSwitchToCoder?.(userQuestion)}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 px-3.5 text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span>Iya, Pindah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissCodingNotice(msg.id)}
                    className="h-9 rounded-xl border border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3.5 text-xs font-medium transition-colors"
                  >
                    Tidak, Tetap disini
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  currentUser,
  isLoading,
  onSendPrompt,
  onRegenerate,
  onSwitchToCoder,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const prevCountRef = useRef(0);
  const firstIdRef = useRef<string | undefined>(undefined);
  const [showJump, setShowJump] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  // Pertanyaan pengguna sebelum tiap pesan (dihitung sekali, O(n))
  const prevQuestions = useMemo(() => {
    const out: Array<string | undefined> = [];
    let last: string | undefined;
    for (const m of messages) {
      out.push(last);
      if (m.role === 'user') last = splitAttachment(m.content).text || m.content;
    }
    return out;
  }, [messages]);

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return messages[i].id;
    return null;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 0);
  };

  // Tetap di bawah saat jawaban mengalir, kecuali pengguna sengaja menggulir ke atas
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const grew = messages.length > prevCountRef.current;
    if (grew && last?.role === 'user') stickRef.current = true; // pesan baru dari pengguna
    // ganti percakapan -> mulai dari pesan terbaru
    if (messages[0]?.id !== firstIdRef.current) {
      stickRef.current = true;
      firstIdRef.current = messages[0]?.id;
    }
    prevCountRef.current = messages.length;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => () => window.speechSynthesis?.cancel?.(), []);

  const handleCopy = useCallback(async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    }
  }, []);

  const handleSpeak = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`~>\[\]()]/g, ' ').slice(0, 1000);
    const utterance = new SpeechSynthesisUtterance(clean);
    const idVoice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utterance.voice = idVoice;
    utterance.lang = 'id-ID';
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const dismiss = useCallback((id: string) => setDismissed((p) => ({ ...p, [id]: true })), []);

  const isEmpty = messages.length === 0;
  const letter = (currentUser.displayName || currentUser.username || '?').charAt(0).toUpperCase();

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin overscroll-contain px-3 sm:px-4"
      >
        <div className={`mx-auto w-full max-w-3xl ${isEmpty ? 'min-h-full flex flex-col justify-center py-6' : 'py-5 sm:py-6'}`}>
          {isEmpty ? (
            <div className="fade-in w-full">
              <div className="space-y-1.5 sm:space-y-2.5">
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight [overflow-wrap:anywhere]">
                  <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Halo, {currentUser.displayName || currentUser.username}
                  </span>
                </h1>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-medium text-neutral-400 tracking-tight leading-snug">
                  Bagaimana Luna dapat membantu Anda hari ini?
                </h2>
              </div>

              <div className="mt-6 sm:mt-9 grid grid-cols-2 gap-2.5 sm:gap-3.5">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => onSendPrompt(item.prompt)}
                    className="group flex flex-col justify-between rounded-2xl bg-[#1e1f20]/90 p-3 sm:p-4 text-left border border-neutral-800/80 hover:bg-[#252729] hover:border-neutral-700 active:scale-[0.98] transition-all duration-200 min-h-[104px] sm:min-h-[132px]"
                  >
                    <div className="flex items-start justify-between w-full">
                      <span className="rounded-xl bg-neutral-900/80 p-2 sm:p-2.5">{item.icon}</span>
                      <ArrowRight className="h-4 w-4 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all hidden sm:block" />
                    </div>
                    <div className="mt-3">
                      <div className="text-[13px] sm:text-sm font-semibold text-neutral-100 leading-snug">{item.title}</div>
                      <div className="hidden sm:block mt-1 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 w-full">
              {messages.map((msg, i) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  userQuestion={prevQuestions[i]}
                  avatarLetter={letter}
                  avatarColor={currentUser.avatarColor || '#ffbf48'}
                  isLastAssistant={msg.id === lastAssistantId}
                  copied={copiedId === msg.id}
                  speaking={speakingId === msg.id}
                  codingNoticeDismissed={!!dismissed[msg.id]}
                  isBusy={isLoading}
                  onCopy={handleCopy}
                  onSpeak={handleSpeak}
                  onRegenerate={onRegenerate}
                  onSwitchToCoder={onSwitchToCoder}
                  onDismissCodingNotice={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showJump && (
        <button
          onClick={jumpToBottom}
          className="fade-in absolute bottom-3 left-1/2 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-[#222426]/95 text-neutral-200 shadow-lg backdrop-blur hover:bg-[#2b2d30] active:scale-95"
          aria-label="Gulir ke pesan terbaru"
          title="Ke pesan terbaru"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
