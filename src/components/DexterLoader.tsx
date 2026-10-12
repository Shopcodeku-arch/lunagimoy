import React from 'react';

export const DexterLoader: React.FC = () => {
  const letters = ['L', 'O', 'A', 'D', 'I', 'N', 'G', '.', '.', '.'];

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start py-1 select-none overflow-hidden">
      <div className="loader-wrapper" aria-hidden="true">
        <div className="loader-mask" />
        {letters.map((char, index) => (
          <span key={index} className="loader-letter">
            {char}
          </span>
        ))}
      </div>
      <p className="text-xs text-neutral-400 font-medium tracking-wide">Luna sedang merumuskan jawaban...</p>
    </div>
  );
};
