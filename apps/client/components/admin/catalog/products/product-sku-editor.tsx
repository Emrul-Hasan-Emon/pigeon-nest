'use client';

import type { Attribute } from '@/types/attribute';
import type { Sku } from '@/types/product';
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
    if (draft.id === undefined && validPairs(draft).length === 0) {
      return 'Every new SKU needs at least one attribute and value.';
    }
  }
  return null;
}

export function buildCreateSkus(drafts: SkuDraft[]): CreateSkuPayload[] {
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
      variants: validPairs(draft),
    }));
}

export function buildSkuChanges(drafts: SkuDraft[]): {
  skus: UpdateSkuPayload[];
  removeSkuIds: number[];
} {
  const removeSkuIds = drafts
    .filter((draft) => draft.removed && draft.id !== undefined)
    .map((draft) => draft.id as number);

  const skus = drafts
    .filter((draft) => !draft.removed)
    .map((draft): UpdateSkuPayload => {
      const common = {
        price: Number(draft.price),
        discountedPrice: draft.discountedPrice !== '' ? Number(draft.discountedPrice) : undefined,
        quantity: Number(draft.quantity) || 0,
        lowStockThreshold: Number(draft.lowStockThreshold) || 0,
        isActive: draft.isActive,
      };
      if (draft.id !== undefined) {
        return { id: draft.id, ...common, ...(draft.isDefault ? { isDefault: true } : {}) };
      }
      return {
        sku: draft.sku || undefined,
        ...common,
        isDefault: draft.isDefault,
        variants: validPairs(draft),
      };
    });

  return { skus, removeSkuIds };
}

const inputClass =
  'w-full rounded-md border border-input px-2 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ProductSkuEditor({
  drafts,
  onChange,
  attributes,
}: {
  drafts: SkuDraft[];
  onChange: (drafts: SkuDraft[]) => void;
  attributes: Attribute[];
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
            <div className="flex items-center gap-3 text-xs">
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
                  className="font-medium text-primary hover:underline"
                >
                  Undo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removeDraft(draft)}
                  className="font-medium text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {!draft.removed && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                {draft.id === undefined && (
                  <input
                    className={inputClass}
                    placeholder="SKU code"
                    value={draft.sku}
                    onChange={(event) => patch(draft.key, { sku: event.target.value })}
                  />
                )}
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  placeholder="Price *"
                  value={draft.price}
                  onChange={(event) => patch(draft.key, { price: event.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  placeholder="Discounted"
                  value={draft.discountedPrice}
                  onChange={(event) => patch(draft.key, { discountedPrice: event.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  placeholder="Qty"
                  value={draft.quantity}
                  onChange={(event) => patch(draft.key, { quantity: event.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  placeholder="Low stock at"
                  value={draft.lowStockThreshold}
                  onChange={(event) => patch(draft.key, { lowStockThreshold: event.target.value })}
                />
                <label className="flex items-center gap-1 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => patch(draft.key, { isActive: event.target.checked })}
                  />
                  Active
                </label>
              </div>

              {draft.id === undefined && (
                <div className="mt-2 space-y-2">
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
                          <option value="">Attribute…</option>
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
                          <option value="">Value…</option>
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
                    + Add attribute
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
