export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  model?: string;
  isStreaming?: boolean;
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

export interface ChatSummary {
  id: string;
  username: string;
  title: string;
  model: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  username: string;
  displayName: string;
  avatarColor: string;
  hasPin?: boolean;
  createdAt: number;
  lastLoginAt: number;
  systemPrompt?: string;
}

export type ModelVariant = 'standard' | 'pro' | 'coder';

export interface ModelInfo {
  id: ModelVariant;
  name: string;
  badge: string;
  description: string;
  iconName: string;
}

export interface SendOptions {
  /** Minta jawaban lebih rinci (tidak mengubah teks pesan yang tampil). */
  research?: boolean;
  forceModel?: ModelVariant;
}
