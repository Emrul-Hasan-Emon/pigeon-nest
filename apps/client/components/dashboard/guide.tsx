import Link from 'next/link';
import type { GuideSection } from './guide-content';

/** A plain-language explanation of every dashboard figure, for someone seeing the dashboard for the first time. */
export function DashboardGuide({ sections, title, intro, backHref }: { sections: GuideSection[]; title: string; intro: string; backHref: string }) {
  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
        <Link href={backHref} className="mt-2 inline-block text-sm text-primary hover:underline">Back to the dashboard</Link>
      </div>

      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2">
        {sections.map((s, i) => (
          <a key={s.title} href={`#section-${i}`} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted">
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <section key={section.title} id={`section-${i}`} className="scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            {section.intro && <p className="mt-1 text-sm text-muted-foreground">{section.intro}</p>}
            <dl className="mt-4 divide-y divide-border">
              {section.items.map((item) => (
                <div key={item.name} className="py-3 first:pt-0 last:pb-0">
                  <dt className="font-medium text-foreground">{item.name}</dt>
                  <dd className="mt-1 text-sm text-foreground/90">{item.means}</dd>
                  {item.how && (
                    <dd className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">How it is worked out: </span>
                      {item.how}
                    </dd>
                  )}
                  {item.tip && (
                    <dd className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">Good to know: </span>
                      {item.tip}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
