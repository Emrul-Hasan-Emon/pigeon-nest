'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { Actor, Attachment, OrderStatus, PaymentStatus, StaffRole } from '@/types/order';

export const field =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';
export const primaryButton =
  'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50';
export const outlineButton =
  'rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  due: 'Due',
  partially_paid: 'Partially paid',
  paid: 'Paid',
};

const ORDER_TONE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  packed: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-destructive/10 text-destructive',
};
const PAYMENT_TONE: Record<PaymentStatus, string> = {
  due: 'bg-amber-100 text-amber-800',
  partially_paid: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-700',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_TONE[status]}`}>{PAYMENT_STATUS_LABEL[status]}</span>;
}

export const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function actorLabel(a: Actor) {
  const kind = a.type === 'user' ? 'customer' : a.type;
  return `${a.name ?? 'Unknown'}${kind ? ` (${kind})` : ''}`;
}

export function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

/** Proof files as image thumbnails or file links. */
export function AttachmentList({ items }: { items: Pick<Attachment, 'id' | 'kind' | 'fileName' | 'url' | 'size'>[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5 pr-3 text-xs text-foreground hover:bg-muted"
          >
            {a.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                {a.fileName.split('.').pop()}
              </span>
            )}
            <span className="max-w-[10rem] truncate">{a.fileName}</span>
            <span className="text-muted-foreground">{formatBytes(a.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** A file input that shows what was picked and lets one be removed. */
export function FilePicker({
  files,
  onChange,
  max = 10,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange([...files, ...picked].slice(0, max));
          e.target.value = '';
        }}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted"
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
              <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span></span>
              <button type="button" className="ml-3 text-xs text-destructive hover:underline" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Images, PDF, Word, Excel, text or CSV. Up to {max} files, 10 MB each.</p>
    </div>
  );
}

/** Seller portal chrome (sidebar + sign-in check). The admin layout already provides its own. */
export function SellerShell({ active, children }: { active: 'orders' | 'payments' | 'commission'; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getSellerToken()) router.replace('/seller/login');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return (
    <div className="min-h-screen bg-background pl-56">
      <SellerSidebar active={active} />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}

/** Sends a seller whose session ended back to sign in; returns the message otherwise. */
export function useApiError(role: StaffRole) {
  const router = useRouter();
  return (error: unknown, fallback: string): string => {
    if (error instanceof ApiError && error.status === 401 && role === 'seller') {
      clearSellerToken();
      router.replace('/seller/login');
    }
    return error instanceof ApiError ? error.message : fallback;
  };
}

export const base = (role: StaffRole) => (role === 'admin' ? '/admin' : '/seller');
