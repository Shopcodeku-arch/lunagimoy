import { ChatMessage, ModelVariant } from '../types';

/**
 * Luna memakai Puter.js (https://js.puter.com/v2/) langsung dari browser.
 * Tidak ada API key di kode; pengguna masuk dengan akun Puter saat pertama kali memakai AI.
 */
export const PUTER_MODEL = 'gpt-5.6-luna';
const MAX_CONTEXT_MESSAGES = 12;

export class LunaError extends Error {
  partial: string;
  constructor(message: string, partial = '') {
    super(message);
    this.name = 'LunaError';
    this.partial = partial;
  }
}

function getPuter(): any | null {
  return typeof window !== 'undefined' ? (window as any).puter ?? null : null;
}

async function waitForPuter(timeoutMs = 4000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = getPuter();
    if (p?.ai?.chat) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new LunaError(
    'Layanan AI (Puter.js) tidak dapat dimuat. Periksa koneksi internet atau matikan pemblokir iklan untuk situs ini, lalu coba lagi.'
  );
}

/**
 * Panggil SINKRON dari handler klik/Enter agar jendela login Puter tidak diblokir browser.
 * Mengembalikan promise yang resolve setelah pengguna masuk (atau langsung jika sudah masuk).
 */
export function ensurePuterSignedIn(): Promise<void> {
  const p = getPuter();
  try {
    if (!p?.auth || typeof p.auth.signIn !== 'function') return Promise.resolve();
    if (typeof p.auth.isSignedIn === 'function' && p.auth.isSignedIn()) return Promise.resolve();
    return Promise.resolve(p.auth.signIn())
      .then(() => undefined)
      .catch((e: unknown) => {
        throw new LunaError(describeError(e, 'Login Puter dibatalkan. Anda perlu masuk ke Puter agar Luna dapat menjawab.'));
      });
  } catch {
    return Promise.resolve();
  }
}

function describeError(e: unknown, fallback = 'Luna gagal menjawab. Silakan coba lagi.'): string {
  const err: any = e;
  const code = err?.error?.code ?? err?.code ?? '';
  const msg: string = err?.error?.message ?? err?.message ?? (typeof err === 'string' ? err : '');
  if (code === 'auth_canceled' || /cancel/i.test(String(code)) || /auth.*cancel/i.test(msg)) {
    return 'Login Puter dibatalkan. Anda perlu masuk ke Puter agar Luna dapat menjawab.';
  }
  if (/popup/i.test(msg)) {
    return 'Jendela login Puter diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi.';
  }
  if (/insufficient|quota|limit|usage/i.test(`${code} ${msg}`)) {
    return 'Kuota akun Puter Anda untuk model ini sedang habis. Coba lagi nanti.';
  }
  return msg || fallback;
}

function extractText(part: any): string {
  if (part == null) return '';
  if (typeof part === 'string') return part;
  if (typeof part.text === 'string') return part.text;
  const c = part?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x: any) => (typeof x === 'string' ? x : x?.text ?? '')).join('');
  if (typeof part.toString === 'function' && part.toString !== Object.prototype.toString) {
    const s = part.toString();
    if (s && s !== '[object Object]') return s;
  }
  return '';
}

