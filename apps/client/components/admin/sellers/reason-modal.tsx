'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';

/**
 * Asks the admin for a note before a rejecting/suspending action. The note is
 * required: the confirm button stays disabled until something is typed.
 */
export function ReasonModal({
  title,
  label,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-md">
      <label className="block text-sm text-foreground">
        {label}
        <textarea
          rows={3}
          maxLength={1000}
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || trimmed.length === 0}
          onClick={() => onConfirm(trimmed)}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
