'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createGateway, listGatewayTypes, updateGateway } from '@/lib/api/payment-gateways';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { AccountField, GatewayType, GatewayTypeRule, PaymentGateway } from '@/types/payment-gateway';

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';
const ACCOUNT_LABELS: Record<AccountField, string> = {
  accountName: 'Account name',
  accountNumber: 'Account number',
  bankName: 'Bank name',
  branchName: 'Branch name',
};
const ACCOUNT_ORDER: AccountField[] = ['accountName', 'accountNumber', 'bankName', 'branchName'];
const MAX_ICON = 2 * 1024 * 1024;

export function GatewayForm({ gateway }: { gateway?: PaymentGateway }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = gateway !== undefined;

  const [rules, setRules] = useState<GatewayTypeRule[]>([]);
  const [name, setName] = useState(gateway?.name ?? '');
  const [type, setType] = useState<GatewayType>(gateway?.type ?? 'cod');
  const [description, setDescription] = useState(gateway?.description ?? '');
  const [accounts, setAccounts] = useState<Record<AccountField, string>>({
    accountName: gateway?.accountName ?? '',
    accountNumber: gateway?.accountNumber ?? '',
    bankName: gateway?.bankName ?? '',
    branchName: gateway?.branchName ?? '',
  });
  const [isActive, setIsActive] = useState(gateway?.isActive ?? true);
  const [icon, setIcon] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listGatewayTypes()
      .then(setRules)
      .catch(() => showToast('Failed to load gateway types.', 'error'));
  }, [showToast]);

  const rule = rules.find((r) => r.type === type);
  const iconPreview = icon ? URL.createObjectURL(icon) : removeIcon ? null : (gateway?.iconUrl ?? null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    if (rule) {
      for (const f of rule.requiredFields) {
        if (!accounts[f].trim()) return setError(`${ACCOUNT_LABELS[f]} is required for ${rule.label.toLowerCase()}.`);
      }
      if (rule.needsDescription && !description.trim()) return setError('Payment instructions are required for this type.');
    }

    // Fields this type does not use are sent blank, which clears them.
    const allowed = new Set(rule?.allowedFields ?? []);
    const account = Object.fromEntries(
      ACCOUNT_ORDER.map((f) => [f, allowed.has(f) ? accounts[f].trim() : '']),
    ) as Record<AccountField, string>;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateGateway(gateway.id, {
          name: name.trim(),
          type,
          description: description.trim(),
          ...account,
          isActive,
          icon,
          removeIcon: removeIcon && !icon ? true : undefined,
        });
        showToast('Gateway updated.', 'success');
      } else {
        await createGateway({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          ...Object.fromEntries(Object.entries(account).filter(([, v]) => v)),
          isActive,
          icon,
        });
        showToast('Gateway created.', 'success');
      }
      router.push('/admin/settings/payment-gateways');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Edit payment gateway' : 'New payment gateway'}</h1>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm text-foreground">
          Name *
          <input className={fieldClass} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
          {isEdit && <span className="mt-1 block text-xs text-muted-foreground">Orders refer to it by “{gateway.slug}”, which never changes.</span>}
        </label>
        <label className="text-sm text-foreground">
          Type
          <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as GatewayType)}>
            {rules.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
          </select>
        </label>

        {ACCOUNT_ORDER.filter((f) => rule?.allowedFields.includes(f)).map((f) => (
          <label key={f} className="text-sm text-foreground">
            {ACCOUNT_LABELS[f]}{rule?.requiredFields.includes(f) ? ' *' : ''}
            <input className={fieldClass} value={accounts[f]} maxLength={f === 'accountNumber' ? 100 : 255} onChange={(e) => setAccounts((a) => ({ ...a, [f]: e.target.value }))} />
          </label>
        ))}

        <label className="text-sm text-foreground md:col-span-2">
          Instructions for the customer{rule?.needsDescription ? ' *' : ''}
          <textarea className={fieldClass} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Plain text, shown at checkout." />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (customers can choose it)
        </label>
      </div>

      {rule && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm shadow-sm">
          <h2 className="mb-1 font-semibold text-foreground">What the customer enters at checkout</h2>
          {rule.proofFields.length === 0 ? (
            <p className="text-muted-foreground">Nothing. They pay when the order arrives.</p>
          ) : (
            <ul className="list-inside list-disc text-muted-foreground">
              {rule.proofFields.map((p) => <li key={p.key}>{p.label}{p.required ? '' : ' (optional)'}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-foreground">Icon (optional, up to 2MB)</p>
        <input
          type="file"
          accept="image/*"
          className="mt-1 block text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && file.size > MAX_ICON) return setError('The icon must be 2MB or smaller.');
            setError(null);
            setIcon(file);
            if (file) setRemoveIcon(false);
          }}
        />
        {iconPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconPreview} alt="" className="mt-2 h-14 w-14 rounded-md border border-border object-contain" />
        )}
        {isEdit && gateway.iconUrl && !icon && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={removeIcon} onChange={(e) => setRemoveIcon(e.target.checked)} />
            Remove the current icon
          </label>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {submitting ? 'Saving…' : isEdit ? 'Update gateway' : 'Create gateway'}
        </button>
        <Link href="/admin/settings/payment-gateways" className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</Link>
      </div>
    </form>
  );
}
