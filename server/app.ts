import express from 'express';
import { db } from './db.ts';

/**
 * Server Luna hanya menyimpan akun & riwayat obrolan.
 * Pemanggilan AI dilakukan langsung dari browser lewat Puter.js
 * (lihat src/services/ai.ts), sehingga tidak ada API key di server.
 */
const app = express();

app.use(express.json({ limit: '10mb' }));

// CORS: agar domain preview / Vercel tidak terblokir
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const USERNAME_RE = /^[a-z0-9_]{1,32}$/;
const CHAT_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const PIN_RE = /^\d{4,6}$/;
const BLOCKED_USERNAMES = new Set(['ardan', 'guest_user']);

/** Normalisasi & validasi username; mengembalikan null jika tidak valid. */
function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().toLowerCase();
  return USERNAME_RE.test(clean) ? clean : null;
}

// Pembatas percobaan PIN salah (5x / 10 menit per username)
const failedPins = new Map<string, { count: number; resetAt: number }>();
const MAX_PIN_FAILS = 5;
const PIN_WINDOW_MS = 10 * 60 * 1000;

function isPinLocked(username: string): boolean {
  const entry = failedPins.get(username);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedPins.delete(username);
    return false;
  }
  return entry.count >= MAX_PIN_FAILS;
}

function registerPinFailure(username: string) {
  const entry = failedPins.get(username);
  if (!entry || Date.now() > entry.resetAt) {
    failedPins.set(username, { count: 1, resetAt: Date.now() + PIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// --- Health Check ---
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), databaseReady: true });
});

// --- Auth ---
app.post(['/api/auth/login', '/auth/login'], (req, res) => {
  try {
    const { username, displayName, pin } = req.body || {};
    const clean = cleanUsername(username);
    if (!clean) {
      return res
        .status(400)
        .json({ error: 'Username wajib diisi (huruf kecil, angka, atau underscore, maks. 32 karakter)' });
    }
    if (BLOCKED_USERNAMES.has(clean)) {
      return res
        .status(400)
        .json({ error: 'Akun uji coba telah dinonaktifkan. Silakan buat akun baru Anda sendiri.' });
    }

    const pinValue = typeof pin === 'string' && pin.trim() ? pin.trim() : undefined;
    if (pinValue && !PIN_RE.test(pinValue)) {
      return res.status(400).json({ error: 'PIN harus 4–6 digit angka' });
    }

    const existing = db.getUser(clean);

    if (existing) {
      if (db.userHasPin(existing)) {
        if (isPinLocked(clean)) {
          return res.status(429).json({ error: 'Terlalu banyak percobaan PIN salah. Coba lagi dalam 10 menit.' });
        }
        if (!pinValue) {
          return res.status(401).json({ error: 'Akun ini dilindungi PIN. Masukkan PIN Anda.' });
        }
        if (!db.verifyUserPin(existing, pinValue)) {
          registerPinFailure(clean);
          return res.status(401).json({ error: 'PIN tidak sesuai' });
        }
        failedPins.delete(clean);
      }
      const user = db.touchUser(clean, typeof displayName === 'string' ? displayName : undefined)!;
      return res.json({ success: true, user: db.toPublicUser(user) });
    }

    const created = db.createUser(clean, typeof displayName === 'string' ? displayName : undefined, pinValue);
    res.json({ success: true, user: db.toPublicUser(created) });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal melakukan login' });
  }
});

app.get(['/api/auth/me', '/auth/me'], (req, res) => {
  try {
    const clean = cleanUsername(req.query.username);
    if (!clean) {
      return res.status(400).json({ error: 'Username parameter diperlukan' });
    }
    if (BLOCKED_USERNAMES.has(clean)) {
      return res.status(404).json({ error: 'Akun uji coba telah dinonaktifkan' });
    }
    const user = db.getUser(clean);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ success: true, user: db.toPublicUser(user) });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Gagal mengambil data user' });
  }
});

