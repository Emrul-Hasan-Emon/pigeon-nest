'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import { ReportDialog } from './report-dialog';
import type { AuthorType, CursorPage, ReviewReply, ReviewReportReason } from '@/types/review';

/** What a role can do with a thread. Leave a function out and its button does not show. */
export interface ThreadApi {
  load: (parentId: number | null, cursor?: number) => Promise<CursorPage<ReviewReply>>;
  create?: (body: string, parentId?: number) => Promise<unknown>;
  edit?: (id: number, body: string) => Promise<unknown>;
  remove?: (id: number) => Promise<unknown>;
  report?: (id: number, reason: ReviewReportReason, note?: string) => Promise<unknown>;
  hide?: (id: number, reason: string) => Promise<unknown>;
  restore?: (id: number) => Promise<unknown>;
}

interface Ctx {
  api: ThreadApi;
  me: AuthorType | null;
  canReply: boolean;
  refresh: number;
  changed: () => void;
}
const ThreadCtx = createContext<Ctx | null>(null);

const BADGE: Record<AuthorType, { label: string; tone: string }> = {
  user: { label: 'Reviewer', tone: 'bg-sky-100 text-sky-800' },
  seller: { label: 'Seller', tone: 'bg-emerald-100 text-emerald-800' },
  admin: { label: 'Support', tone: 'bg-violet-100 text-violet-800' },
};

const linkButton = 'text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal';
const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none';

function Composer({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post this. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <textarea
        className={input}
        rows={2}
        maxLength={1000}
        placeholder={placeholder}
        aria-label={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        <button type="submit" disabled={busy || !body.trim()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
          {busy ? 'Posting…' : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>}
        <span className="ml-auto text-xs text-muted-foreground">{body.length}/1000</span>
      </div>
    </form>
  );
}

function HideDialog({ onSubmit, onClose }: { onSubmit: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not hide it.');
      setBusy(false);
    }
  }
  return (
    <Modal title="Hide this reply" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">
          Reason <span className="font-normal text-muted-foreground">(kept in the history)</span>
          <textarea className={`${input} mt-1`} rows={3} minLength={3} maxLength={1000} required value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy || reason.trim().length < 3} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Hide reply</button>
        </div>
      </form>
    </Modal>
  );
}

function Item({ reply }: { reply: ReviewReply }) {
  const ctx = useContext(ThreadCtx)!;
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const { api } = ctx;

  const badge = BADGE[reply.authorType];
  const own = reply.authorType === ctx.me && !reply.deleted;
  const live = !reply.deleted && !reply.hidden;
  const indent = reply.depth < 4;

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      showToast(done, 'success');
      ctx.changed();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'That did not work. Try again.', 'error');
    }
  }

  return (
    <li className="py-2">
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-sm font-medium text-foreground">{reply.authorName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}>{badge.label}</span>
          <time dateTime={reply.createdAt} className="text-muted-foreground">{formatDateTime(reply.createdAt)}</time>
          {reply.editedAt && <span className="text-muted-foreground">edited</span>}
        </div>

        {editing ? (
          <Composer
            initial={reply.body ?? ''}
            placeholder="Edit your reply"
            submitLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await api.edit!(reply.id, body);
              setEditing(false);
              ctx.changed();
            }}
          />
        ) : reply.deleted ? (
          <p className="mt-1 text-sm italic text-muted-foreground">This reply was deleted.</p>
        ) : reply.hidden && !reply.body ? (
          <p className="mt-1 text-sm italic text-muted-foreground">This reply was hidden by a moderator.</p>
        ) : (
          <>
            {reply.hidden && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Hidden{reply.hiddenReason ? `: ${reply.hiddenReason}` : ''}. Only moderators see the text below.
              </p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {reply.replyToName && <span className="mr-1 font-medium text-st-teal">@{reply.replyToName}</span>}
              {reply.body}
            </p>
          </>
        )}

        {!editing && !reply.deleted && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {ctx.canReply && api.create && live && (
              <button type="button" className={linkButton} onClick={() => setReplying((v) => !v)}>Reply</button>
            )}
            {own && api.edit && live && <button type="button" className={linkButton} onClick={() => setEditing(true)}>Edit</button>}
            {own && api.remove && <button type="button" className={linkButton} onClick={() => setConfirmDelete(true)}>Delete</button>}
            {!own && api.report && live && <button type="button" className={linkButton} onClick={() => setReporting(true)}>Report</button>}
            {api.hide && live && <button type="button" className={`${linkButton} text-destructive`} onClick={() => setHiding(true)}>Hide</button>}
            {api.restore && reply.hidden && (
              <button type="button" className={linkButton} onClick={() => run(() => api.restore!(reply.id), 'Reply restored.')}>Restore</button>
            )}
          </div>
        )}
        {replying && api.create && (
          <Composer
            placeholder={`Reply to ${reply.authorName}`}
            submitLabel="Post reply"
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await api.create!(body, reply.id);
              setReplying(false);
              setOpen(true);
              ctx.changed();
            }}
          />
        )}
      </div>

      {reply.replyCount > 0 && (
        <button type="button" className={`${linkButton} mt-1 ml-1`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide replies' : `View ${reply.replyCount} ${reply.replyCount === 1 ? 'reply' : 'replies'}`}
        </button>
      )}
      {open && (
        <div className={indent ? 'ml-4 border-l border-border pl-3' : ''}>
          <Branch parentId={reply.id} />
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this reply?"
          description="It disappears from the thread. Replies under it stay, with a note that it was deleted."
          confirmLabel="Delete"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(() => api.remove!(reply.id), 'Reply deleted.');
          }}
        />
      )}
      {reporting && api.report && (
        <ReportDialog
          what="reply"
          send={(reason, note) => api.report!(reply.id, reason, note)}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            showToast('Thanks. A moderator will look at it.', 'success');
          }}
        />
      )}
      {hiding && api.hide && (
        <HideDialog
          onClose={() => setHiding(false)}
          onSubmit={async (reason) => {
            await api.hide!(reply.id, reason);
            setHiding(false);
            showToast('Reply hidden.', 'success');
            ctx.changed();
          }}
        />
      )}
    </li>
  );
}

