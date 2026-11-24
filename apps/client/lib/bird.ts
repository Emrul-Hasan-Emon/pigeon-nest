/** "5 months old", "1 year 2 months old", "12 days old". Empty when there is no hatch date. */
export function ageText(hatchDate: string | null | undefined, today = new Date()): string {
  if (!hatchDate) return '';
  const [y, m, d] = hatchDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  if (months < 0) return '';
  if (months === 0) {
    const days = Math.max(0, Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000));
    return `${days} ${days === 1 ? 'day' : 'days'} old`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return `${parts.join(' ')} old`;
}

/** Today as YYYY-MM-DD in the browser's own time, for a date input's max. */
export function todayInput(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}