app.put(['/api/auth/profile', '/auth/profile'], (req, res) => {
  try {
    const { username, displayName, avatarColor, systemPrompt } = req.body || {};
    const clean = cleanUsername(username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    const updates: Record<string, string> = {};
    if (typeof displayName === 'string' && displayName.trim()) updates.displayName = displayName.trim().slice(0, 60);
    if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) updates.avatarColor = avatarColor;
    // string kosong diperbolehkan agar pengguna bisa menghapus system prompt
    if (typeof systemPrompt === 'string') updates.systemPrompt = systemPrompt.slice(0, 2000);

    const updated = db.updateUser(clean, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ success: true, user: db.toPublicUser(updated) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// --- Chat History ---
app.get(['/api/chats', '/chats'], (req, res) => {
  try {
    const clean = cleanUsername(req.query.username);
    if (!clean) {
      return res.status(400).json({ error: 'Username parameter diperlukan' });
    }
    res.json({ success: true, chats: db.listUserChats(clean) });
  } catch (err) {
    console.error('List chats error:', err);
    res.status(500).json({ error: 'Gagal mengambil riwayat chat' });
  }
});

app.post(['/api/chats', '/chats'], (req, res) => {
  try {
    const { username, title, model, id } = req.body || {};
    const clean = cleanUsername(username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    if (id !== undefined && (typeof id !== 'string' || !CHAT_ID_RE.test(id))) {
      return res.status(400).json({ error: 'ID chat tidak valid' });
    }
    const chat = db.createChat(
      clean,
      typeof title === 'string' ? title : undefined,
      typeof model === 'string' ? model : undefined,
      id
    );
    if (!chat) {
      return res.status(409).json({ error: 'ID chat sudah dipakai' });
    }
    res.json({ success: true, chat });
  } catch (err) {
    console.error('Create chat error:', err);
    res.status(500).json({ error: 'Gagal membuat sesi chat' });
  }
});

app.get(['/api/chats/:id', '/chats/:id'], (req, res) => {
  try {
    const clean = cleanUsername(req.query.username);
    if (!clean) {
      return res.status(400).json({ error: 'Username parameter diperlukan' });
    }
    const chat = db.getChat(req.params.id, clean);
    if (!chat) {
      return res.status(404).json({ error: 'Sesi percakapan tidak ditemukan' });
    }
    res.json({ success: true, chat });
  } catch (err) {
    console.error('Get chat error:', err);
    res.status(500).json({ error: 'Gagal memuat detail chat' });
  }
});

app.put(['/api/chats/:id', '/chats/:id'], (req, res) => {
  try {
    const { username, title, pinned, model } = req.body || {};
    const clean = cleanUsername(username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    const updated = db.updateChat(req.params.id, clean, {
      title: typeof title === 'string' ? title : undefined,
      pinned: typeof pinned === 'boolean' ? pinned : undefined,
      model: typeof model === 'string' ? model : undefined,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Sesi chat tidak ditemukan' });
    }
    res.json({ success: true, chat: updated });
  } catch (err) {
    console.error('Update chat error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status chat' });
  }
});

// Simpan seluruh isi percakapan (dibuat otomatis bila belum ada di server)
app.put(['/api/chats/:id/messages', '/chats/:id/messages'], (req, res) => {
  try {
    const { username, messages, title, model, pinned, createdAt } = req.body || {};
    const clean = cleanUsername(username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    if (!CHAT_ID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'ID chat tidak valid' });
    }
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Daftar pesan tidak valid' });
    }
    const chat = db.upsertChat(req.params.id, clean, { messages, title, model, pinned, createdAt });
    if (!chat) {
      return res.status(409).json({ error: 'ID chat sudah dipakai pengguna lain' });
    }
    res.json({ success: true, chat: { ...chat, messages: undefined } });
  } catch (err) {
    console.error('Save messages error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pesan' });
  }
});

app.delete(['/api/chats/:id', '/chats/:id'], (req, res) => {
  try {
    const clean = cleanUsername(req.query.username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    db.deleteChat(req.params.id, clean);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete chat error:', err);
    res.status(500).json({ error: 'Gagal menghapus percakapan' });
  }
});

app.delete(['/api/chats', '/chats'], (req, res) => {
  try {
    const clean = cleanUsername(req.query.username);
    if (!clean) {
      return res.status(400).json({ error: 'Username diperlukan' });
    }
    const count = db.clearUserChats(clean);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Clear chats error:', err);
    res.status(500).json({ error: 'Gagal menghapus riwayat chat' });
  }
});

export default app;