/** The replies straight under one parent (the review itself when parentId is null), loaded on demand. */
function Branch({ parentId }: { parentId: number | null }) {
  const ctx = useContext(ThreadCtx)!;
  const [rows, setRows] = useState<ReviewReply[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const { api, refresh } = ctx;

  useEffect(() => {
    let live = true;
    api
      .load(parentId)
      .then((r) => {
        if (!live) return;
        setRows(r.results);
        setNext(r.nextCursor);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Could not load the replies.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [api, parentId, refresh]);

  async function more() {
    if (next === null) return;
    setMoreBusy(true);
    try {
      const r = await api.load(parentId, next);
      setRows((c) => [...c, ...r.results]);
      setNext(r.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load more replies.');
    } finally {
      setMoreBusy(false);
    }
  }

  if (loading) return <p className="py-2 text-xs text-muted-foreground">Loading replies…</p>;
  return (
    <>
      {error && <p role="alert" className="py-1 text-xs text-destructive">{error}</p>}
      <ul>{rows.map((r) => <Item key={r.id} reply={r} />)}</ul>
      {next !== null && (
        <button type="button" onClick={more} disabled={moreBusy} className={`${linkButton} mb-1`}>
          {moreBusy ? 'Loading…' : 'Show more replies'}
        </button>
      )}
    </>
  );
}

/**
 * The reply thread under one review. Replies nest; each level loads when opened.
 * `me` is the role looking at it: it decides which replies are "mine" to edit or delete
 * (only the reviewer, the seller and Support ever write replies).
 */
export function ReplyThread({
  api,
  me,
  canReply,
  count,
  onChanged,
  defaultOpen = false,
}: {
  api: ThreadApi;
  me: AuthorType | null;
  canReply: boolean;
  count: number;
  onChanged?: () => void;
  defaultOpen?: boolean;
}) {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(defaultOpen && count > 0);
  const [composing, setComposing] = useState(false);
  const changed = useCallback(() => {
    setRefresh((n) => n + 1);
    onChanged?.();
  }, [onChanged]);

  return (
    <ThreadCtx.Provider value={{ api, me, canReply, refresh, changed }}>
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-3">
          {(count > 0 || open) && (
            <button type="button" className={linkButton} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide replies' : `${count} ${count === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
          {canReply && api.create && (
            <button type="button" className={linkButton} onClick={() => { setComposing((v) => !v); }}>
              Reply
            </button>
          )}
        </div>
        {composing && api.create && (
          <Composer
            placeholder="Write a reply"
            submitLabel="Post reply"
            onCancel={() => setComposing(false)}
            onSubmit={async (body) => {
              await api.create!(body);
              setComposing(false);
              setOpen(true);
              changed();
            }}
          />
        )}
        {open && (
          <div className="mt-1 border-l border-border pl-3">
            <Branch parentId={null} />
          </div>
        )}
      </div>
    </ThreadCtx.Provider>
  );
}
