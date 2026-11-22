import { Skeleton } from '@/components/ui/skeleton';

/** The dashboard's shape while it loads: the lead card beside the chart, then a band of figures. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
      <Skeleton className="h-28" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-28 lg:col-span-2" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
