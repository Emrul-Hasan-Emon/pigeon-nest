'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAttribute, updateAttribute } from '@/lib/api/attributes';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import { AttributeValuesManager } from './attribute-values-manager';
import type { Attribute, AttributeValue } from '@/types/attribute';

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
}

interface DraftValue {
  name: string;
  colorCode: string;
}

function toFormState(attribute?: Attribute): FormState {
  return {
    name: attribute?.name ?? '',
    description: attribute?.description ?? '',
    isActive: attribute?.isActive ?? true,
  };
}

export function AttributeForm({ attribute }: { attribute?: Attribute }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = attribute !== undefined;

  const initial = useMemo(() => toFormState(attribute), [attribute]);
  const [form, setForm] = useState<FormState>(initial);
  const [values, setValues] = useState<AttributeValue[]>(attribute?.values ?? []);
  const [draftValues, setDraftValues] = useState<DraftValue[]>([]);
  const [draft, setDraft] = useState<DraftValue>({ name: '', colorCode: '' });
  const [nameError, setNameError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addDraftValue() {
    if (!draft.name.trim()) return;
    setDraftValues((current) => [...current, draft]);
    setDraft({ name: '', colorCode: '' });
  }

  function removeDraftValue(index: number) {
    setDraftValues((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setGeneralError(null);

    if (!form.name.trim()) {
      setNameError('Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, unknown> = {};
        if (form.name !== initial.name) payload.name = form.name;
        if (form.description !== initial.description) {
          payload.description = form.description || null;
        }
        if (form.isActive !== initial.isActive) payload.isActive = form.isActive;

        if (Object.keys(payload).length > 0) {
          await updateAttribute(attribute!.id, payload);
        }
      } else {
        await createAttribute({
          name: form.name,
          description: form.description || null,
          isActive: form.isActive,
          ...(draftValues.length
            ? {
                values: draftValues.map((value) => ({
                  name: value.name,
                  colorCode: value.colorCode || null,
                })),
              }
            : {}),
        });
      }
      showToast(isEdit ? 'Attribute updated.' : 'Attribute created.', 'success');
      router.push('/admin/catalog/attributes');
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        showToast('That attribute no longer exists.', 'error');
        router.push('/admin/catalog/attributes');
        return;
      }
      if (error instanceof ApiError) {
        const message = error.message.toLowerCase();
        if (message.includes('name')) {
          setNameError(error.message);
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {isEdit ? 'Edit attribute' : 'Add attribute'}
        </h1>
        <Link href="/admin/catalog/attributes" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {generalError && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {generalError}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-foreground">
            Name *
            <input
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none ${
                nameError ? 'border-destructive' : 'border-input'
              }`}
              required
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            />
            {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground md:pt-6">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((f) => ({ ...f, isActive: event.target.checked }))
              }
            />
            Active
          </label>

          <label className="text-sm text-foreground md:col-span-2">
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({ ...f, description: event.target.value }))
              }
            />
          </label>
        </div>

        {isEdit ? (
          <AttributeValuesManager
            attributeId={attribute!.id}
            values={values}
            onValuesChange={setValues}
          />
        ) : (
          <div className="mt-5">
            <span className="text-sm font-medium text-foreground">Values</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Add values now, or save the attribute first and add them on the edit page.
            </p>

            <div className="mt-2 divide-y divide-border rounded-lg border border-border">
              {draftValues.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No values yet.</p>
              )}
              {draftValues.map((value, index) => (
                <div key={index} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {value.colorCode && (
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-border"
                        style={{ backgroundColor: value.colorCode }}
                      />
                    )}
                    <span className="text-foreground">{value.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraftValue(index)}
                    className="font-medium text-destructive hover:opacity-70"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                placeholder="New value name"
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                className="w-44 rounded-md border border-input px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <input
                type="color"
                value={draft.colorCode || '#000000'}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, colorCode: event.target.value }))
                }
                className="h-8 w-9 rounded-md border border-input"
              />
              <button
                type="button"
                onClick={addDraftValue}
                disabled={!draft.name.trim()}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Add value
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isEdit ? 'Update attribute' : 'Create attribute'}
        </button>
      </form>
    </div>
  );
}
