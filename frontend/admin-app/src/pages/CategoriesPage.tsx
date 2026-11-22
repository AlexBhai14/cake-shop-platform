import { FormEvent, useState } from 'react';
import { catalogApi } from '../api/endpoints';
import { ErrorBox, Loading, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { getErrorMessage } from '../lib/api';
import { Category } from '../lib/shared-types';

function Row({ c, onChanged, onError }: { c: Category; onChanged: () => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? '');

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(getErrorMessage(e));
    }
  };

  return (
    <tr>
      <td>{editing ? <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Category name" /> : <strong>{c.name}</strong>}</td>
      <td>{editing ? <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Category description" /> : c.description ?? '-'}</td>
      <td>{c.isActive ? 'Active' : <span className="text-red-600">Hidden</span>}</td>
      <td className="space-x-2 whitespace-nowrap text-right">
        {editing ? (
          <>
            <button className="btn-primary" onClick={() => void run(async () => { await catalogApi.updateCategory(c.id, { name: name.trim(), description: description.trim() || undefined }); setEditing(false); })}>Save</button>
            <button className="btn-outline" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn-outline" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-outline" onClick={() => void run(() => catalogApi.updateCategory(c.id, { isActive: !c.isActive }))}>{c.isActive ? 'Hide' : 'Show'}</button>
          </>
        )}
      </td>
    </tr>
  );
}

export function CategoriesPage() {
  const categories = useAsync(() => catalogApi.categories(), []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await catalogApi.createCategory({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      categories.reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle>Categories</PageTitle>
      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div><label className="label" htmlFor="c-name">New category</label><input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} /></div>
        <div><label className="label" htmlFor="c-desc">Description (optional)</label><input id="c-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
        <button className="btn-primary">Add category</button>
      </form>
      {error && <ErrorBox message={error} />}
      {categories.loading && !categories.data && <Loading />}
      {categories.error && <ErrorBox message={categories.error} onRetry={categories.reload} />}
      {categories.data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Description</th><th>Visible</th><th /></tr></thead>
            <tbody>
              {categories.data.map((c) => <Row key={c.id} c={c} onChanged={categories.reload} onError={setError} />)}
              {categories.data.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
