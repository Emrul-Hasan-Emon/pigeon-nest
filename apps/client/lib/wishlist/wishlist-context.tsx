'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { getWishlistIds, removeFromWishlist, saveToWishlist } from '@/lib/api/wishlist';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { getUserToken } from '@/lib/auth/user-token';

interface WishlistContextValue {
  isSaved: (productId: number) => boolean;
  /** How many products the signed-in customer has saved. */
  count: number;
  limit: number;
  /** Save or unsave. A guest is sent to sign in and brought back to this page. */
  toggle: (productId: number) => Promise<void>;
  /** Unsave from the wishlist page (no sign-in redirect needed there). */
  remove: (productId: number) => Promise<boolean>;
  busy: (productId: number) => boolean;
}

const Ctx = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(200);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const inFlight = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!getUserToken()) return;
    let cancelled = false;
    getWishlistIds()
      .then((r) => {
        if (cancelled) return;
        setIds(new Set(r.productIds));
        setLimit(r.limit);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const mark = (id: number, on: boolean) =>
    setPending((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const set = (id: number, saved: boolean) =>
    setIds((cur) => {
      const next = new Set(cur);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });

  const change = useCallback(
    async (productId: number, save: boolean): Promise<boolean> => {
      if (inFlight.current.has(productId)) return false;
      inFlight.current.add(productId);
      mark(productId, true);
      set(productId, save); // show the change at once; undo if the server says no
      try {
        const ack = save ? await saveToWishlist(productId) : await removeFromWishlist(productId);
        if (save && ack.added) showToast('Saved to your wishlist.', 'success');
        return true;
      } catch (err) {
        set(productId, !save);
        if (err instanceof ApiError && err.status === 401) {
          router.push(loginUrlFor(window.location.pathname + window.location.search));
        } else {
          showToast(err instanceof ApiError ? err.message : 'Could not update your wishlist.', 'error');
        }
        return false;
      } finally {
        inFlight.current.delete(productId);
        mark(productId, false);
      }
    },
    [router, showToast],
  );

  const toggle = useCallback(
    async (productId: number) => {
      if (!getUserToken()) {
        router.push(loginUrlFor(window.location.pathname + window.location.search));
        return;
      }
      await change(productId, !ids.has(productId));
    },
    [change, ids, router],
  );
  const remove = useCallback((productId: number) => change(productId, false), [change]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      isSaved: (id) => ids.has(id),
      count: ids.size,
      limit,
      toggle,
      remove,
      busy: (id) => pending.has(id),
    }),
    [ids, limit, toggle, remove, pending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
