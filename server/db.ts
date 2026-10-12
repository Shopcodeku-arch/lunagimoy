import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  model?: string;
}

export interface ChatSession {
  id: string;
  username: string;
  title: string;
  model: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface UserProfile {
  username: string;
  displayName: string;
  avatarColor: string;
  /** scrypt hash in the form "salt:hash" */
  pinHash?: string;
  /** legacy plain-text PIN (migrated to pinHash on next successful login) */
  pin?: string;
  createdAt: number;
  lastLoginAt: number;
  systemPrompt?: string;
}

export type PublicUser = Omit<UserProfile, 'pin' | 'pinHash'> & { hasPin: boolean };

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPinHash(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export interface DatabaseSchema {
  users: Record<string, UserProfile>;
  chats: Record<string, ChatSession>;
}

// Safely resolve the database file path (supports Vercel serverless /tmp and local)
function resolveDbPaths(): { dir: string; file: string; seedFile?: string } {
  const rootDataDir = path.resolve(process.cwd(), 'data');
  const rootDbFile = path.join(rootDataDir, 'database.json');

  // If running in Vercel or AWS Lambda, the root filesystem is strictly read-only
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'luna-data');
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'database.json'),
      seedFile: fs.existsSync(rootDbFile) ? rootDbFile : undefined,
    };
  }

  // Attempt local write check
  try {
    if (!fs.existsSync(rootDataDir)) {
      fs.mkdirSync(rootDataDir, { recursive: true });
    }
    const testFile = path.join(rootDataDir, '.writable_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return {
      dir: rootDataDir,
      file: rootDbFile,
    };
  } catch {
    // Local data dir is read-only, fallback to /tmp
    const tmpDir = path.join('/tmp', 'luna-data');
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'database.json'),
      seedFile: fs.existsSync(rootDbFile) ? rootDbFile : undefined,
    };
  }
}

