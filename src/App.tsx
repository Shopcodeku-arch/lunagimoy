import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, RefreshCw, AlertCircle, X } from 'lucide-react';
import { ChatMessage, ChatSummary, ChatSession, UserProfile, ModelVariant, SendOptions } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { ChatInput } from './components/ChatInput';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { CodingSwitchModal } from './components/CodingSwitchModal';
import { LunaOrb } from './components/LunaOrb';
import { StorageService, newId } from './services/storage';
import { streamLuna, ensurePuterSignedIn, LunaError } from './services/ai';
import { isCodingRequest } from './utils/codeDetector';
import { getModelLabel } from './utils/modelLabel';
import { splitAttachment } from './utils/attachment';

const DEFAULT_TITLE = 'Percakapan Baru';
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

function readStoredModel(): ModelVariant {
  try {
    const v = localStorage.getItem('luna_model');
    if (v === 'standard' || v === 'pro' || v === 'coder') return v;
  } catch {
    // abaikan
  }
  return 'standard';
}

function makeTitle(currentTitle: string, userText: string): string {
  if (currentTitle !== DEFAULT_TITLE) return currentTitle;
  const { name, text } = splitAttachment(userText);
  const line = (text || name || '').trim().split('\n')[0].substring(0, 38);
  return line || DEFAULT_TITLE;
}

