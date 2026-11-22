import { FormEvent, useState } from 'react';
import { getErrorMessage } from '../lib/api';
import { Address, AddressInput } from '../lib/types';
import { ErrorBox } from './ui';

interface Props {
  initial?: Address;
  submitLabel?: string;
  onSubmit: (data: AddressInput) => Promise<void>;
  onCancel?: () => void;
}

export function AddressForm({ initial, submitLabel = 'Save address', onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    label: initial?.label ?? 'Home',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        label: form.label.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        isDefault: form.isDefault,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="a-label">Label</label>
        <input id="a-label" className="input" value={form.label} onChange={set('label')} required maxLength={50} />
      </div>
      <div>
        <label className="label" htmlFor="a-postal">Postal code</label>
        <input id="a-postal" className="input" value={form.postalCode} onChange={set('postalCode')} required minLength={3} maxLength={12} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="a-line1">Address line 1</label>
        <input id="a-line1" className="input" value={form.line1} onChange={set('line1')} required minLength={3} maxLength={200} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="a-line2">Address line 2 (optional)</label>
        <input id="a-line2" className="input" value={form.line2} onChange={set('line2')} maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="a-city">City</label>
        <input id="a-city" className="input" value={form.city} onChange={set('city')} required minLength={2} />
      </div>
      <div>
        <label className="label" htmlFor="a-state">State</label>
        <input id="a-state" className="input" value={form.state} onChange={set('state')} required minLength={2} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        Use as my default address
      </label>
      {error && (
        <div className="sm:col-span-2">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : submitLabel}</button>
        {onCancel && (
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}
