import React, { useState } from 'react';
import { Marked } from 'marked';
import { Check, Copy, Terminal } from 'lucide-react';
import { copyText } from '../utils/clipboard';

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

/**
 * Instance marked khusus dengan sanitasi:
 * - HTML mentah dari AI/pengguna di-escape (mencegah XSS lewat dangerouslySetInnerHTML)
 * - Link hanya http(s)/mailto/tel dan selalu dibuka di tab baru
 * - Gambar ditampilkan sebagai tautan (tidak memuat resource eksternal otomatis)
 */
const safeMarked = new Marked({ breaks: true, gfm: true });
safeMarked.use({
  renderer: {
    html({ text }: { text: string }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: any) {
      const inner = (this as any).parser.parseInline(tokens);
      if (!href || !SAFE_URL.test(href.trim())) return inner;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${t} target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;
    },
    image({ href, text }: any) {
      const label = escapeHtml(text || 'gambar');
      if (!href || !SAFE_URL.test(href.trim())) return label;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    },
  },
});

export function renderSafeMarkdown(md: string): string {
  const html = safeMarked.parse(md) as string;
  // Bungkus tabel agar bisa digeser horizontal di layar kecil
  return html.replace(/<table>/g, '<div class="md-table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  userQuestion?: string;
}

const STOPWORDS = new Set([
  'apa', 'apakah', 'siapa', 'bagaimana', 'kenapa', 'mengapa', 'kapan', 'dimana',
  'tolong', 'coba', 'bisa', 'mohon', 'jelaskan', 'buatkan', 'buat', 'cara', 'tips',
  'trik', 'tutorial', 'yang', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'dan',
  'atau', 'ini', 'itu', 'tersebut', 'adalah', 'yaitu', 'yakni', 'saya', 'aku',
  'kamu', 'anda', 'luna', 'tentang', 'seperti', 'ada', 'tidak', 'bukan', 'dalam',
  'akan', 'sudah', 'telah', 'sedang', 'harus', 'lagi', 'saja', 'jika', 'bila',
  'halo', 'hai', 'hello', 'terima', 'kasih', 'makasih', 'gimoy', 'studio',
  'what', 'how', 'why', 'when', 'where', 'who', 'please', 'can', 'the', 'a',
  'an', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are'
]);

function extractQuestionKeywords(question?: string): string[] {
  if (!question) return [];
  const words = question
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/** Menebalkan kemunculan pertama kata kunci pada baris teks biasa (bukan kode, tautan, judul, atau tabel). */
function highlightKeywordSafe(text: string, keyword: string): string {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alreadyBold = new RegExp(`\\*\\*[^\\*]*${escaped}[^\\*]*\\*\\*`, 'i');
  if (alreadyBold.test(text)) return text;

  const wordRegex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped})(?![\\p{L}\\p{N}_])`, 'iu');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(#{1,6}\s|\||>)/.test(line) || /[`]|\]\(|https?:|\*\*|==/.test(line)) continue;
    if (wordRegex.test(line)) {
      lines[i] = line.replace(wordRegex, '$1**$2**');
      break;
    }
  }
  return lines.join('\n');
}

const MarkdownRendererBase: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  userQuestion,
}) => {
  return (
    <div
      className={`relative text-[15px] leading-relaxed markdown-body break-words [overflow-wrap:anywhere] max-w-full ${
        isStreaming ? 'streaming-mode' : 'finished-mode'
      }`}
    >
      <CustomMarkdownView
        content={content}
        isStreaming={isStreaming}
        userQuestion={userQuestion}
      />
    </div>
  );
};

export const MarkdownRenderer = React.memo(MarkdownRendererBase);

