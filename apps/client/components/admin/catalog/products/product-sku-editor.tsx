'use client';

import { Opt, Req } from '@/components/products/field-tag';
import type { Attribute } from '@/types/attribute';
import type { Product, Sku, SkuParent } from '@/types/product';
import type { ProductPortal } from '@/lib/products/portal';
import { BirdSkuFields, emptyParentDrafts, ParentDraftFields, SkuParents, validateBirdDrafts, type ParentDrafts } from '@/components/products/bird-fields';
import type { CreateSkuPayload, UpdateSkuPayload } from '@/lib/api/products';

interface VariantPairDraft {
  attributeId: string;
  attributeValueId: string;
}

export interface SkuDraft {
  key: string;
  id?: number;
  sku: string;
  price: string;
  discountedPrice: string;
  quantity: string;
  lowStockThreshold: string;
  isDefault: boolean;
  isActive: boolean;
  acceptProposals: boolean;
  /** Blank means no floor. Hidden from buyers. */
  minProposalPrice: string;
  // About the bird this option sells. Blank means not given.
  ringNumber: string;
  hatchDate: string;
  vaccineName: string;
  vaccinatedOn: string;
  /** What the server holds. Father and mother save on their own, not with the form. */
  parents?: SkuParent[];
  /** Father and mother typed for an option that is not saved yet. They are saved right after it. */
  newParents: ParentDrafts;
  // New rows pick variants; existing rows only display them (immutable).
  variants: VariantPairDraft[];
  variantLabel?: string;
  removed?: boolean;
}

let keyCounter = 0;
const nextKey = () => `sku-${keyCounter++}`;

export function emptySkuDraft(isDefault = false): SkuDraft {
  return {
    key: nextKey(),
    sku: '',
    price: '',
    discountedPrice: '',
    quantity: '0',
    lowStockThreshold: '5',
    isDefault,
    isActive: true,
    acceptProposals: false,
    minProposalPrice: '',
    ringNumber: '',
    hatchDate: '',
    vaccineName: '',
    vaccinatedOn: '',
    newParents: emptyParentDrafts(),
    variants: [{ attributeId: '', attributeValueId: '' }],
  };
}

export function skuToDraft(sku: Sku): SkuDraft {
  return {
    key: nextKey(),
    id: sku.id,
    sku: sku.sku ?? '',
    price: String(sku.price),
    discountedPrice: sku.discountedPrice != null ? String(sku.discountedPrice) : '',
    quantity: String(sku.quantity),
    lowStockThreshold: String(sku.lowStockThreshold),
    isDefault: sku.isDefault,
    isActive: sku.isActive,
    acceptProposals: sku.acceptProposals ?? false,
    minProposalPrice: sku.minProposalPrice ? String(sku.minProposalPrice) : '',
    ringNumber: sku.ringNumber ?? '',
    hatchDate: sku.hatchDate ?? '',
    vaccineName: sku.vaccineName ?? '',
    vaccinatedOn: sku.vaccinatedOn ?? '',
    parents: sku.parents,
    newParents: emptyParentDrafts(),
    variants: [],
    variantLabel:
      sku.variants.map((v) => `${v.attribute.name}: ${v.attributeValue.name}`).join(', ') || '—',
  };
}

function validPairs(draft: SkuDraft) {
  return draft.variants
    .filter((pair) => pair.attributeId && pair.attributeValueId)
    .map((pair) => ({
      attributeId: Number(pair.attributeId),
      attributeValueId: Number(pair.attributeValueId),
    }));
}

/** Returns an error message, or null when every live row is valid. */
export function validateSkuDrafts(drafts: SkuDraft[]): string | null {
  const live = drafts.filter((draft) => !draft.removed);
  if (live.length === 0) return 'A product needs at least one SKU.';
  for (const draft of live) {
    const price = Number(draft.price);
    if (draft.price === '' || Number.isNaN(price) || price < 0) {
      return 'Every SKU needs a valid price.';
    }
    if (draft.discountedPrice !== '' && Number(draft.discountedPrice) > price) {
      return 'A discounted price cannot exceed the price.';
    }
    if (draft.minProposalPrice !== '' && (Number.isNaN(Number(draft.minProposalPrice)) || Number(draft.minProposalPrice) < 0)) {
      return 'The lowest price for proposals must be 0 or more.';
    }
    if (draft.id === undefined && validPairs(draft).length === 0) {
      return 'Every new SKU needs at least one attribute and value.';
    }
  }
  return validateBirdDrafts(live);
}

// The payload types in lib/api/products.ts do not list the proposal fields yet, so they are added here.
interface ProposalSkuFields {
  acceptProposals: boolean;
  minProposalPrice?: number;
}

