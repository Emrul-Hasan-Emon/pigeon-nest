'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { answerQuestion, listSellerQuestions } from '@/lib/api/questions';
import { ApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import type { AnsweredFilter, QuestionPage, StaffQuestion } from '@/types/question';

const TABS: { value: AnsweredFilter; label: string }[] = [
  { value: 'unanswered', label: 'Needs your answer' },
  { value: 'answered', label: 'Answered' },
  { value: 'all', label: 'All' },
];
const PAGE_SIZE = 10;

function QuestionCard({ q, onSaved }: { q: StaffQuestion; onSaved: (q: StaffQuestion) => void }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(!q.answer);
  const [text, setText] = useState(q.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 2) return setError('Write your answer first.');
    setBusy(true);
    try {
      const saved = await answerQuestion(q.id, text.trim());
      onSaved(saved);
      setEditing(false);
      showToast('Your answer is saved. Buyers can see it on the product page.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        About{' '}
        <Link href={`/seller/products/${q.product.id}`} className="font-semibold text-foreground hover:underline">{q.product.name}</Link>
        {' · '}
        {q.askerName} · {formatDateTime(q.createdAt)}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-lg font-semibold text-foreground">{q.question}</p>
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label className="block">
            Your answer
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-input px-3 py-2" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a clear answer. Everyone who visits the product page can read it." />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? 'Saving…' : q.answer ? 'Save the new answer' : 'Send answer'}</button>
            {q.answer && <button type="button" onClick={() => { setEditing(false); setText(q.answer ?? ''); }} className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">Cancel</button>}
          </div>
        </form>
      ) : (
        <div className="mt-3 rounded-lg bg-muted/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Your answer{q.answeredAt ? `, ${formatDateTime(q.answeredAt)}` : ''}</p>
          <p className="mt-1 whitespace-pre-wrap text-base text-foreground">{q.answer}</p>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 rounded-lg border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:bg-muted">Change answer</button>
        </div>
      )}
    </li>
  );
}

/** The questions buyers asked about the seller's products. Answer them here; the answer shows on the product page. */
export function SellerQuestions() {
  const [show, setShow] = useState<AnsweredFilter>('unanswered');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QuestionPage<StaffQuestion> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listSellerQuestions({ show, search: q || undefined, page, pageSize: PAGE_SIZE })
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your questions.'))
      .finally(() => setLoading(false));
  }, [show, q, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const pill = (on: boolean) => `rounded-full border px-4 py-2 text-base font-medium ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
        {TABS.map((t) => (
          <button key={t.value} type="button" aria-pressed={show === t.value} className={pill(show === t.value)} onClick={() => { setShow(t.value); setPage(1); }}>{t.label}</button>
        ))}
        <input className="ml-auto w-64 rounded-lg border border-input px-3 py-2" placeholder="Search a question or product" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive">{error}</p>}
      {loading && !data ? (
        <LoadingBlock />
      ) : data && data.results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          {show === 'unanswered' ? 'Nothing waiting. Every question has an answer.' : 'No questions here yet. Buyers ask from the product page.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {data?.results.map((item) => (
            <QuestionCard key={item.id} q={item} onSaved={(saved) => setData((d) => (d ? { ...d, results: d.results.map((r) => (r.id === saved.id ? saved : r)) } : d))} />
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-base text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
