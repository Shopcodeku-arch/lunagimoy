import React, { useEffect } from 'react';
import { Code2, ArrowRight, X, Sparkles, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CodingSwitchModalProps {
  isOpen: boolean;
  onConfirmSwitch: () => void; // "Iya, Pindah"
  onDecline: () => void;       // "Tidak, Tetap disini"
  currentModelName?: string;
  userPromptSnippet?: string;
}

export const CodingSwitchModal: React.FC<CodingSwitchModalProps> = ({
  isOpen,
  onConfirmSwitch,
  onDecline,
  currentModelName = 'Luna',
  userPromptSnippet,
}) => {
  // Listen for Escape or Enter keys
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDecline();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDecline]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Beralih ke Luna Coder">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDecline}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#1a1b1e] text-neutral-100 shadow-[0_0_50px_rgba(16,185,129,0.15)]"
          >
            {/* Top decorative gradient line */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            <div className="p-6 sm:p-7">
              {/* Header Icon & Tag */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        Mode Luna Coder
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400 mt-0.5 block">
                      Spesialis Rekayasa Perangkat Lunak & Kode
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDecline}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                  title="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Exact Question requested by User */}
              <div className="mt-2 mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                  Saat ini model Luna tidak mendukung coding, apakah anda ingin beralih ke mode bahasa khusus coding?
                </h3>
              </div>

              {/* Informative Context */}
              <div className="rounded-2xl bg-[#141517] border border-neutral-800/80 p-3.5 mb-6 text-xs text-neutral-300 leading-relaxed space-y-2">
                <div className="flex items-start gap-2.5">
                  <Terminal className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    Anda saat ini sedang menggunakan mode <strong className="text-white">{currentModelName}</strong> yang dioptimalkan untuk percakapan & penalaran umum.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 pt-1 border-t border-neutral-800/60">
                  <Sparkles className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                  <p className="text-neutral-400 text-[11px]">
                    Dengan beralih ke <strong className="text-emerald-300 font-medium">Luna Coder</strong>, Luna akan langsung membuat program, struktur kode, dan arsitektur aplikasi secara lengkap dan terstruktur.
                  </p>
                </div>
                {userPromptSnippet && (
                  <div className="mt-2 pt-2 border-t border-neutral-800/60">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">
                      Permintaan Anda:
                    </span>
                    <p className="text-xs text-neutral-300 italic line-clamp-2 bg-neutral-900/60 px-2.5 py-1.5 rounded-lg border border-neutral-800 font-mono">
                      "{userPromptSnippet}"
                    </p>
                  </div>
                )}
              </div>

              {/* Two Buttons as requested: "Iya, Pindah" and "Tidak, Tetap disini" */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Secondary Button: "Tidak, Tetap disini" */}
                <button
                  type="button"
                  onClick={onDecline}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-neutral-700/80 bg-neutral-800/60 hover:bg-neutral-800 px-4 py-3 text-sm font-semibold text-neutral-300 hover:text-white transition-all active:scale-[0.98]"
                >
                  <span>Tidak, Tetap disini</span>
                </button>

                {/* Primary Button: "Iya, Pindah" */}
                <button
                  type="button"
                  onClick={onConfirmSwitch}
                  autoFocus
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-4 py-3 text-sm font-bold text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all active:scale-[0.98]"
                >
                  <Code2 className="h-4 w-4 text-neutral-950" />
                  <span>Iya, Pindah</span>
                  <ArrowRight className="h-4 w-4 text-neutral-950" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
