'use client';

import { useState } from 'react';
import { Opt } from '@/components/products/field-tag';
import { ApiError } from '@/lib/api/http';
import { ageText, todayInput } from '@/lib/bird';
import type { BirdProductPayload } from '@/lib/api/products';
import type { ProductPortal } from '@/lib/products/portal';
import type { Product, Sku, SkuParent } from '@/types/product';

const inputClass = 'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

// ---- product-level facts: the same for every option of a product ----

export interface BirdForm {
  breed: string;
  bloodline: string;
  bloodlineNote: string;
  vaccinationNote: string;
  healthNote: string;
  raceRecord: string;
}

export const emptyBirdForm = (): BirdForm => ({ breed: '', bloodline: '', bloodlineNote: '', vaccinationNote: '', healthNote: '', raceRecord: '' });

export const birdFormFrom = (p: Product): BirdForm => ({
  breed: p.breed ?? '',
  bloodline: p.bloodline ?? '',
  bloodlineNote: p.bloodlineNote ?? '',
  vaccinationNote: p.vaccinationNote ?? '',
  healthNote: p.healthNote ?? '',
  raceRecord: p.raceRecord ?? '',
});

const BIRD_KEYS = ['breed', 'bloodline', 'bloodlineNote', 'vaccinationNote', 'healthNote', 'raceRecord'] as const;

/** Create: only what was filled in. */
export function birdCreateFields(form: BirdForm): BirdProductPayload {
  const out: BirdProductPayload = {};
  for (const k of BIRD_KEYS) if (form[k].trim()) out[k] = form[k].trim();
  return out;
}

/** Update: only what changed; an emptied field is sent blank so the server clears it. */
export function birdChanges(initial: BirdForm, now: BirdForm): BirdProductPayload {
  const out: BirdProductPayload = {};
  for (const k of BIRD_KEYS) if (now[k].trim() !== initial[k].trim()) out[k] = now[k].trim();
  return out;
}

export function BirdProductFields({ value, onChange, disabled }: { value: BirdForm; onChange: (v: BirdForm) => void; disabled?: boolean }) {
  const set = (k: keyof BirdForm, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm text-foreground">
        Breed <Opt />
        <input className={inputClass} maxLength={120} disabled={disabled} placeholder="e.g. Homer, Roller" value={value.breed} onChange={(e) => set('breed', e.target.value)} />
      </label>
      <label className="text-sm text-foreground">
        Bloodline <Opt />
        <input className={inputClass} maxLength={120} disabled={disabled} placeholder="e.g. Janssen" value={value.bloodline} onChange={(e) => set('bloodline', e.target.value)} />
      </label>
      <label className="text-sm text-foreground md:col-span-2">
        About the bloodline <Opt />
        <textarea className={inputClass} rows={2} maxLength={5000} disabled={disabled} value={value.bloodlineNote} onChange={(e) => set('bloodlineNote', e.target.value)} />
      </label>
      <label className="text-sm text-foreground">
        Vaccination programme <Opt />
        <textarea className={inputClass} rows={2} maxLength={5000} disabled={disabled} placeholder="e.g. PMV and paratyphoid every year" value={value.vaccinationNote} onChange={(e) => set('vaccinationNote', e.target.value)} />
      </label>
      <label className="text-sm text-foreground">
        Health <Opt />
        <textarea className={inputClass} rows={2} maxLength={5000} disabled={disabled} placeholder="Health history and checks" value={value.healthNote} onChange={(e) => set('healthNote', e.target.value)} />
      </label>
      <label className="text-sm text-foreground md:col-span-2">
        Race record <Opt />
        <textarea className={inputClass} rows={2} maxLength={5000} disabled={disabled} placeholder="Results and achievements" value={value.raceRecord} onChange={(e) => set('raceRecord', e.target.value)} />
      </label>
    </div>
  );
}

// ---- option-level facts: one option is one bird (or one batch) ----

