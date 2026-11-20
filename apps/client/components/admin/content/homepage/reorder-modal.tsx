'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { listHomepageSections, reorderHomepageSections } from '@/lib/api/homepage';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { HomepageSection } from '@/types/homepage';

/** Loads every section in display order and lets the admin move them. */
export function ReorderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<HomepageSection[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAll() {
      const all: HomepageSection[] = [];
      let cursor: number | undefined;
      for (;;) {
        const r = await listHomepageSections({ sort: 'displayOrder', limit: 100, cursor });
        all.push(...r.results);
        if (r.nextCursor === null) return all;
        cursor = r.nextCursor;
      }
    }
    loadAll()
      .then(setItems)
      .catch(() => {
        showToast('Failed to load sections.', 'error');
        onClose();
      });
  }, [onClose, showToast]);

  function move(index: number, by: -1 | 1) {
    setItems((current) => {
      if (!current) return current;
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    if (!items) return;
    setSaving(true);
    try {
      await reorderHomepageSections(items.map((s) => s.id));
      showToast('Order saved.', 'success');
      onSaved();
      onClose();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Failed to save the order. Reload and try again.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Reorder homepage sections" onClose={onClose} widthClassName="max-w-xl">
      {!items ? (
        <p className="py-6 text-center text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ol className="max-h-96 space-y-1 overflow-auto">
            {items.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="w-6 text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate text-foreground">{s.title}</span>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="px-1 disabled:opacity-30">↓</button>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