export function buildSystemPrompt(modelVariant: ModelVariant, customPrompt?: string, research?: boolean): string {
  let prompt =
    'Identitas Utama: Nama Anda adalah Luna. Anda adalah sebuah asisten kecerdasan buatan cerdas yang dibuat dan dikembangkan oleh Gimoy Studio. ' +
    'Bila ditanya tentang siapa pembuat/pencipta Anda atau identitas Anda, selalu nyatakan dengan jelas dan ramah bahwa Anda adalah Luna yang dibuat oleh Gimoy Studio. ' +
    'Berikan jawaban yang terstruktur, informatif, sopan, dan jelas. Jawab dalam bahasa yang digunakan pengguna.\n\n' +
    '[HIGHLIGHT POIN & JAWABAN PENTING]: Setiap kali Anda menjawab pertanyaan pengguna, tandai kata-kata kunci utama, inti persoalan, langkah penting, atau poin-poin paling penting yang langsung menjawab pertanyaan pengguna menggunakan format tebal (**poin penting** atau **kata kunci penting**). ' +
    'Sistem antarmuka pengguna memiliki fitur khusus "Background Putih Memanjang" otomatis yang akan membuat latar belakang putih memanjang di belakang teks tebal tersebut agar pengguna langsung melihat inti jawaban dengan jelas.';

  if (modelVariant === 'coder') {
    prompt +=
      '\n\n[MODE LUNA CODER AKTIF]: Anda adalah Luna Coder, spesialis rekayasa perangkat lunak dan pemrograman tingkat tinggi yang dibuat oleh Gimoy Studio. ' +
      'Dalam mode ini, Anda memiliki izin penuh untuk membuat, menulis, menganalisis, dan memperbaiki kode pemrograman (TypeScript, JavaScript, Python, C++, HTML/CSS, SQL, dsb.). Tulis kode dengan rapi, efisien, dan berikan penjelasan yang jelas.';
  } else {
    prompt +=
      '\n\n[ATURAN FILTER KODE MUTLAK - DILARANG MENULIS KODE]: ' +
      'Anda saat ini berada dalam mode NON-CODER. Anda DILARANG KERAS membuat, menulis, menyusun, melengkapi, atau menampilkan kode pemrograman atau skrip apa pun (termasuk tag code block ```). ' +
      'JIKA pengguna meminta Anda untuk membuat kode, menulis script, membuat fungsi, memprogram, atau menghasilkan kode apa pun: ' +
      'Anda WAJIB MENOLAK secara sopan dan menjelaskan: ' +
      '"Saat ini model Luna tidak mendukung coding, apakah anda ingin beralih ke mode bahasa khusus coding?" ' +
      'Jangan sertakan cuplikan kode pemrograman apa pun!';
  }

  if (modelVariant === 'pro') {
    prompt += ' Fokus Anda adalah penalaran analitis mendalam, analisis logika, dan eksplorasi komprehensif non-kode.';
  }

  if (research) {
    prompt +=
      '\n\n[MODE ANALISIS MENDALAM]: Pengguna meminta jawaban yang lebih rinci. Berikan penjelasan komprehensif, terstruktur, lengkap dengan alasan, contoh, dan kesimpulan singkat.';
  }

  if (customPrompt?.trim()) {
    prompt += `\nInstruksi Tambahan Pengguna: ${customPrompt.trim()}`;
  }
  return prompt;
}

export interface StreamLunaParams {
  history: Pick<ChatMessage, 'role' | 'content'>[];
  modelVariant: ModelVariant;
  customPrompt?: string;
  research?: boolean;
  /** Dipanggil tiap loop; return true untuk menghentikan streaming. */
  shouldStop: () => boolean;
  /** Menerima teks kumulatif. */
  onText: (fullText: string) => void;
}

/** Mengirim percakapan ke Puter (gpt-5.6-luna) dan men-stream jawabannya. */
export async function streamLuna(params: StreamLunaParams): Promise<string> {
  const puter = await waitForPuter();

  const context = params.history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: 'system', content: buildSystemPrompt(params.modelVariant, params.customPrompt, params.research) },
    ...context,
  ];

  let full = '';
  try {
    const resp = await puter.ai.chat(messages, { model: PUTER_MODEL, stream: true });
    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (params.shouldStop()) break;
        const t = extractText(part);
        if (t) {
          full += t;
          params.onText(full);
        }
      }
    } else {
      full = extractText(resp);
      if (full) params.onText(full);
    }
  } catch (err) {
    if (params.shouldStop()) return full;
    if (full) throw new LunaError(describeError(err), full);

    // Belum ada teks sama sekali: coba sekali lagi tanpa streaming
    try {
      const resp = await puter.ai.chat(messages, { model: PUTER_MODEL });
      full = extractText(resp);
      if (full) params.onText(full);
    } catch (err2) {
      throw new LunaError(describeError(err2));
    }
  }

  if (!full.trim() && !params.shouldStop()) {
    throw new LunaError('Luna tidak mengirim jawaban. Silakan coba lagi.');
  }
  return full;
}
