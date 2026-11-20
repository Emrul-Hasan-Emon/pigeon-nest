'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createHomepageSection,
  listSectionTypes,
  updateHomepageSection,
  updateHomepageSlot,
} from '@/lib/api/homepage';
import { ApiError } from '@/lib/api/http';
import { fromLocalInput, toLocalInput } from '@/lib/datetime';
import { useToast } from '@/components/ui/toast';
import type {
  ConfigField,
  HomepageDevice,
  HomepageLayout,
  HomepageSectionDetail,
  HomepageWritePayload,
  LookupEntity,
  SectionTypeDefinition,
} from '@/types/homepage';
import { EntityPicker } from './entity-picker';
import { SectionPreview } from './section-preview';

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

type Mode = 'section' | 'slot';

export function SectionForm({ mode, section }: { mode: Mode; section?: HomepageSectionDetail }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = section !== undefined;
  const listHref = mode === 'slot' ? '/admin/content/homepage-slots' : '/admin/content/homepage';

  const [types, setTypes] = useState<SectionTypeDefinition[]>([]);
  const [current, setCurrent] = useState(section);
  const [sectionType, setSectionType] = useState(section?.sectionType ?? 'featured_products');
  const [title, setTitle] = useState(section?.title ?? '');
  const [layout, setLayout] = useState<HomepageLayout>(section?.layout ?? 'carousel');
  const [device, setDevice] = useState<HomepageDevice>(section?.deviceVisibility ?? 'both');
  const [sortOrder, setSortOrder] = useState(section ? String(section.sortOrder) : '');
  const [startsAt, setStartsAt] = useState(toLocalInput(section?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(section?.endsAt));
  const [isActive, setIsActive] = useState(section?.isActive ?? true);
  const [config, setConfig] = useState<Record<string, unknown>>(section?.config ?? {});
  const [entities, setEntities] = useState<Record<string, LookupEntity[]>>(section?.entities ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    listSectionTypes()
      .then((list) => {
        setTypes(list);
        // new section: start with the default type's title
        if (!section) {
          const first = list.find((t) => t.type === 'featured_products');
          setTitle((current) => current || first?.defaultTitle || '');
        }
      })
      .catch(() => showToast('Failed to load section types.', 'error'));
  }, [showToast, section]);

  const definition = useMemo(() => types.find((t) => t.type === sectionType), [types, sectionType]);

  function changeType(next: string) {
    const prevDefault = definition?.defaultTitle;
    setSectionType(next);
    setConfig({});
    setEntities({});
    const nextDef = types.find((t) => t.type === next);
    if (nextDef && (!title.trim() || title === prevDefault)) setTitle(nextDef.defaultTitle);
  }

  /** Set one config key; fields in an "exactly one" group clear each other. */
  function setField(field: ConfigField, value: unknown, picked?: LookupEntity[]) {
    setConfig((c) => {
      const next = { ...c, [field.key]: value };
      if (definition?.exactlyOne?.includes(field.key) && value !== undefined && value !== '') {
        for (const other of definition.exactlyOne) if (other !== field.key) delete next[other];
      }
      return next;
    });
    if (picked) {
      setEntities((e) => {
        const next = { ...e, [field.key]: picked };
        if (definition?.exactlyOne?.includes(field.key) && picked.length > 0) {
          for (const other of definition.exactlyOne) if (other !== field.key) delete next[other];
        }
        return next;
      });
    }
  }

  function buildConfig(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of definition?.fields ?? []) {
      const v = config[f.key];
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      out[f.key] = v;
    }
    return out;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!definition) return setError('Pick a section type.');
    if (!title.trim()) return setError('Title is required.');
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return setError('End must be after start.');

    const built = buildConfig();
    for (const f of definition.fields) {
      if (f.required && built[f.key] === undefined) return setError(`${f.label} is required.`);
    }
    if (definition.exactlyOne) {
      const set = definition.exactlyOne.filter((k) => built[k] !== undefined);
      if (set.length !== 1) {
        const labels = definition.exactlyOne.map((k) => definition.fields.find((f) => f.key === k)?.label ?? k);
        return setError(`Choose exactly one of: ${labels.join(' or ')}.`);
      }
    }
    let order: number | undefined;
    if (mode === 'section' && sortOrder.trim() !== '') {
      order = Number(sortOrder);
      if (!Number.isInteger(order) || order < 0 || order > 100000) {
        return setError('Sort order must be a whole number from 0 to 100000.');
      }
    }

    const payload: HomepageWritePayload = {
      sectionType,
      title: title.trim(),
      layout,
      deviceVisibility: device,
      isActive,
      config: built,
    };
    if (mode === 'section' && order !== undefined) payload.sortOrder = order;

    setSubmitting(true);
    try {
      if (!isEdit) {
        payload.startsAt = fromLocalInput(startsAt);
        payload.endsAt = fromLocalInput(endsAt);
        await createHomepageSection(payload);
        showToast('Section created.', 'success');
        router.push(listHref);
        return;
      }
      payload.startsAt = fromLocalInput(startsAt) ?? null;
      payload.endsAt = fromLocalInput(endsAt) ?? null;
      const updated =
        mode === 'slot'
          ? await updateHomepageSlot(current!.id, payload)
          : await updateHomepageSection(current!.id, payload);
      setCurrent(updated);
      setConfig(updated.config);
      setEntities(updated.entities);
      setPreviewKey((k) => k + 1);
      showToast(mode === 'slot' ? 'Slot updated.' : 'Section updated.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(f: ConfigField) {
    const value = config[f.key];
    const label = (
      <>
        {f.label}
        {f.required ? ' *' : ''}
      </>
    );
    const help = f.help ? <p className="mt-1 text-xs text-muted-foreground">{f.help}</p> : null;

    if (f.kind === 'boolean') {
      return (
        <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : f.default === true}
            onChange={(e) => setField(f, e.target.checked)}
          />
          {f.label}
        </label>
      );
    }
    if (f.kind === 'enum') {
      return (
        <label key={f.key} className="text-sm text-foreground">
          {label}
          <select className={fieldClass} value={typeof value === 'string' ? value : ''} onChange={(e) => setField(f, e.target.value || undefined)}>
            <option value="">— None —</option>
            {f.enumValues?.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {help}
        </label>
      );
    }
    if (f.kind === 'int' && !f.entity) {
      return (
        <label key={f.key} className="text-sm text-foreground">
          {label}
          <input
            className={fieldClass}
            inputMode="numeric"
            placeholder={f.default !== undefined ? String(f.default) : ''}
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setField(f, raw === '' ? undefined : Number(raw));
            }}
          />
          {(f.min !== undefined || f.max !== undefined) && (
            <p className="mt-1 text-xs text-muted-foreground">{f.min} to {f.max}</p>
          )}
        </label>
      );
    }
    // entity pickers
    const selected = entities[f.key] ?? [];
    return (
      <div key={f.key} className="text-sm text-foreground md:col-span-2">
        {label}
        <EntityPicker
          kind={f.entity!}
          multi={f.kind === 'intArray'}
          selected={selected}
          maxItems={f.maxItems}
          onChange={(next) =>
            setField(f, f.kind === 'intArray' ? next.map((e) => e.id) : (next[0]?.id ?? undefined), next)
          }
        />
        {help}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">
        {mode === 'slot' ? `Slot ${current?.slotNo ?? ''}` : isEdit ? 'Edit section' : 'New section'}
      </h1>

      {current && current.warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Some picked items will not show on the storefront:</p>
          <ul className="list-inside list-disc">
            {current.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
          <label className="text-sm text-foreground">
            Section type
            <select className={fieldClass} value={sectionType} onChange={(e) => changeType(e.target.value)}>
              {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
            {definition && <p className="mt-1 text-xs text-muted-foreground">{definition.description}</p>}
          </label>
          <label className="text-sm text-foreground">
            Title *
            <input className={fieldClass} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            Layout
            <select className={fieldClass} value={layout} onChange={(e) => setLayout(e.target.value as HomepageLayout)}>
              <option value="carousel">Carousel</option>
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </label>
          <label className="text-sm text-foreground">
            Shown on
            <select className={fieldClass} value={device} onChange={(e) => setDevice(e.target.value as HomepageDevice)}>
              <option value="both">Mobile and web</option>
              <option value="mobile">Mobile only</option>
              <option value="web">Web only</option>
            </select>
          </label>
          <label className="text-sm text-foreground">
            Starts at
            <input type="datetime-local" className={fieldClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            Ends at
            <input type="datetime-local" className={fieldClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
          {mode === 'section' && (
            <label className="text-sm text-foreground">
              Sort order
              <input className={fieldClass} inputMode="numeric" placeholder="After the last section" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {definition && definition.fields.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-foreground">Content</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{definition.fields.map(renderField)}</div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create section'}
          </button>
          <Link href={listHref} className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Back
          </Link>
        </div>
      </form>

      {current && <SectionPreview id={current.id} mode={mode} refreshKey={previewKey} />}
    </div>
  );
}
