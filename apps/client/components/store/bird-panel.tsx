import { ageText } from '@/lib/bird';
import type { BirdParent, ProductBird, SkuBird } from '@/types/storefront';

const dateText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const hasProductBird = (b?: ProductBird) => !!b && Object.values(b).some(Boolean);
export const hasSkuBird = (b?: SkuBird) => !!b && !!(b.ringNumber || b.hatchDate || b.vaccineName || b.vaccinatedOn || b.sire || b.dam);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-st-slate">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-st-ink">{children || <span className="text-st-slate">Not given</span>}</dd>
    </div>
  );
}

/** The facts about the birds of this product. Everything here is the seller's own word. */
export function AboutBird({ bird }: { bird?: ProductBird }) {
  if (!bird || !hasProductBird(bird)) return null;
  return (
    <section className="mt-6 border-t border-st-line pt-4" aria-labelledby="about-bird-title">
      <h2 id="about-bird-title" className="font-display text-lg font-semibold text-st-ink">Bird details</h2>
      <p className="mt-0.5 text-xs text-st-slate">Details from the seller. Pigeon Nest has not checked them.</p>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Breed">{bird.breed}</Row>
        <Row label="Bloodline">{bird.bloodline}</Row>
        {bird.bloodlineNote && <Row label="About the bloodline">{bird.bloodlineNote}</Row>}
        {bird.vaccinationNote && <Row label="Vaccination programme">{bird.vaccinationNote}</Row>}
        {bird.healthNote && <Row label="Health">{bird.healthNote}</Row>}
        {bird.raceRecord && <Row label="Race record">{bird.raceRecord}</Row>}
      </dl>
    </section>
  );
}

function Parent({ label, parent }: { label: string; parent: BirdParent | null }) {
  if (!parent) return null;
  const text = [parent.name, parent.ringNumber].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3">
      {parent.imageUrl ? (
        <a href={parent.imageUrl} target="_blank" rel="noreferrer" aria-label={`Open the photo of the ${label.toLowerCase()} larger`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={parent.imageUrl} alt={`${label}${parent.name ? `: ${parent.name}` : ''}`} loading="lazy" className="h-16 w-16 rounded-lg border border-st-line object-cover" />
        </a>
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-st-line text-[10px] text-st-slate">No photo</span>
      )}
      <span className="min-w-0">
        <span className="block text-xs text-st-slate">{label}</span>
        <span className="text-sm font-medium text-st-ink">{text || 'Name not given'}</span>
      </span>
    </div>
  );
}

/** The bird the picked option sells: its ring, age, vaccination and parents. It changes with the option. */
export function SelectedBird({ bird }: { bird?: SkuBird }) {
  if (!bird || !hasSkuBird(bird)) return null;
  const age = ageText(bird.hatchDate);
  return (
    <section className="mt-5 rounded-xl border border-st-line bg-white p-4" aria-label="This bird">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold text-st-ink">This bird</h2>
        {bird.vaccinatedOn && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Vaccinated</span>}
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Row label="Ring number">{bird.ringNumber}</Row>
        <Row label="Age">{bird.hatchDate ? `${age ? `${age} · ` : 'Hatched '}${dateText(bird.hatchDate)}` : ''}</Row>
        <Row label="Vaccine">{[bird.vaccineName, bird.vaccinatedOn ? dateText(bird.vaccinatedOn) : null].filter(Boolean).join(' · ')}</Row>
      </dl>
      {(bird.sire || bird.dam) && (
        <div className="mt-4 flex flex-wrap gap-6">
          <Parent label="Father" parent={bird.sire} />
          <Parent label="Mother" parent={bird.dam} />
        </div>
      )}
    </section>
  );
}
