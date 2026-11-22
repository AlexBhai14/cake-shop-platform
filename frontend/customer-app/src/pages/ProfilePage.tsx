import { FormEvent, useState } from 'react';
import { usersApi } from '../api/endpoints';
import { AddressForm } from '../components/AddressForm';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { getErrorMessage } from '../lib/api';
import { Profile } from '../lib/types';

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await usersApi.update({ fullName: fullName.trim(), phone: phone.trim() || undefined });
      setMsg({ ok: true, text: 'Profile saved.' });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="p-name">Full name</label>
        <input id="p-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="p-phone">Phone</label>
        <input id="p-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="p-email">Email</label>
        <input id="p-email" className="input bg-gray-50" value={profile.email} disabled />
      </div>
      {msg && <div className="sm:col-span-2">{msg.ok ? <Notice tone="green">{msg.text}</Notice> : <ErrorBox message={msg.text} />}</div>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button></div>
    </form>
  );
}

export function ProfilePage() {
  const profile = useAsync(() => usersApi.me(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile.loading && !profile.data) return <Loading />;
  if (profile.error || !profile.data) return <ErrorBox message={profile.error ?? 'Could not load your profile'} onRetry={profile.reload} />;
  const p = profile.data;

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      profile.reload();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle>My profile</PageTitle>
      <ProfileForm key={p.id} profile={p} onSaved={profile.reload} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Delivery addresses</h2>
          {!adding && <button className="btn-outline" onClick={() => setAdding(true)}>+ Add address</button>}
        </div>
        {error && <div className="mb-3"><ErrorBox message={error} /></div>}
        {adding && (
          <div className="card mb-4">
            <AddressForm
              onCancel={() => setAdding(false)}
              onSubmit={async (data) => {
                await usersApi.addAddress(data);
                setAdding(false);
                profile.reload();
              }}
            />
          </div>
        )}
        {p.addresses.length === 0 && !adding && <p className="text-gray-500">No saved addresses yet.</p>}
        <ul className="space-y-3">
          {p.addresses.map((a) => (
            <li key={a.id} className="card">
              {editingId === a.id ? (
                <AddressForm
                  initial={a}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (data) => {
                    const { isDefault, ...rest } = data;
                    await usersApi.updateAddress(a.id, rest);
                    if (isDefault && !a.isDefault) await usersApi.setDefault(a.id);
                    setEditingId(null);
                    profile.reload();
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold">{a.label}{a.isDefault && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Default</span>}</p>
                    <p className="text-gray-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}</p>
                  </div>
                  <div className="flex gap-2">
                    {!a.isDefault && <button className="btn-outline" onClick={() => void act(() => usersApi.setDefault(a.id))}>Make default</button>}
                    <button className="btn-outline" onClick={() => setEditingId(a.id)}>Edit</button>
                    <button className="btn-danger" onClick={() => { if (window.confirm('Delete this address?')) void act(() => usersApi.deleteAddress(a.id)); }}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
