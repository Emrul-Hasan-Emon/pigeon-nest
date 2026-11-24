'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Shares the page: the phone's share sheet when there is one, otherwise it copies the link. */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The person closed the share sheet, or the browser blocked the copy. Nothing to report.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-st-line bg-white px-4 py-2 text-sm font-medium text-st-ink hover:border-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Share2 aria-hidden="true" className="h-4 w-4" />}
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
