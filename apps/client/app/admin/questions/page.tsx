'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/ui/skeleton';
import { ReasonModal } from '@/components/admin/sellers/reason-modal';
import { useToast } from '@/components/ui/toast';
import { hideQuestion, listAdminQuestions, restoreQuestion } from '@/lib/api/questions';
import { ApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import type { AnsweredFilter, QuestionPage, StaffQuestion } from '@/types/question';

const PAGE_SIZE = 20;

export default function AdminQuestionsPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [show, setShow] = useState<AnsweredFilter>('all');
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QuestionPage<StaffQuestion> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiding, setHiding] = useState<StaffQuestion | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listAdminQuestions({ show, visibility, search: q || undefined, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch(() => showToast('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }, [show, visibility, q, page, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function restore(item: StaffQuestion) {
    try {
      await restoreQuestion(item.id);
      showToast('Question restored.', 'success');
      load();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not restore it.', 'error');
    }
  }

  async function confirmHide(reason: string) {
    if (!hiding) return;
    setSaving(true);
    try {
      await hideQuestion(hiding.id, reason);
      showToast('Question hidden.', 'success');
      setHiding(null);
      load();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not hide it.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const field = 'rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Buyer questions</h1>
      <p className="mb-5 text-sm text-muted-foreground">Every question buyers asked a seller. Sellers answer them; you can hide one that breaks the rules, with a reason, and restore it later. You do not answer for a seller.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${field} w-64`} placeholder="Question, product or seller" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={field} aria-label="Answer state" value={show} onChange={(e) => { setShow(e.target.value as AnsweredFilter); setPage(1); }}>
          <option value="all">Answered and not</option>
          <option value="unanswered">Waiting for an answer</option>
          <option value="answered">Answered</option>
        </select>
        <select className={field} aria-label="Visibility" value={visibility} onChange={(e) => { setVisibility(e.target.value as 'all' | 'published' | 'hidden'); setPage(1); }}>
          <option value="all">Shown and hidden</option>
          <option value="published">Shown</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : (
        data && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  {['Question', 'Product', 'Seller', 'Answer', 'Asked'].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No questions found.</td></tr>}
                {data.results.map((r) => (
                  <tr key={r.id} className={r.status === 'hidden' ? 'bg-muted/40' : undefined}>
                    <td className="max-w-xs px-4 py-3">
                      <p className="whitespace-pre-wrap text-foreground">{r.question}</p>
                      <p className="text-xs text-muted-foreground">{r.askerName}</p>
                      {r.status === 'hidden' && <p className="mt-1 text-xs font-medium text-destructive">Hidden{r.hiddenReason ? `: ${r.hiddenReason}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3"><Link href={`/admin/catalog/products/${r.product.id}`} className="text-primary">{r.product.name}</Link></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.seller?.name ?? '—'}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">{r.answer ? <span className="whitespace-pre-wrap">{r.answer}</span> : <span className="italic">Not answered yet</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'hidden' ? (
                        <button type="button" onClick={() => restore(r)} className="text-primary">Restore</button>
                      ) : (
                        <button type="button" onClick={() => setHiding(r)} className="text-destructive">Hide</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}

      {hiding && (
        <ReasonModal
          title="Hide this question"
          label="Why is it hidden? Buyers and the seller will no longer see it. You can restore it later."
          confirmLabel="Hide question"
          busy={saving}
          onConfirm={confirmHide}
          onClose={() => setHiding(null)}
        />
      )}
    </div>
  );
}
