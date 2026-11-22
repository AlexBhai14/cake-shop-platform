import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { cartApi, catalogApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PriceTag } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api';
import { resolveSelection, Selection, weightLabel } from '../lib/variants';

export function CakeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { setCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const cake = useAsync(() => catalogApi.cake(id), [id]);

  const [sel, setSel] = useState<Selection>({});
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  if (cake.loading) return <Loading />;
  if (cake.error || !cake.data) return <ErrorBox message={cake.error ?? 'Cake not found'} onRetry={cake.reload} />;

  const c = cake.data;
  const r = resolveSelection(c.variants, sel);

  const addToCart = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!r.variant) return;
    setAdding(true);
    setError(null);
    setAdded(false);
    try {
      setCart(await cartApi.add(r.variant.id, quantity, message.trim() || undefined));
      setAdded(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {c.imageUrl ? (
        <img src={c.imageUrl} alt={c.name} className="h-80 w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex h-80 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 text-8xl">🎂</div>
      )}

      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-rose-500">{c.category?.name}</p>
          <h1 className="text-3xl font-extrabold text-gray-900">{c.name}</h1>
          <p className="mt-2 text-gray-600">{c.description}</p>
        </div>

        {c.variants.length === 0 ? (
          <Notice>This cake is not available right now.</Notice>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="v-flavour">Flavour</label>
                <select id="v-flavour" className="input" value={r.flavour} onChange={(e) => setSel({ flavour: e.target.value })}>
                  {r.flavours.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="v-weight">Size / weight</label>
                <select id="v-weight" className="input" value={r.weight} onChange={(e) => setSel({ flavour: r.flavour, weight: Number(e.target.value) })}>
                  {r.weights.map((w) => <option key={w} value={w}>{weightLabel(w)}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="v-type">Type</label>
                <select id="v-type" className="input" value={String(r.eggless)} onChange={(e) => setSel({ flavour: r.flavour, weight: r.weight, eggless: e.target.value === 'true' })}>
                  {r.types.map((t) => <option key={String(t)} value={String(t)}>{t ? 'Eggless' : 'Regular (with egg)'}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="v-message">Message on the cake (optional)</label>
              <input id="v-message" className="input" maxLength={200} placeholder="Happy Birthday Riya!" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <label className="label" htmlFor="v-qty">Quantity</label>
                <input id="v-qty" type="number" min={1} max={20} className="input w-24" value={quantity} onChange={(e) => setQuantity(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
              <p>{r.variant ? <PriceTag size="lg" price={r.variant.price} mrp={r.variant.mrp} discountPercent={c.discountPercent} /> : '-'}</p>
            </div>

            {error && <ErrorBox message={error} />}
            {added && (
              <Notice tone="green">
                Added to your cart. <Link to="/cart" className="font-semibold underline">View cart</Link>
              </Notice>
            )}
            <button className="btn-primary w-full py-3 text-base" onClick={() => void addToCart()} disabled={adding || !r.variant}>
              {adding ? 'Adding...' : user ? 'Add to cart' : 'Login to add to cart'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
