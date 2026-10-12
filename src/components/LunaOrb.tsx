import React from 'react';

interface LunaOrbProps {
  size?: number; // faktor skala, default 0.3 (sekitar 30px)
  className?: string;
  /** false = bola statis ringan (dipakai di daftar pesan agar tidak berat di HP). */
  animated?: boolean;
}

export const LunaOrb: React.FC<LunaOrbProps> = ({ size = 0.3, className = '', animated = true }) => {
  const dim = Math.round(100 * size);

  if (!animated) {
    return (
      <span
        aria-hidden="true"
        className={`luna-orb-static inline-block shrink-0 rounded-full ${className}`}
        style={{ width: `${dim}px`, height: `${dim}px` }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-visible ${className}`}
      style={{ width: `${dim}px`, height: `${dim}px` }}
    >
      <div
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{
          width: '100px',
          height: '100px',
          transform: `translate(-50%, -50%) scale(${size})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="luna-orb">
          <div className="box" />
        </div>
      </div>
    </div>
  );
};
