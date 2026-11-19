'use client';

import { Modal } from './modal';

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  secondaryLabel,
  onSecondary,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  secondaryLabel?: string;
  onSecondary?: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-md">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            {secondaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
            confirmVariant === 'danger'
              ? 'bg-destructive hover:opacity-90'
              : 'bg-primary hover:opacity-90'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
