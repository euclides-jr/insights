'use client';

import { useState } from 'react';

interface ApplicationApiKeyProps {
  apiKey: string;
}

export function ApplicationApiKey({ apiKey }: ApplicationApiKeyProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = apiKey.slice(0, 8) + '••••••••••••••••••••' + apiKey.slice(-4);
  const display = revealed ? apiKey : masked;

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="text-sm font-mono text-[#0D0D0D] tracking-wide">
        {display}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors px-1.5 py-0.5 border border-[#E8E8E8] hover:border-[#0D0D0D]"
        aria-label={revealed ? 'Hide API key' : 'Show API key'}
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors px-1.5 py-0.5 border border-[#E8E8E8] hover:border-[#0D0D0D]"
        aria-label="Copy API key"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
