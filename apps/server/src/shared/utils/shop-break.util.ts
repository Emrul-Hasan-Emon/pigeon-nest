/**
 * Whether a seller is selling right now. A seller is hidden from buyers (the seller, their products, and everything
 * that belongs to them) when selling is switched off, or when today falls inside a planned break (start and end
 * date, both days included). Orders already placed carry on as usual.
 */
export interface SellingFields {
  isEnabledForSell: boolean;
  breakStartsOn: string | Date | null;
  breakEndsOn: string | Date | null;
}

const todayKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** A `date` column may come back as a string or a Date. Returns YYYY-MM-DD. */
export function dateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return todayKey(value);
}

/** True while the seller is hidden from buyers. */
export function isShopClosed(s: SellingFields | null | undefined, now = new Date()): boolean {
  if (!s) return false;
  if (!s.isEnabledForSell) return true;
  const start = dateKey(s.breakStartsOn);
  const end = dateKey(s.breakEndsOn);
  if (!start || !end) return false;
  const today = todayKey(now);
  return start <= today && today <= end;
}

/** SQL for "this seller is selling right now". Pass the seller table's alias. */
export const sellerOpenSql = (alias = 's') =>
  `(${alias}."isEnabledForSell" = true AND NOT (${alias}."breakStartsOn" IS NOT NULL AND ${alias}."breakEndsOn" IS NOT NULL AND CURRENT_DATE BETWEEN ${alias}."breakStartsOn" AND ${alias}."breakEndsOn"))`;
