'use client';

import { useState } from 'react';
import {
  createAttributeValue,
  deleteAttributeValue,
  updateAttributeValue,
} from '@/lib/api/attributes';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import type { AttributeValue } from '@/types/attribute';
import { DELETE_ENABLED } from '@/lib/features';

interface DraftValue {
  name: string;
  colorCode: string;
  sortOrder: number;
}

const EMPTY_DRAFT: DraftValue = { name: '', colorCode: '', sortOrder: 0 };

export function AttributeValuesManager({
  attributeId,
  values,
  onValuesChange,
}: {
  attributeId: number;
  values: AttributeValue[];
  onValuesChange: (values: AttributeValue[]) => void;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<DraftValue>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AttributeValue | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  function replace(id: number, next: AttributeValue) {
    onValuesChange(values.map((value) => (value.id === id ? next : value)));
  }

  function remove(id: number) {
    onValuesChange(values.filter((value) => value.id !== id));
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;

    setAdding(true);
    try {
      const created = await createAttributeValue(attributeId, {
        name: draft.name,
        colorCode: draft.colorCode || null,
        sortOrder: draft.sortOrder,
      });
      onValuesChange([...values, created]);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Failed to add value.',
        'error',
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(value: AttributeValue) {
    try {
      const updated = await updateAttributeValue(value.id, {
        isActive: !value.isActive,
      });
      replace(value.id, updated);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        remove(value.id);
        showToast('That value no longer exists.', 'error');
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to update value.',
        'error',
      );
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteAttributeValue(pendingDelete.id);
      remove(pendingDelete.id);
      showToast('Value deleted.', 'success');
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        remove(pendingDelete.id);
        showToast('That value no longer exists.', 'error');
        setPendingDelete(null);
        return;
      }
      if (error instanceof ConflictApiError) {
        setConflictMessage(error.message);
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to delete value.',
        'error',
      );
    }
  }

  return (
    <div className="mt-5">
      <span className="text-sm font-medium text-foreground">Values</span>

      <div className="mt-2 divide-y divide-border rounded-lg border border-border">
        {values.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No values yet.</p>
        )}
        {values
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((value) => (
            <div key={value.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                {value.colorCode && (
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: value.colorCode }}
                  />
                )}
                <span className="text-foreground">{value.name}</span>
                <span className="text-xs text-muted-foreground">sort {value.sortOrder}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(value)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    value.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {value.isActive ? 'Active' : 'Inactive'}
                </button>
                {DELETE_ENABLED && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(value)}
                    className="font-medium text-destructive hover:opacity-70"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          placeholder="New value name"
          value={draft.name}
          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          className="w-44 rounded-md border border-input px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <input
          type="color"
          value={draft.colorCode || '#000000'}
          onChange={(event) => setDraft((d) => ({ ...d, colorCode: event.target.value }))}
          className="h-8 w-9 rounded-md border border-input"
        />
        <input
          type="number"
          placeholder="Sort"
          value={draft.sortOrder}
          onChange={(event) =>
            setDraft((d) => ({ ...d, sortOrder: Number(event.target.value) }))
          }
          className="w-20 rounded-md border border-input px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !draft.name.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Add value
        </button>
      </form>

      {pendingDelete && !conflictMessage && (
        <ConfirmDialog
          title="Delete value"
          description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete && conflictMessage && (
        <ConfirmDialog
          title="Can't delete value"
          description={conflictMessage}
          confirmLabel="Close"
          confirmVariant="primary"
          secondaryLabel="Deactivate instead"
          onSecondary={async () => {
            const target = pendingDelete;
            if (!target) return;
            await handleToggleActive(target);
            setPendingDelete(null);
            setConflictMessage(null);
          }}
          onConfirm={() => {
            setPendingDelete(null);
            setConflictMessage(null);
          }}
          onClose={() => {
            setPendingDelete(null);
            setConflictMessage(null);
          }}
        />
      )}
    </div>
  );
}