// Component to handle code blocks in dedicated styled bubbles with copy buttons and streaming awareness
function CustomMarkdownView({
  content,
  isStreaming,
  userQuestion,
}: {
  content: string;
  isStreaming: boolean;
  userQuestion?: string;
}) {
  // If there's an unclosed code block during streaming, auto-close it virtually for layout stability
  let normalizedContent = content;
  const fenceMatches = (content.match(/```/g) || []).length;
  const hasUnclosedFence = fenceMatches % 2 !== 0;

  if (hasUnclosedFence) {
    normalizedContent = content + '\n```';
  }

  const parts: Array<{
    type: 'text' | 'code';
    text: string;
    language?: string;
    isStreamingCode?: boolean;
  }> = [];

  const regex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalizedContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: normalizedContent.substring(lastIndex, match.index),
      });
    }

    const isLastPartAndUnclosed =
      hasUnclosedFence && regex.lastIndex >= normalizedContent.length;

    parts.push({
      type: 'code',
      language: match[1]?.trim() || 'code',
      text: match[2],
      isStreamingCode: isLastPartAndUnclosed && isStreaming,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < normalizedContent.length) {
    parts.push({
      type: 'text',
      text: normalizedContent.substring(lastIndex),
    });
  }

  const questionKeywords = extractQuestionKeywords(userQuestion);

  return (
    <div className="space-y-3 max-w-full overflow-hidden">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return (
            <CodeBubble
              key={`code_block_${idx}`}
              language={part.language || 'code'}
              code={part.text}
              isStreaming={part.isStreamingCode}
            />
          );
        }

        let textToProcess = part.text;
        const isLastTextPart = idx === parts.length - 1;

        // Virtual-close bold (**) or highlight (==) during streaming for immediate live styling
        if (isStreaming && isLastTextPart) {
          const boldCount = (textToProcess.match(/\*\*/g) || []).length;
          if (boldCount % 2 !== 0) {
            textToProcess += '**';
          }
          const eqCount = (textToProcess.match(/==/g) || []).length;
          if (eqCount % 2 !== 0) {
            textToProcess += '==';
          }
        }

        // Dukung sintaks ==teks== (disamakan dengan **teks** agar lolos sanitasi HTML)
        textToProcess = textToProcess.replace(/==([^=\n]+)==/g, '**$1**');

        // Highlight key topic keywords from user's question if present in text
        if (questionKeywords.length > 0) {
          for (const kw of questionKeywords) {
            textToProcess = highlightKeywordSafe(textToProcess, kw);
          }
        }

        const html = renderSafeMarkdown(textToProcess);

        return (
          <div key={`text_part_${idx}`} className="relative max-w-full">
            <div
              className="max-w-full break-words [overflow-wrap:anywhere]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {isStreaming && isLastTextPart && (
              <span className="typing-cursor" aria-hidden="true" />
            )}
          </div>
        );
      })}

      {/* If entirely empty but streaming, show the glowing cursor */}
      {parts.length === 0 && isStreaming && (
        <span className="typing-cursor" aria-hidden="true" />
      )}
    </div>
  );
}

// Dedicated interactive code bubble requested by user with smooth copy action
function CodeBubble({
  language,
  code,
  isStreaming,
}: {
  language: string;
  code: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const cleanCode = code.trimEnd();
  const lineCount = cleanCode ? cleanCode.split('\n').length : 1;

  const handleCopy = async () => {
    if (await copyText(cleanCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3 max-w-full overflow-hidden rounded-2xl border border-neutral-700/80 bg-[#0d1117] shadow-xl hover:border-neutral-600 transition-colors">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#161b22] px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-neutral-800/90 px-2 py-0.5 text-indigo-300 font-mono text-[11px] font-semibold tracking-wide uppercase">
            <Terminal className="h-3 w-3 text-indigo-400" />
            <span>{language}</span>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
            · {lineCount} baris
          </span>
          {isStreaming && (
            <span className="text-[11px] text-amber-400 font-mono inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              menulis kode...
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 transition-colors border border-neutral-700/60 active:scale-95"
          title="Salin kode"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-neutral-400" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto text-[13.5px] font-mono leading-relaxed bg-[#0d1117] text-neutral-200">
        <pre className="!bg-transparent !p-0 !m-0 font-mono whitespace-pre selection:bg-indigo-500/30">
          <code>{cleanCode}</code>
        </pre>
      </div>
    </div>
  );
}