export interface SkuBirdDraft {
  ringNumber: string;
  hatchDate: string;
  vaccineName: string;
  vaccinatedOn: string;
}

export function BirdSkuFields({ draft, onPatch }: { draft: SkuBirdDraft; onPatch: (changes: Partial<SkuBirdDraft>) => void }) {
  const today = todayInput();
  const age = ageText(draft.hatchDate);
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm font-medium text-foreground">
        Ring number <Opt />
        <input className={inputClass} maxLength={60} placeholder="e.g. BD-2026-001" value={draft.ringNumber} onChange={(e) => onPatch({ ringNumber: e.target.value })} />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">One ring = one bird. Add each ringed bird as its own option.</span>
      </label>
      <label className="block text-sm font-medium text-foreground">
        Hatched on <Opt />
        <input className={inputClass} type="date" max={today} value={draft.hatchDate} onChange={(e) => onPatch({ hatchDate: e.target.value })} />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{age || 'The age is worked out from this.'}</span>
      </label>
      <label className="block text-sm font-medium text-foreground">
        Vaccine <Opt />
        <input className={inputClass} maxLength={120} placeholder="e.g. PMV" value={draft.vaccineName} onChange={(e) => onPatch({ vaccineName: e.target.value })} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Vaccinated on <Opt />
        <input className={inputClass} type="date" min={draft.hatchDate || undefined} max={today} value={draft.vaccinatedOn} onChange={(e) => onPatch({ vaccinatedOn: e.target.value })} />
      </label>
    </div>
  );
}

/** Returns a message when the bird fields of the options break a rule the server also checks. */
export function validateBirdDrafts(drafts: Array<SkuBirdDraft & { removed?: boolean }>): string | null {
  const today = todayInput();
  const seen = new Set<string>();
  for (const d of drafts) {
    if (d.removed) continue;
    if (d.hatchDate && d.hatchDate > today) return 'A hatch date cannot be in the future.';
    if (d.vaccinatedOn && d.vaccinatedOn > today) return 'A vaccination date cannot be in the future.';
    if (d.hatchDate && d.vaccinatedOn && d.vaccinatedOn < d.hatchDate) return 'A vaccination date cannot be before the hatch date.';
    const ring = d.ringNumber.trim().toLowerCase();
    if (ring) {
      if (seen.has(ring)) return `Ring number ${d.ringNumber.trim()} is used on two options.`;
      seen.add(ring);
    }
  }
  return null;
}

// ---- father and mother ----

const ROLE_LABEL = { sire: 'Father (sire)', dam: 'Mother (dam)' } as const;

