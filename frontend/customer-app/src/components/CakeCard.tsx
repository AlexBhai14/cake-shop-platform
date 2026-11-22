import { Link } from 'react-router-dom';
import { Cake } from '../lib/types';
import { cheapestVariant } from '../lib/variants';
import { PriceTag } from './ui';

export function CakeCard({ cake }: { cake: Cake }) {
  const from = cheapestVariant(cake.variants);
  return (
    <Link to={`/cakes/${cake.id}`} className="card block overflow-hidden p-0 transition hover:shadow-md">
      {cake.imageUrl ? (
        <img src={cake.imageUrl} alt={cake.name} className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-44 items-center justify-center bg-gradient-to-br from-rose-100 to-amber-100 text-6xl">
          🎂
        </div>
      )}
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-rose-500">{cake.category?.name}</p>
        <h3 className="mt-1 font-semibold text-gray-900">{cake.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{cake.description}</p>
        {from && (
          <p className="mt-3 text-sm">
            <span className="text-gray-500">From </span>
            <PriceTag price={from.price} mrp={from.mrp} discountPercent={cake.discountPercent} />
          </p>
        )}
      </div>
    </Link>
  );
}
