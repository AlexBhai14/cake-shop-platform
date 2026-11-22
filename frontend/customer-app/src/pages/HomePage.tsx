import { Link } from 'react-router-dom';
import { catalogApi } from '../api/endpoints';
import { CakeCard } from '../components/CakeCard';
import { ErrorBox, Loading } from '../components/ui';
import { useAsync } from '../hooks/useAsync';

export function HomePage() {
  const categories = useAsync(() => catalogApi.categories(), []);
  const cakes = useAsync(() => catalogApi.cakes({ limit: 8 }), []);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-rose-100 via-amber-50 to-rose-50 px-6 py-14 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">Freshly baked, made for your day</h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-600">
          Choose your flavour, size and message. Pick a delivery date and time slot, and we bake it for you.
        </p>
        <Link to="/cakes" className="btn-primary mt-8 px-6 py-3 text-base">
          Browse all cakes
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Shop by category</h2>
        {categories.loading && <Loading />}
        {categories.error && <ErrorBox message={categories.error} onRetry={categories.reload} />}
        <div className="flex flex-wrap gap-3">
          {categories.data?.map((c) => (
            <Link key={c.id} to={`/cakes?categoryId=${c.id}`} className="btn-outline">
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Popular cakes</h2>
        {cakes.loading && <Loading />}
        {cakes.error && <ErrorBox message={cakes.error} onRetry={cakes.reload} />}
        {cakes.data && cakes.data.items.length === 0 && <p className="text-gray-500">No cakes available yet.</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cakes.data?.items.map((cake) => <CakeCard key={cake.id} cake={cake} />)}
        </div>
      </section>
    </div>
  );
}