class Database {
  private data: DatabaseSchema = { users: {}, chats: {} };
  private initialized = false;
  private paths = resolveDbPaths();

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    try {
      if (!fs.existsSync(this.paths.dir)) {
        try {
          fs.mkdirSync(this.paths.dir, { recursive: true });
        } catch (mkdirErr) {
          console.warn('Could not create directory for db:', mkdirErr);
        }
      }

      // 1. Try reading from active file
      if (fs.existsSync(this.paths.file)) {
        const raw = fs.readFileSync(this.paths.file, 'utf-8');
        this.data = JSON.parse(raw);
      } else if (this.paths.seedFile && fs.existsSync(this.paths.seedFile)) {
        // 2. Try seeding from read-only bundled repo file
        const raw = fs.readFileSync(this.paths.seedFile, 'utf-8');
        this.data = JSON.parse(raw);
        this.save();
      } else {
        this.seedInitialData();
        this.save();
      }

      if (!this.data.users) this.data.users = {};
      if (!this.data.chats) this.data.chats = {};
      this.initialized = true;
    } catch (err) {
      console.warn('Database initialization warning (using in-memory store):', err);
      this.data = { users: {}, chats: {} };
      this.seedInitialData();
      this.initialized = true;
    }
  }

  private seedInitialData() {
    // No default or trial accounts - users create their own new accounts
    this.data.users = {};
    this.data.chats = {};
  }

  private save() {
    try {
      if (!fs.existsSync(this.paths.dir)) {
        fs.mkdirSync(this.paths.dir, { recursive: true });
      }
      const tempPath = `${this.paths.file}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.paths.file);
    } catch (err) {
      // In serverless / read-only environment, keep in memory without throwing
      console.warn('Database save warning (in-memory state preserved):', (err as any)?.message);
    }
  }

  // --- User Operations ---
  public getUser(username: string): UserProfile | null {
    if (!username) return null;
    const key = username.trim().toLowerCase();
    return this.data.users[key] || null;
  }

  public toPublicUser(user: UserProfile): PublicUser {
    const { pin, pinHash, ...rest } = user;
    return { ...rest, hasPin: !!(pinHash || pin) };
  }

  public userHasPin(user: UserProfile): boolean {
    return !!(user.pinHash || user.pin);
  }

  /** Verifies a PIN, transparently migrating legacy plain-text PINs to hashes. */
  public verifyUserPin(user: UserProfile, pin: string): boolean {
    if (user.pinHash) return checkPinHash(pin, user.pinHash);
    if (user.pin) {
      const ok = user.pin === pin;
      if (ok) {
        this.data.users[user.username].pinHash = hashPin(pin);
        delete this.data.users[user.username].pin;
        this.save();
      }
      return ok;
    }
    return true;
  }

  public createUser(username: string, displayName?: string, pin?: string): UserProfile {
    const key = username.trim().toLowerCase();
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6'];
    const user: UserProfile = {
      username: key,
      displayName: displayName?.trim() || key,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      pinHash: pin ? hashPin(pin) : undefined,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    this.data.users[key] = user;
    this.save();
    return user;
  }

  public touchUser(username: string, displayName?: string): UserProfile | null {
    const key = username.trim().toLowerCase();
    const user = this.data.users[key];
    if (!user) return null;
    user.lastLoginAt = Date.now();
    if (displayName?.trim()) user.displayName = displayName.trim();
    this.save();
    return user;
  }

  public updateUser(username: string, updates: Partial<UserProfile>): UserProfile | null {
    const key = username.trim().toLowerCase();
    if (!this.data.users[key]) return null;
    this.data.users[key] = {
      ...this.data.users[key],
      ...updates,
      username: key, // preserve key
    };
    this.save();
    return this.data.users[key];
  }

  public listAllUsernames(): string[] {
    return Object.keys(this.data.users);
  }

  // --- Chat Operations ---
  public listUserChats(username: string): Omit<ChatSession, 'messages'>[] {
    const key = username.trim().toLowerCase();
    return Object.values(this.data.chats)
      .filter((c) => c.username === key)
      .map(({ id, username, title, model, pinned, createdAt, updatedAt }) => ({
        id,
        username,
        title,
        model,
        pinned,
        createdAt,
        updatedAt,
      }))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
  }

  public getChat(chatId: string, username: string): ChatSession | null {
    const key = username.trim().toLowerCase();
    const chat = this.data.chats[chatId];
    if (!chat || chat.username !== key) return null;
    return chat;
  }

  public createChat(username: string, title?: string, model = 'standard', customId?: string): ChatSession | null {
    const key = username.trim().toLowerCase();
    const id = customId || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existing = this.data.chats[id];
    if (existing) return existing.username === key ? existing : null;
    const newChat: ChatSession = {
      id,
      username: key,
      title: title?.trim() || 'Percakapan Baru',
      model,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    this.data.chats[id] = newChat;
    this.save();
    return newChat;
  }

  public updateChat(
    chatId: string,
    username: string,
    updates: Partial<Pick<ChatSession, 'title' | 'pinned' | 'model'>>
  ): ChatSession | null {
    const key = username.trim().toLowerCase();
    const chat = this.data.chats[chatId];
    if (!chat || chat.username !== key) return null;

    if (updates.title !== undefined) chat.title = updates.title.trim();
    if (updates.pinned !== undefined) chat.pinned = updates.pinned;
    if (updates.model !== undefined) chat.model = updates.model;
    chat.updatedAt = Date.now();

    this.save();
    return chat;
  }

  /** Create-or-replace a chat with the full message list sent by the client. */
  public upsertChat(
    chatId: string,
    username: string,
    data: {
      title?: string;
      model?: string;
      pinned?: boolean;
      createdAt?: number;
      messages: Array<Partial<ChatMessage>>;
    }
  ): ChatSession | null {
    const key = username.trim().toLowerCase();
    let chat = this.data.chats[chatId];
    if (chat && chat.username !== key) return null;

    if (!chat) {
      chat = {
        id: chatId,
        username: key,
        title: 'Percakapan Baru',
        model: 'standard',
        pinned: false,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      this.data.chats[chatId] = chat;
    }

    if (data.title?.trim()) chat.title = data.title.trim().substring(0, 120);
    if (data.model) chat.model = data.model;
    if (typeof data.pinned === 'boolean') chat.pinned = data.pinned;

    chat.messages = data.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-500)
      .map((m, i) => ({
        id: typeof m.id === 'string' && m.id ? m.id : `msg_${Date.now()}_${i}`,
        role: m.role as 'user' | 'assistant',
        content: (m.content as string).slice(0, 200_000),
        createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
        model: typeof m.model === 'string' ? m.model : undefined,
      }));
    chat.updatedAt = Date.now();

    if (chat.title === 'Percakapan Baru') {
      const firstUser = chat.messages.find((m) => m.role === 'user');
      if (firstUser) {
        const line = firstUser.content.trim().split('\n')[0].substring(0, 38);
        if (line) chat.title = line;
      }
    }

    this.save();
    return chat;
  }

  public addMessage(
    chatId: string,
    username: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>
  ): ChatMessage | null {
    const key = username.trim().toLowerCase();
    const chat = this.data.chats[chatId];
    if (!chat || chat.username !== key) return null;

    const fullMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: message.role,
      content: message.content,
      createdAt: Date.now(),
      model: message.model,
    };

    chat.messages.push(fullMessage);
    chat.updatedAt = Date.now();

    if (chat.title === 'Percakapan Baru' && message.role === 'user') {
      const summary = message.content.trim().split('\n')[0].substring(0, 38);
      chat.title = summary.length > 0 ? summary : 'Percakapan Baru';
    }

    this.save();
    return fullMessage;
  }

  public deleteChat(chatId: string, username: string): boolean {
    const key = username.trim().toLowerCase();
    const chat = this.data.chats[chatId];
    if (chat && chat.username !== key) return false;

    if (this.data.chats[chatId]) {
      delete this.data.chats[chatId];
      this.save();
    }
    return true;
  }

  public clearUserChats(username: string): number {
    const key = username.trim().toLowerCase();
    let count = 0;
    for (const [id, chat] of Object.entries(this.data.chats)) {
      if (chat.username === key) {
        delete this.data.chats[id];
        count++;
      }
    }
    this.save();
    return count;
  }
}

export const db = new Database();
