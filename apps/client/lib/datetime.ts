/** ISO string -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO string, or undefined when blank. */
export function fromLocalInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

export type ScheduleState = 'live' | 'scheduled' | 'expired';

export function scheduleState(startsAt: string | null, endsAt: string | null): ScheduleState {
  const now = Date.now();
  if (startsAt && new Date(startsAt).getTime() > now) return 'scheduled';
  if (endsAt && new Date(endsAt).getTime() <= now) return 'expired';
  return 'live';
}
