import { UserProfile, ChatSession, ChatSummary, ChatMessage } from '../types';

/**
 * Penyimpanan "local-first": localStorage adalah sumber utama (instan & tetap jalan saat server mati),
 * sedangkan server dipakai sebagai cadangan/sinkronisasi antar perangkat.
 * Saat membaca, data lokal dan server digabung (versi dengan updatedAt terbaru menang).
 */

const REQUEST_TIMEOUT_MS = 8000;

interface ApiResult {
  ok: boolean;
  status: number;
  data: any;
}

/** Mengembalikan null jika jaringan gagal atau respons bukan JSON (mis. hosting statis tanpa backend). */
async function request(path: string, init?: RequestInit): Promise<ApiResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init?.headers,
      signal: controller.signal,
    });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const clean = (u: string) => u.trim().toLowerCase();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Storage write error:', err);
  }
}

const getLocalUsers = () => readJson<Record<string, UserProfile>>('luna_all_users', {});
const saveLocalUsers = (u: Record<string, UserProfile>) => writeJson('luna_all_users', u);
const getLocalChats = (username: string) => readJson<Record<string, ChatSession>>(`luna_chats_${clean(username)}`, {});
const saveLocalChats = (username: string, c: Record<string, ChatSession>) => writeJson(`luna_chats_${clean(username)}`, c);

// Daftar chat yang sudah dihapus, agar tidak muncul lagi dari server bila penghapusan di server gagal
const getTombstones = (username: string) => new Set(readJson<string[]>(`luna_deleted_${clean(username)}`, []));
function addTombstones(username: string, ids: string[]) {
  const set = getTombstones(username);
  ids.forEach((id) => set.add(id));
  writeJson(`luna_deleted_${clean(username)}`, Array.from(set).slice(-500));
}

export function createDefaultUser(username: string, displayName?: string): UserProfile {
  const name = clean(username);
  const colors = ['#ffbf48', '#6366f1', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
  return {
    username: name,
    displayName: displayName?.trim() || name,
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    systemPrompt:
      'Anda adalah Luna, asisten AI cerdas yang dibuat oleh Gimoy Studio. Selalu jawab dengan ramah, terstruktur, dan informatif.',
  };
}

const toSummary = ({ id, username, title, model, pinned, createdAt, updatedAt }: ChatSession | ChatSummary): ChatSummary => ({
  id,
  username,
  title,
  model,
  pinned,
  createdAt,
  updatedAt,
});

const sortChats = (a: ChatSummary, b: ChatSummary) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt - a.updatedAt;
};

const stripTransient = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map(({ isStreaming, ...m }) => m as ChatMessage);

