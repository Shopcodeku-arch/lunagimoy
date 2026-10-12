import React, { useEffect, useState } from 'react';
import { User, KeyRound, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';
import { LunaOrb } from './LunaOrb';
import { StorageService } from '../services/storage';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
}

const inputClass =
  'w-full rounded-xl bg-neutral-900 border border-neutral-700/80 py-3 text-base sm:text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-500/80 transition-colors';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form selalu bersih saat dibuka (mis. setelah keluar dari akun)
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setDisplayName('');
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      setError('Masukkan username yang valid (huruf kecil, angka, atau underscore).');
      return;
    }
    if (cleanUsername === 'ardan' || cleanUsername === 'guest_user') {
      setError('Akun uji coba tersebut telah dinonaktifkan. Gunakan username lain.');
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setError('PIN harus 4–6 digit angka.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await StorageService.login(cleanUsername, displayName.trim() || undefined, pin || undefined);
      onLoginSuccess(result.user);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat masuk');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fade-in fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      <div className="my-auto w-full sm:max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-neutral-800 bg-[#1e1f20] shadow-2xl text-neutral-100 pb-[env(safe-area-inset-bottom)]">
        <div className="border-b border-neutral-800/80 px-5 sm:px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#161719] border border-amber-500/30 shadow-[0_0_12px_rgba(255,191,72,0.18)]">
              <LunaOrb size={0.32} />
            </div>
            <div>
              <h3 id="auth-title" className="text-lg font-bold text-white tracking-tight">
                Masuk ke Luna
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Username baru akan otomatis dibuatkan akun.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div role="alert" className="rounded-xl bg-rose-950/50 border border-rose-800/70 p-3 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="auth-username" className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="contoh: alex, rizky_dev"
                maxLength={32}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                className={`${inputClass} pl-10 pr-4`}
              />
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">Huruf kecil, angka, atau underscore.</p>
          </div>

          <div>
            <label htmlFor="auth-name" className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Nama panggilan <span className="font-normal text-neutral-500">(opsional)</span>
            </label>
            <input
              id="auth-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="contoh: Alex"
              maxLength={60}
              autoComplete="nickname"
              className={`${inputClass} px-4`}
            />
          </div>

          <div>
            <label htmlFor="auth-pin" className="block text-xs font-semibold text-neutral-300 mb-1.5">
              PIN <span className="font-normal text-neutral-500">(opsional, 4–6 digit)</span>
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="auth-pin"
                type="password"
                inputMode="numeric"
                pattern="\d*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Isi untuk mengunci akun baru / membuka akun berPIN"
                autoComplete="current-password"
                className={`${inputClass} pl-10 pr-4`}
              />
            </div>
          </div>

          <div className="rounded-xl bg-neutral-900/80 border border-neutral-800 p-3 flex items-start gap-2.5 text-[11px] text-neutral-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Setiap akun punya riwayat obrolan sendiri. Saat pertama kali bertanya, Luna akan meminta Anda masuk ke
              akun Puter (gratis) untuk mengaktifkan AI.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 text-sm font-bold text-neutral-950 shadow-lg hover:opacity-95 transition-opacity disabled:opacity-60 active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{isSubmitting ? 'Memproses...' : 'Masuk & mulai'}</span>
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
