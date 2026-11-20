import Link from 'next/link';

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-st-slate">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-st-ink hover:underline">{item.label}</Link>
            ) : (
              <span aria-current="page" className="text-st-ink">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function NotFoundBlock({ title, hint, href = '/products', cta = 'Browse all products' }: { title: string; hint: string; href?: string; cta?: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-st-ink">{title}</h1>
      <p className="mt-2 text-st-slate">{hint}</p>
      <Link href={href} className="mt-6 inline-flex rounded-full bg-st-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-st-teal">
        {cta}
      </Link>
    </div>
  );
}

export function LoadingBlock() {
  return <div className="store-skeleton mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading"><div className="h-8 w-56 rounded bg-st-line" /><div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-st-line" />)}</div></div>;
}