const toSummary = (c: ChatSession): ChatSummary => ({
  id: c.id,
  username: c.username,
  title: c.title,
  model: c.model,
  pinned: c.pinned,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelVariant>(readStoredModel);
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCodingModalOpen, setIsCodingModalOpen] = useState(false);
  const [pendingCoding, setPendingCoding] = useState<{ text: string; research: boolean } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Ref agar callback async selalu membaca nilai terbaru
  const userRef = useRef<UserProfile | null>(null);
  const activeChatRef = useRef<ChatSession | null>(null);
  const busyRef = useRef(false);
  const stopRef = useRef<{ stopped: boolean } | null>(null);
  userRef.current = currentUser;
  activeChatRef.current = activeChat;

  const activeChatId = activeChat?.id ?? null;

  // Tinggi aplikasi mengikuti area terlihat (keyboard HP) -> kolom input tidak tertutup
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--app-h', `${Math.round(vv ? vv.height : window.innerHeight)}px`);
      if (vv && vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('luna_model', selectedModel);
    } catch {
      // abaikan
    }
  }, [selectedModel]);

  // 1. Cek akun tersimpan
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = localStorage.getItem('luna_username');
      if (stored === 'ardan' || stored === 'guest_user') {
        localStorage.removeItem('luna_username');
      }
      const name = localStorage.getItem('luna_username');
      if (!name) {
        if (alive) {
          setIsAuthModalOpen(true);
          setAuthChecked(true);
        }
        return;
      }
      try {
        const user = await StorageService.getUser(name);
        if (!alive) return;
        setCurrentUser(user);
      } catch {
        localStorage.removeItem('luna_username');
        if (alive) setIsAuthModalOpen(true);
      } finally {
        if (alive) setAuthChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshChats = useCallback(async (username?: string) => {
    const name = username || userRef.current?.username;
    if (!name) return;
    try {
      setChats(await StorageService.listChats(name));
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  }, []);

  const loadChat = useCallback(async (chatId: string, username?: string) => {
    const name = username || userRef.current?.username;
    if (!name) return;
    try {
      const chat = await StorageService.getChat(chatId, name);
      if (chat) setActiveChat(chat);
    } catch (err) {
      console.error('Failed to load chat detail:', err);
    }
  }, []);

  // 2. Muat daftar chat saat akun berganti
  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setActiveChat(null);
      return;
    }
    let alive = true;
    (async () => {
      const list = await StorageService.listChats(currentUser.username);
      if (!alive) return;
      setChats(list);
      if (list.length > 0) {
        const first = await StorageService.getChat(list[0].id, currentUser.username);
        if (alive && first) setActiveChat(first);
      } else {
        setActiveChat(null);
      }
    })().catch((err) => console.error('Failed to init chats:', err));
    return () => {
      alive = false;
    };
  }, [currentUser?.username]);

  const closeSidebarOnMobile = () => {
    if (!isDesktop()) setIsSidebarOpen(false);
  };

  // 3. Obrolan baru: tidak membuat sesi kosong; sesi dibuat saat pesan pertama dikirim
  const handleNewChat = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveChat(null);
    setErrorBanner(null);
    closeSidebarOnMobile();
  };

  const handleSelectChat = (id: string) => {
    setErrorBanner(null);
    loadChat(id);
    closeSidebarOnMobile();
  };

  // 4. Inti: kirim percakapan ke Puter, tampilkan stream, simpan hasilnya
  const generate = async (
    working: ChatSession,
    model: ModelVariant,
    research: boolean,
    authReady: Promise<void>
  ) => {
    const user = userRef.current;
    if (!user) return;

    busyRef.current = true;
    setIsLoading(true);
    setErrorBanner(null);

    const chatId = working.id;
    const assistantId = newId('msg');
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      model: getModelLabel(model),
      isStreaming: true,
    };

    const patchIfCurrent = (fn: (c: ChatSession) => ChatSession) =>
      setActiveChat((prev) => (prev && prev.id === chatId ? fn(prev) : prev));

    // Pesan pengguna langsung tersimpan agar tidak hilang bila halaman ditutup
    const persisted = StorageService.saveChatLocal(working);
    setActiveChat({ ...persisted, messages: [...persisted.messages, placeholder] });
    setChats((prev) => [toSummary(persisted), ...prev.filter((c) => c.id !== chatId)].sort((a, b) =>
      a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt
    ));

    const ctl = { stopped: false };
    stopRef.current = ctl;

    let target = '';
    let rendered = '';
    let streamDone = false;
    let raf = 0;
    let lastPaint = 0;
    let resolveDrain: () => void = () => {};
    const drained = new Promise<void>((r) => (resolveDrain = r));

    const paint = (text: string) =>
      patchIfCurrent((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: text, isStreaming: true } : m)),
      }));

    // Efek mengetik halus; UI diperbarui maksimal ~30x/detik agar ringan di HP
    const tick = (ts: number) => {
      if (ctl.stopped) target = target.slice(0, rendered.length);
      if (rendered.length < target.length) {
        const gap = target.length - rendered.length;
        const step = gap > 200 ? Math.ceil(gap / 8) : gap > 60 ? Math.ceil(gap / 6) : gap > 24 ? 4 : gap > 8 ? 2 : 1;
        rendered = target.slice(0, rendered.length + step);
        if (ts - lastPaint > 32 || rendered.length >= target.length) {
          lastPaint = ts;
          paint(rendered);
        }
      }
      if (rendered.length < target.length || !streamDone) raf = requestAnimationFrame(tick);
      else resolveDrain();
    };
    raf = requestAnimationFrame(tick);

    let errorText: string | null = null;
    try {
      await authReady;
      const full = await streamLuna({
        history: working.messages,
        modelVariant: model,
        customPrompt: user.systemPrompt,
        research,
        shouldStop: () => ctl.stopped,
        onText: (t) => {
          target = t;
        },
      });
      if (!ctl.stopped) target = full;
    } catch (err) {
      const e = err as LunaError;
      errorText = e?.message || 'Luna gagal menjawab. Silakan coba lagi.';
      if (e?.partial && e.partial.length > target.length) target = e.partial;
      console.warn('Luna error:', err);
    }

    streamDone = true;
    // Tab di latar belakang menghentikan rAF; jangan menunggu selamanya
    await Promise.race([drained, new Promise<void>((r) => setTimeout(r, 1200))]);
    cancelAnimationFrame(raf);

    const finalText = ctl.stopped ? rendered : target;
    const finalMessages: ChatMessage[] = finalText.trim()
      ? [...working.messages, { ...placeholder, content: finalText, isStreaming: false, createdAt: Date.now() }]
      : working.messages;

    const saved = StorageService.saveChatLocal({ ...working, messages: finalMessages });
    patchIfCurrent((c) => ({ ...c, messages: finalMessages, title: saved.title }));
    void StorageService.pushToServer(saved);
    void refreshChats(user.username);

    if (errorText && !ctl.stopped) setErrorBanner(errorText);
    stopRef.current = null;
    busyRef.current = false;
    setIsLoading(false);
  };

  const executeSendMessage = async (messageText: string, model: ModelVariant, research = false) => {
    const user = userRef.current;
    if (!user || busyRef.current) return;

    // Harus dipanggil sinkron (masih di dalam aksi klik/Enter) agar pop-up login Puter tidak diblokir
    const authReady = ensurePuterSignedIn();
    authReady.catch(() => undefined);

    busyRef.current = true; // cegah kirim ganda selama menunggu penyimpanan
    try {
      let chat = activeChatRef.current;
      if (!chat) chat = await StorageService.createChat(user.username, DEFAULT_TITLE, model);

      const userMsg: ChatMessage = { id: newId('msg'), role: 'user', content: messageText, createdAt: Date.now() };
      const working: ChatSession = {
        ...chat,
        title: makeTitle(chat.title, messageText),
        model,
        messages: [...chat.messages.filter((m) => !m.isStreaming), userMsg],
      };
      busyRef.current = false;
      await generate(working, model, research, authReady);
    } catch (err) {
      console.error('Send error:', err);
      busyRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSendMessage = (messageText: string, options?: SendOptions) => {
    if (!userRef.current) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!messageText.trim() || busyRef.current) return;

    const model = options?.forceModel || selectedModel;
    const research = !!options?.research;

    // Hanya teks yang diketik pengguna yang diperiksa (isi file terlampir diabaikan)
    if (model !== 'coder' && !options?.forceModel && isCodingRequest(splitAttachment(messageText).text)) {
      setPendingCoding({ text: messageText, research });
      setIsCodingModalOpen(true);
      return;
    }
    void executeSendMessage(messageText, model, research);
  };

  const handleStop = () => {
    if (stopRef.current) stopRef.current.stopped = true;
  };

  const handleConfirmSwitchToCoder = () => {
    setIsCodingModalOpen(false);
    setSelectedModel('coder');
    if (pendingCoding) {
      const p = pendingCoding;
      setPendingCoding(null);
      void executeSendMessage(p.text, 'coder', p.research);
    }
  };

  const handleDeclineSwitchToCoder = () => {
    setIsCodingModalOpen(false);
    if (pendingCoding) {
      const p = pendingCoding;
      setPendingCoding(null);
      void executeSendMessage(p.text, selectedModel, p.research);
    }
  };

  const handleSwitchToCoderFromChat = (promptText?: string) => {
    setSelectedModel('coder');
    if (promptText) void executeSendMessage(promptText, 'coder');
  };

  // Buat ulang jawaban terakhir (tanpa menambah pesan pengguna baru)
  const handleRegenerate = () => {
    const chat = activeChatRef.current;
    if (!chat || busyRef.current || !userRef.current) return;
    let idx = -1;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;

    const authReady = ensurePuterSignedIn();
    authReady.catch(() => undefined);
    const working: ChatSession = { ...chat, messages: chat.messages.slice(0, idx + 1).filter((m) => !m.isStreaming) };
    void generate(working, selectedModel, false, authReady);
  };

  const handleDeleteChat = async (id: string) => {
    const user = userRef.current;
    if (!user) return;
    const remaining = chats.filter((c) => c.id !== id);
    setChats(remaining);
    if (activeChatRef.current?.id === id) {
      if (remaining.length > 0) await loadChat(remaining[0].id, user.username);
      else setActiveChat(null);
    }
    await StorageService.deleteChat(id, user.username);
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    const user = userRef.current;
    if (!user) return;
    setActiveChat((prev) => (prev && prev.id === id ? { ...prev, title: newTitle } : prev));
    await StorageService.updateChat(id, user.username, { title: newTitle });
    void refreshChats(user.username);
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    const user = userRef.current;
    if (!user) return;
    await StorageService.updateChat(id, user.username, { pinned: !currentPin });
    void refreshChats(user.username);
  };

  const handleClearHistory = async () => {
    const user = userRef.current;
    if (!user) return;
    handleStop();
    await StorageService.clearChats(user.username);
    setChats([]);
    setActiveChat(null);
  };

  const handleLogout = () => {
    handleStop();
    localStorage.removeItem('luna_username');
    setCurrentUser(null);
    setChats([]);
    setActiveChat(null);
    setErrorBanner(null);
    setIsSettingsModalOpen(false);
    setIsAuthModalOpen(true);
  };

  if (!authChecked) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#131314]" role="status" aria-label="Memuat">
        <LunaOrb size={0.6} />
      </div>
    );
  }

  const guestUser: UserProfile = {
    username: 'guest',
    displayName: 'Pengguna',
    avatarColor: '#6366f1',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#131314] text-[#e3e3e3] font-['Plus_Jakarta_Sans',sans-serif]">
      {currentUser && (
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onTogglePin={handleTogglePin}
          currentUser={currentUser}
          onOpenSettings={() => {
            setIsSettingsModalOpen(true);
            closeSidebarOnMobile();
          }}
          onLogout={handleLogout}
        />
      )}

      <main className="flex flex-1 flex-col h-full min-w-0 bg-[#131314] relative overflow-hidden">
        <header className="flex h-14 box-content shrink-0 items-center justify-between gap-3 border-b border-[#242628] px-3 sm:px-5 pt-[env(safe-area-inset-top)] bg-[#131314]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {currentUser && (
              <button
                onClick={() => setIsSidebarOpen((v) => !v)}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1d] text-neutral-300 hover:border-amber-400/40 hover:bg-[#222427] hover:text-white transition-all active:scale-95"
                title={isSidebarOpen ? 'Tutup bilah sisi' : 'Buka bilah sisi'}
                aria-label={isSidebarOpen ? 'Tutup bilah sisi' : 'Buka bilah sisi'}
                aria-expanded={isSidebarOpen}
              >
                <div className="flex flex-col justify-center items-start gap-1 w-4">
                  <span className={`h-[2px] w-4 rounded-full bg-current transition-colors ${isSidebarOpen ? 'bg-amber-400' : ''}`} />
                  <span className={`h-[2px] w-2.5 rounded-full bg-current transition-all ${isSidebarOpen ? 'bg-orange-400' : 'group-hover:w-4'}`} />
                  <span className={`h-[2px] w-3.5 rounded-full bg-current transition-colors ${isSidebarOpen ? 'bg-rose-400' : ''}`} />
                </div>
              </button>
            )}

            <div className="flex items-center gap-2.5 select-none min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#161719] border border-amber-500/30 shadow-[0_0_12px_rgba(255,191,72,0.18)]">
                <LunaOrb size={0.28} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold tracking-tight leading-tight bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                  Luna
                </span>
                <span className="text-[10px] text-amber-400/80 leading-none font-medium truncate">oleh Gimoy Studio</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {currentUser && (
              <button
                onClick={handleNewChat}
                className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1e1f20] border border-neutral-700/60 w-10 sm:w-auto sm:px-3.5 text-xs font-medium text-neutral-200 hover:bg-[#282a2c] hover:border-neutral-600 transition-colors active:scale-95"
                title="Obrolan baru"
                aria-label="Obrolan baru"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Obrolan baru</span>
              </button>
            )}

            {currentUser ? (
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex h-10 items-center gap-2 rounded-full pl-1 pr-1 sm:pr-3 hover:bg-[#1e1f20] transition-colors"
                title={`Pengaturan @${currentUser.username}`}
                aria-label="Pengaturan akun"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: currentUser.avatarColor || '#6366f1' }}
                >
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-xs font-medium text-neutral-300 max-w-[8rem] truncate">
                  {currentUser.displayName.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="h-10 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-4 text-xs font-bold text-neutral-950 hover:opacity-95 shadow-md transition-all active:scale-95"
              >
                Masuk
              </button>
            )}
          </div>
        </header>

        {errorBanner && (
          <div
            role="alert"
            className="fade-in mx-3 sm:mx-4 mt-3 flex items-start justify-between gap-3 rounded-xl bg-rose-950/70 border border-rose-800/80 px-3.5 py-2.5 text-xs text-rose-200 shadow-lg"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-px" />
              <span className="leading-relaxed [overflow-wrap:anywhere]">{errorBanner}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setErrorBanner(null);
                  handleRegenerate();
                }}
                className="flex h-8 items-center gap-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 px-2.5 text-xs font-medium text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Coba lagi</span>
              </button>
              <button
                onClick={() => setErrorBanner(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-300 hover:text-white hover:bg-rose-900/60"
                aria-label="Tutup pesan kesalahan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <ChatView
          messages={activeChat?.messages || []}
          currentUser={currentUser || guestUser}
          isLoading={isLoading}
          onSendPrompt={(p) => handleSendMessage(p)}
          onRegenerate={handleRegenerate}
          onSwitchToCoder={handleSwitchToCoderFromChat}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onStopGeneration={handleStop}
        />
      </main>

      <CodingSwitchModal
        isOpen={isCodingModalOpen}
        onConfirmSwitch={handleConfirmSwitchToCoder}
        onDecline={handleDeclineSwitchToCoder}
        currentModelName={selectedModel === 'pro' ? 'Luna Pro' : 'Luna (Standar)'}
        userPromptSnippet={pendingCoding ? splitAttachment(pendingCoding.text).text : undefined}
      />

      <AuthModal
        isOpen={isAuthModalOpen && !currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          if (!isDesktop()) setIsSidebarOpen(false);
        }}
      />

      {currentUser && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          currentUser={currentUser}
          onUpdateUser={(updated) => setCurrentUser(updated)}
          onClearHistory={handleClearHistory}
          totalChats={chats.length}
        />
      )}
    </div>
  );
}
