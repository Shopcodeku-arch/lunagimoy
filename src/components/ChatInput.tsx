import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Mic, MicOff, Sparkles, X, FileText, Square } from 'lucide-react';

import { ModelVariant, SendOptions } from '../types';
import { ModelSelector } from './ModelSelector';
import { buildAttachmentMessage } from '../utils/attachment';

interface ChatInputProps {
  onSendMessage: (message: string, options?: SendOptions) => void;
  isLoading: boolean;
  selectedModel: ModelVariant;
  onSelectModel: (variant: ModelVariant) => void;
  onStopGeneration?: () => void;
}

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILE_CHARS = 10000;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  selectedModel,
  onSelectModel,
  onStopGeneration,
}) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [deepMode, setDeepMode] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string; truncated: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Perangkat sentuh: Enter = baris baru (kirim lewat tombol). Desktop: Enter = kirim, Shift+Enter = baris baru.
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 160)}px`;
  }, [text]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const canSubmit = (text.trim().length > 0 || attachment !== null) && !isLoading;

  const handleSend = () => {
    if (!canSubmit) return;
    const typed = text.trim();
    const message = attachment ? buildAttachmentMessage(attachment.name, attachment.content, typed) : typed;
    if (!message) return;

    onSendMessage(message, { research: deepMode });
    setText('');
    setAttachment(null);
    if (isTouch) textareaRef.current?.blur();
    else textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || isTouch) return;
    e.preventDefault();
    handleSend();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setNotice('Ukuran file maksimal 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      setAttachment({
        name: file.name,
        content: content.slice(0, MAX_FILE_CHARS),
        truncated: content.length > MAX_FILE_CHARS,
      });
    };
    reader.onerror = () => setNotice('File tidak dapat dibaca. Gunakan file teks atau kode.');
    reader.readAsText(file);
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('Browser ini belum mendukung input suara.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error === 'not-allowed') setNotice('Izin mikrofon ditolak. Aktifkan di pengaturan browser.');
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const iconBtn =
    'flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/70 active:scale-90 transition';

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
      {(attachment || notice) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {attachment && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-neutral-800/90 border border-neutral-700 pl-3 pr-1.5 py-1 text-xs text-neutral-300">
              <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="font-medium truncate max-w-[10rem] sm:max-w-xs">{attachment.name}</span>
              {attachment.truncated && <span className="shrink-0 text-neutral-500">(dipotong)</span>}
              <button
                onClick={() => setAttachment(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-neutral-700 text-neutral-400 hover:text-white"
                aria-label="Hapus lampiran"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="fade-in rounded-lg bg-amber-950/50 border border-amber-800/60 px-3 py-1 text-xs text-amber-200">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-2 px-0.5">
        <ModelSelector selectedModel={selectedModel} onSelectModel={onSelectModel} />
      </div>

      <div className="relative flex flex-col rounded-[26px] bg-[#1e1f20] border border-[#333537] focus-within:border-[#5a5e63] focus-within:bg-[#222426] transition-colors shadow-xl">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.xml,.yml,.yaml,.log,.java,.c,.cpp,.go,.rs,.php,.sh"
          className="hidden"
        />

        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Luna sedang menjawab...' : 'Tanyakan apa saja kepada Luna...'}
            rows={1}
            enterKeyHint={isTouch ? 'enter' : 'send'}
            aria-label="Pesan untuk Luna"
            className="block w-full resize-none bg-transparent text-base sm:text-[15px] text-neutral-100 placeholder-neutral-500 outline-none max-h-40 leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between px-2 sm:px-3 pb-2 pt-0.5">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={iconBtn}
              title="Lampirkan file teks atau kode"
              aria-label="Lampirkan file"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => setDeepMode((v) => !v)}
              aria-pressed={deepMode}
              className={`flex h-10 sm:h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium border active:scale-95 transition ${
                deepMode
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'border-transparent text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/70'
              }`}
              title="Minta jawaban lebih rinci dan terstruktur"
            >
              <Sparkles className="h-4 w-4" />
              <span>Mendalam</span>
            </button>

            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`${iconBtn} ${isListening ? '!bg-rose-500/20 !text-rose-400 animate-pulse' : ''}`}
              title={isListening ? 'Hentikan perekaman' : 'Ketik dengan suara (Bahasa Indonesia)'}
              aria-label={isListening ? 'Hentikan perekaman' : 'Ketik dengan suara'}
            >
              {isListening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
          </div>

          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 hover:bg-white active:scale-90 transition"
              title="Hentikan jawaban"
              aria-label="Hentikan jawaban"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              className={`flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full transition ${
                canSubmit
                  ? 'bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-neutral-950 shadow-lg active:scale-90'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
              }`}
              title="Kirim pesan"
              aria-label="Kirim pesan"
            >
              <ArrowUp className="h-[18px] w-[18px] stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-center text-[11px] leading-snug text-neutral-400">
        Luna dapat membuat kekeliruan. Verifikasi informasi penting.
      </div>
    </div>
  );
};
