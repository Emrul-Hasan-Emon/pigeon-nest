import type { Seller } from '@/types/seller';

const key = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Selling = Pick<Seller, 'isEnabledForSell' | 'breakStartsOn' | 'breakEndsOn'>;

/** True while the seller is hidden from buyers: selling is off, or today is inside the planned break. */
export function isShopClosed(s: Selling | null | undefined): boolean {
  if (!s) return false;
  if (!s.isEnabledForSell) return true;
  if (!s.breakStartsOn || !s.breakEndsOn) return false;
  const today = key();
  return s.breakStartsOn.slice(0, 10) <= today && today <= s.breakEndsOn.slice(0, 10);
}

/** A planned break that has not started yet. */
export function hasPlannedBreak(s: Selling | null | undefined): boolean {
  return Boolean(s?.isEnabledForSell && s.breakStartsOn && s.breakEndsOn && s.breakEndsOn.slice(0, 10) >= key() && !isShopClosed(s));
}

export const todayInputValue = () => key();