export function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export const StorageService = {
  async checkBackend(): Promise<boolean> {
    const res = await request('/api/health');
    return !!res?.ok;
  },

  // ---------- Akun ----------
  async login(username: string, displayName?: string, pin?: string): Promise<{ user: UserProfile; isOffline: boolean }> {
    const name = clean(username);
    let finalUser: UserProfile | null = null;
    let isOffline = false;

    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: name, displayName: displayName?.trim() || undefined, pin: pin?.trim() || undefined }),
    });

    if (res?.ok && res.data?.user) {
      finalUser = res.data.user;
    } else if (res && [400, 401, 403, 429].includes(res.status)) {
      throw new Error(res.data?.error || 'Gagal masuk');
    }

    // Server tidak terjangkau -> akun lokal supaya aplikasi tetap bisa dipakai
    if (!finalUser) {
      const users = getLocalUsers();
      const existing = users[name];
      finalUser = existing
        ? { ...existing, displayName: displayName?.trim() || existing.displayName, lastLoginAt: Date.now() }
        : createDefaultUser(name, displayName);
      isOffline = true;
    }

    const users = getLocalUsers();
    // pertahankan system prompt lokal bila server belum menyimpannya
    finalUser = { ...users[name], ...finalUser, systemPrompt: finalUser.systemPrompt ?? users[name]?.systemPrompt };
    users[name] = finalUser;
    saveLocalUsers(users);
    localStorage.setItem('luna_username', finalUser.username);
    return { user: finalUser, isOffline };
  },

  async getUser(username: string): Promise<UserProfile> {
    const name = clean(username);
    if (name === 'ardan' || name === 'guest_user') throw new Error('Akun uji coba telah dihapus');

    const res = await request(`/api/auth/me?username=${encodeURIComponent(name)}`);
    const users = getLocalUsers();
    if (res?.ok && res.data?.user) {
      const merged = { ...users[name], ...res.data.user };
      users[name] = merged;
      saveLocalUsers(users);
      return merged;
    }
    if (users[name]) return users[name];
    throw new Error('User tidak ditemukan');
  },

  async updateProfile(username: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const name = clean(username);
    const users = getLocalUsers();
    const updated = { ...(users[name] || createDefaultUser(name)), ...updates, username: name };
    users[name] = updated;
    saveLocalUsers(users);

    await request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        username: name,
        displayName: updates.displayName,
        avatarColor: updates.avatarColor,
        systemPrompt: updates.systemPrompt,
      }),
    });
    return updated;
  },

  // ---------- Chat ----------
  async listChats(username: string): Promise<ChatSummary[]> {
    const name = clean(username);
    const dead = getTombstones(name);
    const map = new Map<string, ChatSummary>();

    Object.values(getLocalChats(name)).forEach((c) => map.set(c.id, toSummary(c)));

    const res = await request(`/api/chats?username=${encodeURIComponent(name)}`);
    if (res?.ok && Array.isArray(res.data?.chats)) {
      for (const c of res.data.chats as ChatSummary[]) {
        const local = map.get(c.id);
        if (!local || c.updatedAt > local.updatedAt) map.set(c.id, toSummary(c));
      }
    }

    return Array.from(map.values())
      .filter((c) => !dead.has(c.id))
      .sort(sortChats);
  },

  async getChat(chatId: string, username: string): Promise<ChatSession | null> {
    const name = clean(username);
    if (getTombstones(name).has(chatId)) return null;

    const localChats = getLocalChats(name);
    const local = localChats[chatId] || null;

    const res = await request(`/api/chats/${encodeURIComponent(chatId)}?username=${encodeURIComponent(name)}`);
    const server: ChatSession | null = res?.ok && res.data?.chat ? res.data.chat : null;

    let chosen: ChatSession | null = local;
    if (server && (!local || server.updatedAt > local.updatedAt)) chosen = server;

    if (chosen) {
      localChats[chatId] = chosen;
      saveLocalChats(name, localChats);
      // Server kehilangan data (mis. reset serverless) -> kirim ulang dari lokal
      if (chosen === local && (!server || server.updatedAt < local!.updatedAt)) {
        void this.pushToServer(local!);
      }
    }
    return chosen;
  },

  async createChat(username: string, title?: string, model = 'standard'): Promise<ChatSession> {
    const name = clean(username);
    const chat: ChatSession = {
      id: newId('chat'),
      username: name,
      title: title?.trim() || 'Percakapan Baru',
      model,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    const chats = getLocalChats(name);
    chats[chat.id] = chat;
    saveLocalChats(name, chats);
    // Server akan dibuat otomatis saat pesan pertama disimpan (hindari request ganda)
    return chat;
  },

  /** Simpan ke localStorage saja (cepat; dipanggil sebelum & selama proses). */
  saveChatLocal(chat: ChatSession): ChatSession {
    const name = clean(chat.username);
    const saved: ChatSession = { ...chat, messages: stripTransient(chat.messages), updatedAt: Date.now() };
    const chats = getLocalChats(name);
    chats[saved.id] = saved;
    saveLocalChats(name, chats);
    return saved;
  },

  /** Simpan lokal lalu cadangkan ke server. */
  async saveChat(chat: ChatSession): Promise<ChatSession> {
    const saved = this.saveChatLocal(chat);
    await this.pushToServer(saved);
    return saved;
  },

  async pushToServer(chat: ChatSession): Promise<void> {
    await request(`/api/chats/${encodeURIComponent(chat.id)}/messages`, {
      method: 'PUT',
      body: JSON.stringify({
        username: chat.username,
        title: chat.title,
        model: chat.model,
        pinned: chat.pinned,
        createdAt: chat.createdAt,
        messages: stripTransient(chat.messages),
      }),
    });
  },

  async updateChat(
    chatId: string,
    username: string,
    updates: Partial<Pick<ChatSession, 'title' | 'pinned' | 'model'>>
  ): Promise<void> {
    const name = clean(username);
    const chats = getLocalChats(name);
    if (chats[chatId]) {
      chats[chatId] = { ...chats[chatId], ...updates, updatedAt: Date.now() };
      saveLocalChats(name, chats);
    }
    const res = await request(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'PUT',
      body: JSON.stringify({ username: name, ...updates }),
    });
    // Chat belum ada di server -> unggah lengkap
    if (res?.status === 404 && chats[chatId]) await this.pushToServer(chats[chatId]);
  },

  async deleteChat(chatId: string, username: string): Promise<void> {
    const name = clean(username);
    addTombstones(name, [chatId]);
    const chats = getLocalChats(name);
    delete chats[chatId];
    saveLocalChats(name, chats);
    await request(`/api/chats/${encodeURIComponent(chatId)}?username=${encodeURIComponent(name)}`, { method: 'DELETE' });
  },

  async clearChats(username: string): Promise<void> {
    const name = clean(username);
    const all = await this.listChats(name);
    addTombstones(name, all.map((c) => c.id));
    saveLocalChats(name, {});
    await request(`/api/chats?username=${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
};
