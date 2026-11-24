import { ageText } from '@/lib/bird';
import { hasBirdFacts, hasSkuBird } from '@/components/products/bird-fields';
import type { Product, Sku } from '@/types/product';

const dateText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-base font-medium text-foreground">{children || <span className="font-normal text-muted-foreground">Not given</span>}</dd>
    </div>
  );
}

/** The facts about the birds that are the same for every option. Nothing at all when none were given. */
export function SellerBirdFacts({ product }: { product: Product }) {
  if (!hasBirdFacts(product)) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-6" aria-label="About the birds">
      <h2 className="mb-3 text-lg font-semibold text-foreground">About the birds</h2>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Breed">{product.breed}</Fact>
        <Fact label="Bloodline">{product.bloodline}</Fact>
        <Fact label="About the bloodline">{product.bloodlineNote}</Fact>
        <Fact label="Vaccination programme">{product.vaccinationNote}</Fact>
        <Fact label="Health">{product.healthNote}</Fact>
        <Fact label="Race record">{product.raceRecord}</Fact>
      </dl>
    </section>
  );
}

/** The bird of one option: its ring, age, vaccination, and its father and mother with their pictures. */
export function SkuBirdBlock({ sku }: { sku: Sku }) {
  if (!hasSkuBird(sku)) return null;
  const age = ageText(sku.hatchDate);
  const sire = sku.parents?.find((p) => p.role === 'sire');
  const dam = sku.parents?.find((p) => p.role === 'dam');
  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <p className="mb-2 text-base font-semibold text-foreground">About this bird</p>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {sku.ringNumber && <Fact label="Ring number">{sku.ringNumber}</Fact>}
        {sku.hatchDate && <Fact label="Hatched on">{`${dateText(sku.hatchDate)}${age ? ` (${age})` : ''}`}</Fact>}
        {(sku.vaccineName || sku.vaccinatedOn) && (
          <Fact label="Vaccine">{[sku.vaccineName, sku.vaccinatedOn ? dateText(sku.vaccinatedOn) : null].filter(Boolean).join(' · ')}</Fact>
        )}
      </dl>
      {(sire || dam) && (
        <div className="mt-4 flex flex-wrap gap-6">
          {([['Father', sire], ['Mother', dam]] as const).map(([label, p]) =>
            p ? (
              <div key={label} className="flex items-center gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={`${label}${p.name ? `: ${p.name}` : ''}`} className="h-16 w-16 rounded-lg border border-border object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">No photo</span>
                )}
                <span>
                  <span className="block text-sm text-muted-foreground">{label}</span>
                  <span className="text-base font-medium text-foreground">{[p.name, p.ringNumber].filter(Boolean).join(' · ') || '—'}</span>
                </span>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
