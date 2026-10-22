'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Gagal menyalin link:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95 ${
        copied
          ? 'bg-green-100 text-green-700 hover:bg-green-200 ring-1 ring-green-200'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Link Tersalin!' : 'Salin Link Kegiatan'}
    </button>
  );
}