function ParentBox({
  role,
  parent,
  productId,
  skuId,
  portal,
  onProduct,
}: {
  role: 'sire' | 'dam';
  parent: SkuParent | undefined;
  productId: number;
  skuId: number;
  portal: ProductPortal;
  onProduct: (p: Product) => void;
}) {
  const [name, setName] = useState(parent?.name ?? '');
  const [ring, setRing] = useState(parent?.ringNumber ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = file ? URL.createObjectURL(file) : parent?.imageUrl ?? null;

  async function run(work: () => Promise<Product>, afterOk?: () => void) {
    setBusy(true);
    setError(null);
    try {
      onProduct(await work());
      afterOk?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const empty = !name.trim() && !ring.trim() && !file && !parent?.imageUrl;
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-sm font-medium text-foreground">{ROLE_LABEL[role]} <Opt /></p>
      <div className="flex gap-3">
        <div className="shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${ROLE_LABEL[role]} photo`} className="h-20 w-20 rounded-md border border-border object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">No photo</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input className={inputClass.replace('mt-1 ', '')} maxLength={120} placeholder="Name" aria-label={`${ROLE_LABEL[role]} name`} value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass.replace('mt-1 ', '')} maxLength={60} placeholder="Ring number" aria-label={`${ROLE_LABEL[role]} ring number`} value={ring} onChange={(e) => setRing(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {preview ? 'Replace photo' : 'Add photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {parent?.imageUrl && !file && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => portal.saveParent(productId, skuId, role, { removeImage: true }))}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || empty}
          onClick={() =>
            run(
              () => portal.saveParent(productId, skuId, role, { name: name.trim(), ringNumber: ring.trim(), image: file }),
              () => setFile(null),
            )
          }
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : parent ? 'Save changes' : `Save ${role === 'sire' ? 'father' : 'mother'}`}
        </button>
        {parent && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => portal.removeParent(productId, skuId, role), () => {
                setName('');
                setRing('');
                setFile(null);
              })
            }
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Remove {role === 'sire' ? 'father' : 'mother'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Father and mother of one saved option. Each box saves on its own, straight away. */
export function SkuParents({
  productId,
  skuId,
  parents,
  portal,
  onProduct,
}: {
  productId: number;
  skuId: number;
  parents: SkuParent[] | undefined;
  portal: ProductPortal;
  onProduct: (p: Product) => void;
}) {
  const find = (role: 'sire' | 'dam') => parents?.find((p) => p.role === role);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {(['sire', 'dam'] as const).map((role) => (
        // The key resets the box when the saved parent changes, so its fields show what the server holds.
        <ParentBox key={`${role}-${find(role)?.id ?? 'none'}-${find(role)?.imageUrl ?? ''}-${find(role)?.name ?? ''}-${find(role)?.ringNumber ?? ''}`} role={role} parent={find(role)} productId={productId} skuId={skuId} portal={portal} onProduct={onProduct} />
      ))}
    </div>
  );
}

// ---- father and mother of an option that is not saved yet ----

export interface ParentDraft {
  name: string;
  ringNumber: string;
  file: File | null;
}
export interface ParentDrafts {
  sire: ParentDraft;
  dam: ParentDraft;
}
export const emptyParentDrafts = (): ParentDrafts => ({
  sire: { name: '', ringNumber: '', file: null },
  dam: { name: '', ringNumber: '', file: null },
});
const hasParent = (p: ParentDraft) => !!(p.name.trim() || p.ringNumber.trim() || p.file);

/** Father and mother typed for a new option. They are saved right after the option itself is saved. */
export function ParentDraftFields({ value, onChange }: { value: ParentDrafts; onChange: (v: ParentDrafts) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {(['sire', 'dam'] as const).map((role) => {
        const p = value[role];
        const set = (changes: Partial<ParentDraft>) => onChange({ ...value, [role]: { ...p, ...changes } });
        const preview = p.file ? URL.createObjectURL(p.file) : null;
        return (
          <div key={role} className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">{ROLE_LABEL[role]} <Opt /></p>
            <div className="flex gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={`${ROLE_LABEL[role]} photo`} className="h-20 w-20 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">No photo</span>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <input className={inputClass.replace('mt-1 ', '')} maxLength={120} placeholder="Name" aria-label={`${ROLE_LABEL[role]} name`} value={p.name} onChange={(e) => set({ name: e.target.value })} />
                <input className={inputClass.replace('mt-1 ', '')} maxLength={60} placeholder="Ring number" aria-label={`${ROLE_LABEL[role]} ring number`} value={p.ringNumber} onChange={(e) => set({ ringNumber: e.target.value })} />
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                    {p.file ? 'Replace photo' : 'Add photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => set({ file: e.target.files?.[0] ?? null })} />
                  </label>
                  {p.file && (
                    <button type="button" onClick={() => set({ file: null })} className="text-xs text-destructive hover:underline">
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Saves the typed fathers and mothers of new options. `skuIds` are the new options' ids in the order they were added,
 * `drafts` the matching typed parents. Returns how many could not be saved.
 */
export async function saveNewParents(portal: ProductPortal, productId: number, skuIds: number[], drafts: ParentDrafts[]): Promise<number> {
  let failed = 0;
  for (let i = 0; i < skuIds.length; i++) {
    for (const role of ['sire', 'dam'] as const) {
      const p = drafts[i]?.[role];
      if (!p || !hasParent(p)) continue;
      try {
        await portal.saveParent(productId, skuIds[i], role, { name: p.name.trim() || undefined, ringNumber: p.ringNumber.trim() || undefined, image: p.file });
      } catch {
        failed += 1;
      }
    }
  }
  return failed;
}

// ---- read-only ----

/** The bird of an order line, in a few words: ring, age, breed. Empty when there is nothing to say. */
export function orderBirdText(bird: { ringNumber: string | null; hatchDate: string | null; breed: string | null; bloodline?: string | null } | null | undefined): string[] {
  if (!bird) return [];
  return [
    bird.ringNumber ? `Ring ${bird.ringNumber}` : '',
    ageText(bird.hatchDate),
    [bird.breed, bird.bloodline].filter(Boolean).join(' · '),
  ].filter(Boolean);
}

const dateText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-foreground">{children || <span className="text-muted-foreground">Not given</span>}</dd>
    </div>
  );
}

export const hasBirdFacts = (p: Partial<BirdForm> | Product) => BIRD_KEYS.some((k) => !!(p as Record<string, unknown>)[k]);

/** The product's bird facts as a card. Nothing at all when none were given. */
export function BirdFactsCard({ product }: { product: Product }) {
  if (!hasBirdFacts(product)) return null;
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-semibold text-foreground">About the birds</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row label="Breed">{product.breed}</Row>
        <Row label="Bloodline">{product.bloodline}</Row>
        <Row label="About the bloodline">{product.bloodlineNote}</Row>
        <Row label="Vaccination programme">{product.vaccinationNote}</Row>
        <Row label="Health">{product.healthNote}</Row>
        <Row label="Race record">{product.raceRecord}</Row>
      </dl>
    </div>
  );
}

export const hasSkuBird = (sku: Sku) => !!(sku.ringNumber || sku.hatchDate || sku.vaccineName || sku.vaccinatedOn || (sku.parents?.length ?? 0) > 0);

/** One option's bird: ring, age, vaccination and the parents with their photos. Nothing when it has none. */
export function SkuBirdLine({ sku }: { sku: Sku }) {
  if (!hasSkuBird(sku)) return null;
  const age = ageText(sku.hatchDate);
  const sire = sku.parents?.find((p) => p.role === 'sire');
  const dam = sku.parents?.find((p) => p.role === 'dam');
  return (
    <div className="space-y-2 text-sm">
      <p className="text-foreground">
        {sku.ringNumber && <span className="mr-4"><span className="text-muted-foreground">Ring: </span><span className="font-medium">{sku.ringNumber}</span></span>}
        {sku.hatchDate && <span className="mr-4"><span className="text-muted-foreground">Hatched: </span>{dateText(sku.hatchDate)}{age ? ` (${age})` : ''}</span>}
        {(sku.vaccineName || sku.vaccinatedOn) && (
          <span><span className="text-muted-foreground">Vaccine: </span>{[sku.vaccineName, sku.vaccinatedOn ? dateText(sku.vaccinatedOn) : null].filter(Boolean).join(' · ')}</span>
        )}
      </p>
      {(sire || dam) && (
        <div className="flex flex-wrap gap-4">
          {([['Father', sire], ['Mother', dam]] as const).map(([label, p]) =>
            p ? (
              <div key={label} className="flex items-center gap-2">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={`${label}${p.name ? `: ${p.name}` : ''}`} className="h-12 w-12 rounded-md border border-border object-cover" />
                )}
                <span>
                  <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
                  <span className="text-foreground">{[p.name, p.ringNumber].filter(Boolean).join(' · ') || '—'}</span>
                </span>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
