'use client';

import { useState } from 'react';
import { MostSavedReport } from '@/components/admin/wishlist/most-saved';
import { AdminWishlistList } from '@/components/admin/wishlist/wishlist-list';

const TABS = [
  { key: 'items', label: 'Saved items' },
  { key: 'top', label: 'Most saved products' },
] as const;

export default function AdminWishlistPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('items');
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Wishlists</h1>
        <p className="text-sm text-muted-foreground">What customers saved, and which products are wanted most. Read only: only a customer changes their own wishlist.</p>
      </div>
      <div role="tablist" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'items' ? <AdminWishlistList /> : <MostSavedReport />}
    </div>
  );
}
