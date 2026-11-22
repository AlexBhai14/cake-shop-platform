import { FormEvent, useState } from 'react';
import { catalogApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { fetchAll } from '../lib/admin';
import { getErrorMessage } from '../lib/api';
import { formatINR } from '../lib/money';
import { Category } from '../lib/shared-types';
import { Cake, VariantInput } from '../lib/types';

interface VariantDraft {
  flavour: string;
  weightGrams: string;
  eggless: boolean;
  price: string;
}

const DISCOUNT_HINT =
  'Enter the REAL selling price below. With a discount the shop shows a crossed-out higher price: example, price 70 and 30% shows ₹100, 30% OFF, ₹70. Customers always pay the real price.';

const emptyVariant = (): VariantDraft => ({ flavour: '', weightGrams: '500', eggless: false, price: '' });
const toInput = (v: VariantDraft): VariantInput => ({
  flavour: v.flavour.trim(),
  weightGrams: Number(v.weightGrams),
  eggless: v.eggless,
  price: Number(Number(v.price).toFixed(2)),
});

function VariantFields({ v, onChange }: { v: VariantDraft; onChange: (v: VariantDraft) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
      <input className="input" placeholder="Flavour" aria-label="Flavour" value={v.flavour} onChange={(e) => onChange({ ...v, flavour: e.target.value })} required />
      <input className="input" type="number" min={100} step={50} placeholder="Weight (g)" aria-label="Weight in grams" value={v.weightGrams} onChange={(e) => onChange({ ...v, weightGrams: e.target.value })} required />
      <select className="input" aria-label="Type" value={String(v.eggless)} onChange={(e) => onChange({ ...v, eggless: e.target.value === 'true' })}>
        <option value="false">Regular</option>
        <option value="true">Eggless</option>
      </select>
      <input className="input" type="number" min={0.01} step={0.01} placeholder="Price (INR)" aria-label="Price" value={v.price} onChange={(e) => onChange({ ...v, price: e.target.value })} required />
    </div>
  );
}

function CreateCakeForm({ categories, onDone, onCancel }: { categories: Category[]; onDone: () => void; onCancel: () => void }) {
  const active = categories.filter((c) => c.isActive);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(active[0]?.id ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [discount, setDiscount] = useState('0');
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await catalogApi.createCake({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        imageUrl: imageUrl.trim() || undefined,
        discountPercent: Number(discount) || 0,
        variants: variants.map(toInput),
      });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="text-lg font-bold">New cake</h2>
      {active.length === 0 && <Notice>Create a category first (Categories page).</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="n-name">Name</label><input id="n-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={150} /></div>
        <div>
          <label className="label" htmlFor="n-cat">Category</label>
          <select id="n-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label" htmlFor="n-desc">Description</label><textarea id="n-desc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required minLength={5} /></div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="n-disc">Discount shown in the shop (%)</label>
          <input id="n-disc" className="input w-32" type="number" min={0} max={90} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{DISCOUNT_HINT}</p>
        </div>
        <div className="sm:col-span-2"><label className="label" htmlFor="n-img">Image URL (optional)</label><input id="n-img" className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." maxLength={500} /></div>
      </div>
      <div className="space-y-2">
        <p className="label">Variants (flavour, size, type, selling price)</p>
        {variants.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1"><VariantFields v={v} onChange={(nv) => setVariants(variants.map((x, j) => (j === i ? nv : x)))} /></div>
            {variants.length > 1 && <button type="button" className="btn-danger" onClick={() => setVariants(variants.filter((_, j) => j !== i))} aria-label="Remove variant">x</button>}
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => setVariants([...variants, emptyVariant()])}>+ Add variant</button>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving || active.length === 0}>{saving ? 'Saving...' : 'Create cake'}</button>
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function VariantRow({ v, onChanged, onError }: { v: Cake['variants'][number]; onChanged: () => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState(String(Number(v.price)));
  const run = async (data: { price?: number; isActive?: boolean }) => {
    try {
      await catalogApi.updateVariant(v.id, data);
      onChanged();
    } catch (e) {
      onError(getErrorMessage(e));
    }
  };
  return (
    <tr>
      <td>{v.flavour}</td>
      <td>{v.weightGrams} g</td>
      <td>{v.eggless ? 'Eggless' : 'Regular'}</td>
      <td className="w-40"><input className="input" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price of ${v.flavour} ${v.weightGrams} g`} /></td>
      <td className="whitespace-nowrap text-xs text-slate-600">{v.mrp ? <><span className="line-through">{formatINR(v.mrp)}</span> → {formatINR(v.price)}</> : 'No discount'}</td>
      <td>{v.isActive ? 'On sale' : <span className="text-red-600">Off</span>}</td>
      <td className="space-x-2 whitespace-nowrap text-right">
        <button className="btn-outline" onClick={() => void run({ price: Number(Number(price).toFixed(2)) })}>Save price</button>
        <button className="btn-outline" onClick={() => void run({ isActive: !v.isActive })}>{v.isActive ? 'Stop selling' : 'Sell again'}</button>
      </td>
    </tr>
  );
}

function EditCakePanel({ cake, categories, onChanged, onClose }: { cake: Cake; categories: Category[]; onChanged: () => void; onClose: () => void }) {
  const [name, setName] = useState(cake.name);
  const [description, setDescription] = useState(cake.description);
  const [categoryId, setCategoryId] = useState(cake.categoryId);
  const [imageUrl, setImageUrl] = useState(cake.imageUrl ?? '');
  const [discount, setDiscount] = useState(String(cake.discountPercent ?? 0));
  const [newVariant, setNewVariant] = useState<VariantDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <section className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Edit: {cake.name}</h2>
        <button className="btn-outline" onClick={onClose}>Close</button>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="e-name">Name</label><input id="e-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <label className="label" htmlFor="e-cat">Category</label>
          <select id="e-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (hidden)'}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label" htmlFor="e-desc">Description</label><textarea id="e-desc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="e-disc">Discount shown in the shop (%)</label>
          <input id="e-disc" className="input w-32" type="number" min={0} max={90} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{DISCOUNT_HINT}</p>
        </div>
        <div className="sm:col-span-2"><label className="label" htmlFor="e-img">Image URL</label><input id="e-img" className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => void run(() => catalogApi.updateCake(cake.id, { name: name.trim(), description: description.trim(), categoryId, imageUrl: imageUrl.trim() || undefined, discountPercent: Number(discount) || 0 }))}>Save changes</button>
        <button className={cake.isActive ? 'btn-danger' : 'btn-outline'} onClick={() => void run(() => catalogApi.updateCake(cake.id, { isActive: !cake.isActive }))}>
          {cake.isActive ? 'Deactivate cake (hide from shop)' : 'Activate cake'}
        </button>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Variants</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Flavour</th><th>Size</th><th>Type</th><th>Selling price (INR)</th><th>Shop shows</th><th>Status</th><th /></tr></thead>
            <tbody>{cake.variants.map((v) => <VariantRow key={v.id + v.price + v.isActive + (v.mrp ?? "")} v={v} onChanged={onChanged} onError={setError} />)}</tbody>
          </table>
        </div>
        {newVariant ? (
          <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await catalogApi.addVariant(cake.id, toInput(newVariant)); setNewVariant(null); }); }}>
            <VariantFields v={newVariant} onChange={setNewVariant} />
            <div className="flex gap-2"><button className="btn-primary">Add variant</button><button type="button" className="btn-outline" onClick={() => setNewVariant(null)}>Cancel</button></div>
          </form>
        ) : (
          <button className="btn-outline mt-3" onClick={() => setNewVariant(emptyVariant())}>+ Add variant</button>
        )}
      </div>
    </section>
  );
}

export function CakesPage() {
  const cakes = useAsync(() => fetchAll((p) => catalogApi.cakes(p)), []);
  const categories = useAsync(() => catalogApi.categories(), []);
  const [mode, setMode] = useState<'list' | 'new' | string>('list');

  if (cakes.loading && !cakes.data) return <Loading />;
  if (cakes.error || !cakes.data) return <ErrorBox message={cakes.error ?? 'No data'} onRetry={cakes.reload} />;
  const cats = categories.data ?? [];
  const editing = mode !== 'list' && mode !== 'new' ? cakes.data.find((c) => c.id === mode) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle>Cakes</PageTitle>
        {mode === 'list' && <button className="btn-primary" onClick={() => setMode('new')}>+ New cake</button>}
      </div>

      {mode === 'new' && <CreateCakeForm categories={cats} onCancel={() => setMode('list')} onDone={() => { setMode('list'); cakes.reload(); }} />}
      {editing && <EditCakePanel key={editing.id} cake={editing} categories={cats} onChanged={cakes.reload} onClose={() => setMode('list')} />}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Cake</th><th>Category</th><th>Variants</th><th>Prices</th><th>Discount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {cakes.data.map((c) => {
              const prices = c.variants.map((v) => Number(v.price));
              return (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td>{c.category?.name ?? '-'}</td>
                  <td>{c.variants.length}</td>
                  <td>{prices.length ? `${formatINR(Math.min(...prices))} - ${formatINR(Math.max(...prices))}` : '-'}</td>
                  <td>{c.discountPercent ? `${c.discountPercent}%` : '-'}</td>
                  <td>{c.isActive ? 'Active' : <span className="text-red-600">Inactive</span>}</td>
                  <td className="text-right"><button className="btn-outline" onClick={() => setMode(c.id)}>Edit</button></td>
                </tr>
              );
            })}
            {cakes.data.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No cakes yet. Create the first one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
