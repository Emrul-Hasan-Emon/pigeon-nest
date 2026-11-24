import Link from 'next/link';
import { ArrowRight, CircleAlert, Info } from 'lucide-react';
import type { HelpBlock, HelpTopic } from '@/lib/seller-help/types';

const box = 'rounded-2xl border border-border bg-card p-5 sm:p-6';

function Block({ b }: { b: HelpBlock }) {
  if (b.type === 'note') {
    const warn = b.tone === 'warn';
    const Icon = warn ? CircleAlert : Info;
    return (
      <div role="note" className={`flex gap-3 rounded-xl border px-4 py-3 text-base ${warn ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950'}`}>
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p><span className="font-semibold">{warn ? 'Be careful. ' : 'Good to know. '}</span>{b.text}</p>
      </div>
    );
  }
  return (
    <div>
      {'title' in b && b.title && <h3 className="mb-3 text-lg font-semibold text-foreground">{b.title}</h3>}
      {b.type === 'steps' && (
        <ol className="space-y-3">
          {(Array.isArray(b.steps) ? b.steps : []).map((s, i) => {
            const text = typeof s === 'string' ? s : s.text;
            const detail = typeof s === 'string' ? null : s.detail;
            return (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <span className="pt-0.5 text-base text-foreground">{text}{detail && <span className="block text-sm text-muted-foreground">{detail}</span>}</span>
              </li>
            );
          })}
        </ol>
      )}
      {b.type === 'words' && (
        <dl className="divide-y divide-border rounded-xl border border-border">
          {(Array.isArray(b.items) ? b.items : []).map((w) => (
            <div key={w.term} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-base font-semibold text-foreground">{w.term}</dt>
              <dd className="text-base text-muted-foreground">{w.means}</dd>
            </div>
          ))}
        </dl>
      )}
      {b.type === 'points' && (
        <ul className="space-y-2">
          {(Array.isArray(b.items) ? b.items : []).map((t) => (
            <li key={t} className="flex gap-3 text-base text-foreground">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {t}
            </li>
          ))}
        </ul>
      )}
      {b.type === 'faq' && (
        <div className="space-y-2">
          {(Array.isArray(b.items) ? b.items : []).map((f) => (
            <details key={f.q} className="group rounded-xl border border-border px-4 py-3">
              <summary className="cursor-pointer text-base font-semibold text-foreground">{f.q}</summary>
              <p className="mt-2 text-base text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/** One Help topic: a heading, a link to the real page, then each section as a card. */
export function HelpTopicView({ topic }: { topic: HelpTopic }) {
  return (
    <article>
      <header className="mb-6">
        <h1 className="text-foreground">{topic.title}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{topic.summary}</p>
        {topic.openPath && (
          <Link href={topic.openPath} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-base font-semibold text-primary-foreground hover:opacity-90">
            {topic.openLabel}
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        )}
      </header>
      {topic.sections.length > 3 && (
        <nav aria-label="On this page" className={`${box} mb-5`}>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
          <ul className="flex flex-wrap gap-2">
            {topic.sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="inline-block rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">{s.title}</a></li>
            ))}
          </ul>
        </nav>
      )}
      <div className="space-y-5">
        {topic.sections.map((s) => (
          <section key={s.id} id={s.id} className={`${box} scroll-mt-24 space-y-5`}>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
              {s.intro && <p className="mt-1 text-base text-muted-foreground">{s.intro}</p>}
            </div>
            {(s.blocks ?? []).map((b, i) => <Block key={i} b={b} />)}
          </section>
        ))}
      </div>
    </article>
  );
}
