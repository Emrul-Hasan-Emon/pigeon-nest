'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { askQuestion, listProductQuestions } from '@/lib/api/questions';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { getUserToken } from '@/lib/auth/user-token';
import { formatDate } from '@/lib/datetime';
import type { PublicQuestion } from '@/types/question';

const PAGE = 5;

/** Questions buyers asked the seller about this product, with the seller's answers, and a box to ask one. */
export function ProductQuestions({ productId, sellerName }: { productId: number; sellerName: string }) {
  const [rows, setRows] = useState<PublicQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Known only in the browser, so it is read after the first render to keep the server and browser pages the same.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(Boolean(getUserToken()));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await listProductQuestions(productId, 1, PAGE);
      setRows(r.results);
      setTotal(r.total);
      setPage(1);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function more() {
    setMoreBusy(true);
    try {
      const r = await listProductQuestions(productId, page + 1, PAGE);
      setRows((c) => [...c, ...r.results]);
      setPage(page + 1);
    } finally {
      setMoreBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!getUserToken()) {
      window.location.href = loginUrlFor(window.location.pathname + window.location.search);
      return;
    }
    if (text.trim().length < 10) return setError('Write at least 10 characters so the seller can answer well.');
    setBusy(true);
    try {
      await askQuestion(productId, text.trim());
      setText('');
      setSent(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not send your question.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="questions" aria-labelledby="questions-title" className="mt-10 scroll-mt-20">
      <h2 id="questions-title" className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-st-ink sm:text-2xl">
        <MessageCircleQuestion aria-hidden="true" className="h-6 w-6" />
        Questions and answers
      </h2>
      <div className="rounded-xl border border-st-line bg-white p-4 sm:p-6">
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-sm font-semibold text-st-ink" htmlFor="ask-question">
            Ask {sellerName} about this bird
          </label>
          <textarea
            id="ask-question"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSent(false);
            }}
            placeholder="For example: Is it vaccinated? Can you send a video? Is the price negotiable?"
            className="w-full rounded-lg border border-st-line px-3 py-2 text-sm focus:border-st-teal focus:outline-none"
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {sent && <p className="text-sm text-st-teal">Thank you. The seller will reply here.</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal disabled:opacity-50">
              {busy ? 'Sending…' : signedIn ? 'Ask the seller' : 'Sign in to ask'}
            </button>
            <span className="text-xs text-st-slate">{text.length} / 1000</span>
          </div>
        </form>

        <div className="mt-6 border-t border-st-line pt-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-st-slate">Loading questions…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-st-slate">No questions yet. Be the first to ask.</p>
          ) : (
            <ul>
              {rows.map((q) => (
                <li key={q.id} className="border-b border-st-line py-4 last:border-b-0">
                  <p className="text-st-ink">
                    <span className="font-semibold">Q: </span>
                    {q.question}
                  </p>
                  <p className="text-xs text-st-slate">
                    {q.askerName} · {formatDate(q.createdAt)}
                  </p>
                  {q.answer ? (
                    <div className="mt-2 rounded-lg bg-st-dove px-3 py-2">
                      <p className="whitespace-pre-wrap text-st-ink">
                        <span className="font-semibold">A: </span>
                        {q.answer}
                      </p>
                      <p className="text-xs text-st-slate">
                        {sellerName}
                        {q.answeredAt ? ` · ${formatDate(q.answeredAt)}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm italic text-st-slate">Waiting for the seller to answer.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {rows.length < total && (
            <div className="mt-2 flex justify-center">
              <button type="button" onClick={more} disabled={moreBusy} className="rounded-full border border-st-line px-5 py-2 text-sm font-medium text-st-ink hover:border-st-ink disabled:opacity-60">
                {moreBusy ? 'Loading…' : 'Show more questions'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