// New option: only the bird facts that were filled in. Saved option: all four, a blank one clears it.
const birdOf = (draft: SkuDraft, clearBlank: boolean) => {
  const out: Record<string, string> = {};
  for (const k of ['ringNumber', 'hatchDate', 'vaccineName', 'vaccinatedOn'] as const) {
    const v = draft[k].trim();
    if (v || clearBlank) out[k] = v;
  }
  return out;
};

// A blank floor is left out on create and sent as 0 on update (the API cannot clear it with null).
const floorOf = (draft: SkuDraft) => (draft.minProposalPrice !== '' ? Number(draft.minProposalPrice) || 0 : 0);

export function buildCreateSkus(drafts: SkuDraft[]): (CreateSkuPayload & ProposalSkuFields)[] {
  return drafts
    .filter((draft) => !draft.removed)
    .map((draft) => ({
      sku: draft.sku || undefined,
      price: Number(draft.price),
      discountedPrice: draft.discountedPrice !== '' ? Number(draft.discountedPrice) : undefined,
      quantity: Number(draft.quantity) || 0,
      lowStockThreshold: Number(draft.lowStockThreshold) || 0,
      isDefault: draft.isDefault,
      isActive: draft.isActive,
      acceptProposals: draft.acceptProposals,
      ...(floorOf(draft) > 0 ? { minProposalPrice: floorOf(draft) } : {}),
      ...birdOf(draft, false),
      variants: validPairs(draft),
    }));
}

export function buildSkuChanges(drafts: SkuDraft[]): {
  skus: (UpdateSkuPayload & ProposalSkuFields)[];
  removeSkuIds: number[];
} {
  const removeSkuIds = drafts
    .filter((draft) => draft.removed && draft.id !== undefined)
    .map((draft) => draft.id as number);

  const skus = drafts
    .filter((draft) => !draft.removed)
    .map((draft): UpdateSkuPayload & ProposalSkuFields => {
      const common = {
        price: Number(draft.price),
        discountedPrice: draft.discountedPrice !== '' ? Number(draft.discountedPrice) : undefined,
        quantity: Number(draft.quantity) || 0,
        lowStockThreshold: Number(draft.lowStockThreshold) || 0,
        isActive: draft.isActive,
        acceptProposals: draft.acceptProposals,
        minProposalPrice: floorOf(draft),
      };
      if (draft.id !== undefined) {
        return { id: draft.id, ...common, ...birdOf(draft, true), ...(draft.isDefault ? { isDefault: true } : {}) };
      }
      return {
        sku: draft.sku || undefined,
        ...common,
        ...birdOf(draft, false),
        isDefault: draft.isDefault,
        variants: validPairs(draft),
      };
    });

  return { skus, removeSkuIds };
}

