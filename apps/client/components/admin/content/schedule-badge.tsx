import { scheduleState } from '@/lib/datetime';

const STYLE = {
  live: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-amber-100 text-amber-700',
  expired: 'bg-muted text-muted-foreground',
} as const;

export function ScheduleBadge({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  const state = scheduleState(startsAt, endsAt);
  if (state === 'live' && !startsAt && !endsAt) return <span className="text-muted-foreground">Always</span>;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STYLE[state]}`}>
      {state}
    </span>
  );
}
