import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cartApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle, SavingsLine } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAsync } from '../hooks/useAsync';
import { getErrorMessage } from '../lib/api';
import { formatINR } from '../lib/money';
import { CartView } from '../lib/types';
import { weightLabel } from '../lib/variants';

export function CartPage() {
  const { setCart } = useCart();
  const query = useAsync(() => cartApi.get(), []);
  const [local, setLocal] = useState<CartView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cart = local ?? query.data;

  const run = async (key: string, action: () => Promise<CartView>) => {
    setBusy(key);
    setError(null);
    try {
      const view = await action();
      setLocal(view);
      setCart(view); // keeps the number on the header cart icon in sync
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (query.loading && !cart) return <Loading />;
  if (query.error && !cart) return <ErrorBox message={query.error} onRetry={query.reload} />;
  if (!cart) return null;

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-5xl">🛒</p>
        <p className="mt-4 text-gray-600">Your cart is empty.</p>
        <Link to="/cakes" className="btn-primary mt-6">Browse cakes</Link>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Your cart</PageTitle>
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      {cart.hasUnavailableItems && (
        <div className="mb-4"><Notice>Some cakes are no longer available. Remove them to continue.</Notice></div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.id} className={`card flex flex-wrap items-center gap-4 ${item.available ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.cakeName}</p>
                <p className="text-sm text-gray-500">
                  {item.flavour} · {item.weightGrams ? weightLabel(item.weightGrams) : ''} · {item.eggless ? 'Eggless' : 'Regular'}
                </p>
                {item.message && <p className="text-sm italic text-gray-500">"{item.message}"</p>}
                {!item.available && <p className="text-sm font-semibold text-red-600">No longer available</p>}
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-outline px-3" aria-label="Decrease quantity" disabled={busy === item.id || item.quantity <= 1} onClick={() => void run(item.id, () => cartApi.setQuantity(item.id, item.quantity - 1))}>-</button>
                <span className="w-6 text-center" aria-label="Quantity">{item.quantity}</span>
                <button className="btn-outline px-3" aria-label="Increase quantity" disabled={busy === item.id || item.quantity >= 20} onClick={() => void run(item.id, () => cartApi.setQuantity(item.id, item.quantity + 1))}>+</button>
              </div>
              <p className="w-28 text-right font-semibold">
                {item.lineMrp && <span className="block text-xs font-normal text-gray-400 line-through" aria-label="Original price">{formatINR(item.lineMrp)}</span>}
                {formatINR(item.lineTotal)}
              </p>
              <button className="btn-danger" disabled={busy === item.id} onClick={() => void run(item.id, () => cartApi.remove(item.id))}>Remove</button>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-4">
          <h2 className="text-lg font-bold">Summary</h2>
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{formatINR(cart.subtotal)}</span></div>
          <SavingsLine savings={cart.savings} />
          <p className="text-xs text-gray-500">Prices are checked again when you place the order.</p>
          {cart.hasUnavailableItems ? (
            <button className="btn-primary w-full" disabled>Proceed to checkout</button>
          ) : (
            <Link to="/checkout" className="btn-primary w-full">Proceed to checkout</Link>
          )}
          <button className="btn-outline w-full" disabled={busy === 'clear'} onClick={() => void run('clear', () => cartApi.clear())}>Clear cart</button>
        </aside>
      </div>
    </div>
  );
}