/** A field with its name above it and a line saying what to enter, so a number is never left unlabelled. */
function SkuField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      {required ? <Req /> : <Opt />}
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-input px-2 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ProductSkuEditor({
  drafts,
  onChange,
  attributes,
  productId,
  portal,
  onProduct,
}: {
  drafts: SkuDraft[];
  onChange: (drafts: SkuDraft[]) => void;
  attributes: Attribute[];
  /** Given on the edit page. Father and mother need a saved option, so a new product leaves these out. */
  productId?: number;
  portal?: ProductPortal;
  onProduct?: (product: Product) => void;
}) {
  function patch(key: string, changes: Partial<SkuDraft>) {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  }

  function setDefault(key: string) {
    onChange(drafts.map((draft) => ({ ...draft, isDefault: draft.key === key })));
  }

  function updatePair(draft: SkuDraft, index: number, changes: Partial<VariantPairDraft>) {
    patch(draft.key, {
      variants: draft.variants.map((pair, i) => (i === index ? { ...pair, ...changes } : pair)),
    });
  }

  function removeDraft(draft: SkuDraft) {
    if (draft.id === undefined) {
      onChange(drafts.filter((row) => row.key !== draft.key));
    } else {
      patch(draft.key, { removed: true, isDefault: false });
    }
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <div
          key={draft.key}
          className={`rounded-lg border border-border p-3 ${draft.removed ? 'bg-muted opacity-60' : ''}`}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">
              {draft.id !== undefined ? (
                <>
                  {draft.sku || `SKU #${draft.id}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {draft.variantLabel}
                  </span>
                </>
              ) : (
                'New SKU'
              )}
              {draft.removed && <span className="ml-2 text-xs text-destructive">(will be removed)</span>}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {!draft.removed && (
                <label className="flex items-center gap-1 text-foreground">
                  <input
                    type="radio"
                    name="default-sku"
                    checked={draft.isDefault}
                    onChange={() => setDefault(draft.key)}
                  />
                  Default
                </label>
              )}
              {draft.removed ? (
                <button
                  type="button"
                  onClick={() => patch(draft.key, { removed: false })}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Undo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removeDraft(draft)}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {!draft.removed && (
            <>
              <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {draft.id === undefined && (
                  <SkuField label="SKU code" hint="Your own code for this item.">
                    <input
                      className={inputClass}
                      placeholder="e.g. BLUE-001"
                      value={draft.sku}
                      onChange={(event) => patch(draft.key, { sku: event.target.value })}
                    />
                  </SkuField>
                )}
                <SkuField label="Price (৳)" required hint="What one costs a customer.">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="e.g. 3800"
                    value={draft.price}
                    onChange={(event) => patch(draft.key, { price: event.target.value })}
                  />
                </SkuField>
                <SkuField label="Discounted price (৳)" hint="Lower price on offer. Leave empty for none.">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="e.g. 3500"
                    value={draft.discountedPrice}
                    onChange={(event) => patch(draft.key, { discountedPrice: event.target.value })}
                  />
                </SkuField>
                <SkuField label="Quantity in stock" hint="How many you have to sell.">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="e.g. 10"
                    value={draft.quantity}
                    onChange={(event) => patch(draft.key, { quantity: event.target.value })}
                  />
                </SkuField>
                <SkuField label="Low-stock alert at" hint="Warn me when this many or fewer are left.">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="e.g. 5"
                    value={draft.lowStockThreshold}
                    onChange={(event) => patch(draft.key, { lowStockThreshold: event.target.value })}
                  />
                </SkuField>
                <label className="flex items-start gap-2 self-center text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.isActive}
                    onChange={(event) => patch(draft.key, { isActive: event.target.checked })}
                  />
                  <span>
                    Active <Opt />
                    <span className="block text-xs font-normal text-muted-foreground">Customers can buy this item.</span>
                  </span>
                </label>
              </div>

              <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2 rounded-md bg-muted/50 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.acceptProposals}
                    onChange={(event) => patch(draft.key, { acceptProposals: event.target.checked })}
                  />
                  Accept price proposals <Opt />
                </label>
                {draft.acceptProposals && (
                  <div className="min-w-56 flex-1">
                    <input
                      className={`${inputClass} max-w-48`}
                      type="number"
                      min={0}
                      aria-label="Lowest price I will consider"
                      placeholder="Lowest price I will consider"
                      value={draft.minProposalPrice}
                      onChange={(event) => patch(draft.key, { minProposalPrice: event.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Hidden from buyers. Buyers offering less are turned down automatically. Leave empty or 0 for no floor.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-3 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  About this bird <Opt />
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Buyers see it on the product page.</span>
                </p>
                <BirdSkuFields draft={draft} onPatch={(changes) => patch(draft.key, changes)} />
                {draft.id !== undefined && productId !== undefined && portal && onProduct ? (
                  <SkuParents productId={productId} skuId={draft.id} parents={draft.parents} portal={portal} onProduct={onProduct} />
                ) : draft.id === undefined ? (
                  <ParentDraftFields value={draft.newParents} onChange={(newParents) => patch(draft.key, { newParents })} />
                ) : null}
              </div>

              {draft.id === undefined && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Variant <Req />
                    <span className="ml-2 text-xs font-normal text-muted-foreground">What makes this item different, for example Color: Blue. Choose at least one.</span>
                  </p>
                  {draft.variants.map((pair, index) => {
                    const selected = attributes.find((a) => String(a.id) === pair.attributeId);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          className={inputClass}
                          value={pair.attributeId}
                          onChange={(event) =>
                            updatePair(draft, index, {
                              attributeId: event.target.value,
                              attributeValueId: '',
                            })
                          }
                        >
                          <option value="">Choose a type…</option>
                          {attributes.map((attribute) => (
                            <option key={attribute.id} value={attribute.id}>
                              {attribute.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className={`${inputClass} disabled:opacity-50`}
                          value={pair.attributeValueId}
                          disabled={!selected}
                          onChange={(event) =>
                            updatePair(draft, index, { attributeValueId: event.target.value })
                          }
                        >
                          <option value="">Choose a value…</option>
                          {selected?.values.map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.name}
                            </option>
                          ))}
                        </select>
                        {draft.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              patch(draft.key, {
                                variants: draft.variants.filter((_, i) => i !== index),
                              })
                            }
                            className="text-xs text-destructive"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      patch(draft.key, {
                        variants: [...draft.variants, { attributeId: '', attributeValueId: '' }],
                      })
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Add another variant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...drafts, emptySkuDraft(drafts.every((d) => d.removed))])}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        + Add SKU
      </button>
    </div>
  );
}
