import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api/endpoints';
import { CakeCard } from '../components/CakeCard';
import { ErrorBox, Loading, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';

const LIMIT = 12;

export function CakesPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const eggless = params.get('eggless') === 'true';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;

  const [form, setForm] = useState({ categoryId, eggless, minPrice, maxPrice });

  const categories = useAsync(() => catalogApi.categories(), []);
  const cakes = useAsync(
    () =>
      catalogApi.cakes({
        search: search || undefined,
        categoryId: categoryId || undefined,
        eggless: eggless || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        page,
        limit: LIMIT,
      }),
    [search, categoryId, eggless, minPrice, maxPrice, page],
  );

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (form.categoryId) next.set('categoryId', form.categoryId);
    if (form.eggless) next.set('eggless', 'true');
    if (form.minPrice) next.set('minPrice', form.minPrice);
    if (form.maxPrice) next.set('maxPrice', form.maxPrice);
    setParams(next);
  };

  const goTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  const totalPages = cakes.data ? Math.max(1, Math.ceil(cakes.data.total / LIMIT)) : 1;

  return (
    <div>
      <PageTitle>{search ? `Results for "${search}"` : 'All cakes'}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <form onSubmit={apply} className="card h-fit space-y-4" aria-label="Filters">
          <div>
            <label className="label" htmlFor="f-cat">Category</label>
            <select id="f-cat" className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.eggless} onChange={(e) => setForm({ ...form, eggless: e.target.checked })} />
            Eggless only
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="f-min">Min price</label>
              <input id="f-min" type="number" min={0} className="input" value={form.minPrice} onChange={(e) => setForm({ ...form, minPrice: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="f-max">Max price</label>
              <input id="f-max" type="number" min={0} className="input" value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary w-full">Apply filters</button>
        </form>

        <div>
          {cakes.loading && <Loading />}
          {cakes.error && <ErrorBox message={cakes.error} onRetry={cakes.reload} />}
          {cakes.data && cakes.data.items.length === 0 && (
            <p className="py-12 text-center text-gray-500">No cakes match your search.</p>
          )}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cakes.data?.items.map((cake) => <CakeCard key={cake.id} cake={cake} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4 text-sm">
              <button className="btn-outline" disabled={page <= 1} onClick={() => goTo(page - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn-outline" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
