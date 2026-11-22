'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addToCart, getCartSummary } from '@/lib/api/cart';
import type { CartResult, CartSummary } from '@/types/cart';

interface CartContextValue {
  summary: CartSummary;
  /** Goes up whenever a cart changes, so panels know to reload. */
  version: number;
  addItem: (input: { sellerProductId: number; sellerProductSkuId?: number; quantity?: number; proposalId?: number }) => Promise<CartResult>;
  /** Call after any cart change made elsewhere (quantity, remove, clear). */
  changed: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<CartSummary>({ cartCount: 0, itemCount: 0 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCartSummary()
      .then((s) => !cancelled && setSummary(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [version]);

  const changed = useCallback(() => setVersion((v) => v + 1), []);
  const addItem = useCallback<CartContextValue['addItem']>(
    async (input) => {
      const result = await addToCart(input);
      setVersion((v) => v + 1);
      return result;
    },
    [],
  );

  const value = useMemo(() => ({ summary, version, addItem, changed }), [summary, version, addItem, changed]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
