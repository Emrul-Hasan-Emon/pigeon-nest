'use client';

import { useEffect, useState } from 'react';

/** Where to go after signing in: only a path on this site, never another address. */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  return raw;
}

/** The sign-in page that sends the customer back here afterwards. */
export function loginUrlFor(path: string): string {
  return `/user/login?next=${encodeURIComponent(path)}`;
}

/** The `?next=...` part of this page's address, kept when moving between sign-in and register. */
export function useNextQuery(): string {
  const [qs, setQs] = useState('');
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQs(next ? `?next=${encodeURIComponent(next)}` : '');
  }, []);
  return qs;
}
