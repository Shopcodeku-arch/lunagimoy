import React, { useState, useEffect } from 'react';
import {
  ChevronUp,
  Sparkles,
  Code2,
  BrainCircuit,
  Check,
  X,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ModelVariant } from '../types';

interface ModelSelectorProps {
  selectedModel: ModelVariant;
  onSelectModel: (variant: ModelVariant) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const models: Array<{
    id: ModelVariant;
    title: string;
    badge: string;
    sub: string;
    desc: string;
    tag?: string;
    icon: React.ReactNode;
    activeBorder: string;
    iconBg: string;
  }> = [
    {
      id: 'standard',
      title: 'Luna',
      badge: 'Standar & Umum',
      sub: 'Percakapan & Analisis Umum',
      desc: 'Cerdas, ramah, dan serba guna untuk dialog, ideasi, dan analisis teks umum. Menolak pembuatan kode program (gunakan Luna Coder jika butuh kode).',
      icon: <Sparkles className="h-5 w-5 text-sky-400" />,
      activeBorder: 'border-sky-500/60 ring-1 ring-sky-500/40 bg-[#25282d]',
      iconBg: 'bg-sky-500/15 border border-sky-500/30 text-sky-400',
    },
    {
      id: 'pro',
      title: 'Luna Pro',
      badge: 'Penalaran Tinggi',
      sub: 'Penalaran Analitis & Logika Mendalam',
      desc: 'Dioptimalkan untuk pemecahan masalah rumit, logika terstruktur, argumen kritis, dan analisis komprehensif tanpa penulisan kode program.',
      icon: <BrainCircuit className="h-5 w-5 text-purple-400" />,
      activeBorder: 'border-purple-500/60 ring-1 ring-purple-500/40 bg-[#292631]',
      iconBg: 'bg-purple-500/15 border border-purple-500/30 text-purple-400',
    },
    {
      id: 'coder',
      title: 'Luna Coder',
      badge: 'Spesialis Coding',
      sub: 'Spesialis Pemrograman & Software Architecture',
      desc: 'Satu-satunya mode resmi yang diizinkan untuk membuat, merancang, meninjau, dan memecahkan bug pada kode program (Python, JS/TS, HTML/CSS, SQL, dll).',
      tag: 'KHUSUS CODING',
      icon: <Code2 className="h-5 w-5 text-emerald-400" />,
      activeBorder: 'border-emerald-500/60 ring-1 ring-emerald-500/40 bg-[#222b27]',
      iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
    },
  ];

  const current = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button: Pill in the chat area that opens menu upwards */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-[#1e1f20]/90 backdrop-blur border border-neutral-700/70 hover:border-neutral-500 px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white transition-all shadow-md group active:scale-95"
        title="Ganti mode Luna" aria-haspopup="dialog" aria-expanded={isOpen}
      >
        <span className="shrink-0 flex items-center justify-center">
          {React.cloneElement(current.icon as React.ReactElement<{ className?: string }>, {
            className: 'h-3.5 w-3.5',
          })}
        </span>
        <span className="font-semibold text-white tracking-tight">{current.title}</span>
        <span className="text-[11px] text-neutral-400 font-normal hidden sm:inline">
          · {current.badge}
        </span>
        <ChevronUp
          className={`h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-200 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Upward-Emerging Menu (Muncul dari chat ke atas) */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Drawer sliding UPWARDS from chat / bottom */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role="dialog" aria-modal="true" aria-label="Pilih mode Luna"
              className="relative z-10 w-full max-w-xl bg-[#1e1f20] border-t sm:border border-neutral-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] mb-0 sm:mb-8"
            >
              {/* Drag Indicator on Mobile */}
              <div className="pt-3 pb-1 flex justify-center sm:hidden">
                <div className="h-1.5 w-12 rounded-full bg-neutral-600/70" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 px-5 sm:px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-neutral-800 text-amber-400 border border-neutral-700/60">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Pilih Mode Bahasa Luna
                      </h3>
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold px-2 py-0.5 rounded-full">
                        Gimoy Studio
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Pilih kapabilitas model sesuai kebutuhan tugas Anda
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Tutup"
                  className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Model Options List */}
              <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 overflow-y-auto min-h-0 flex-1 overscroll-contain">
                {models.map((item) => {
                  const isSelected = item.id === selectedModel;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(item.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left rounded-2xl p-4 transition-all border flex items-start gap-3.5 relative group ${
                        isSelected
                          ? item.activeBorder
                          : 'border-neutral-800 bg-[#171819] hover:bg-[#232528] hover:border-neutral-700'
                      }`}
                    >
                      {/* Distinct Icon */}
                      <div
                        className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-xl ${item.iconBg}`}
                      >
                        {item.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm text-white group-hover:text-amber-200 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[11px] font-medium text-neutral-400">
                            ({item.sub})
                          </span>
                          {item.tag && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-semibold tracking-wide">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300/80 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>

                      {/* Radio Selection Indicator */}
                      <div className="absolute right-4 top-4">
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-amber-400 border-amber-400 text-neutral-900 shadow-sm'
                              : 'border-neutral-600 bg-neutral-800/80 group-hover:border-neutral-500'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Footer security badge */}
                <div className="flex items-center gap-2 rounded-xl bg-neutral-900/60 border border-neutral-800 px-3.5 py-2.5 text-xs text-neutral-400 mt-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Hanya mode <strong>Luna Coder</strong> yang diizinkan memprogram dan menyusun kode pemrograman.
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
