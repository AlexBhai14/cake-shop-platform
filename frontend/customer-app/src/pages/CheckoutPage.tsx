import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, inventoryApi, ordersApi, usersApi } from '../api/endpoints';
import { AddressForm } from '../components/AddressForm';
import { ErrorBox, Loading, Notice, PageTitle, SavingsLine } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAsync } from '../hooks/useAsync';
import { getErrorMessage } from '../lib/api';
import { earliestDeliveryDate, newIdempotencyKey } from '../lib/dates';
import { formatINR } from '../lib/money';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { setCart } = useCart();
  const cartQuery = useAsync(() => cartApi.get(), []);
  const addresses = useAsync(() => usersApi.addresses(), []);

  const [addressId, setAddressId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(earliestDeliveryDate());
  const [slot, setSlot] = useState<string | null>(null);
  const slots = useAsync(() => inventoryApi.slots(date), [date]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per checkout attempt: a double click or a retry returns the SAME order, never a second one
  const idempotencyKey = useRef(newIdempotencyKey());

  if (cartQuery.loading || addresses.loading) return <Loading />;
  if (cartQuery.error || !cartQuery.data) return <ErrorBox message={cartQuery.error ?? 'Could not load your cart'} onRetry={cartQuery.reload} />;
  if (addresses.error || !addresses.data) return <ErrorBox message={addresses.error ?? 'Could not load your addresses'} onRetry={addresses.reload} />;

  const cart = cartQuery.data;
  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">Your cart is empty.</p>
        <Link to="/cakes" className="btn-primary mt-6">Browse cakes</Link>
      </div>
    );
  }

  const units = cart.items.reduce((n, i) => n + i.quantity, 0);
  const list = addresses.data;
  const selectedId = addressId ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
  const canPlace = !!selectedId && !!slot && !cart.hasUnavailableItems && !placing;

  const place = async () => {
    if (!selectedId || !slot) return;
    setPlacing(true);
    setError(null);
    try {
      const order = await ordersApi.checkout({ addressId: selectedId, deliveryDate: date, deliverySlot: slot }, idempotencyKey.current);
      setCart(null);
      navigate(`/orders/${order.id}/pay`);
    } catch (e) {
      setError(getErrorMessage(e));
      setPlacing(false);
    }
  };

  return (
    <div>
      <PageTitle>Checkout</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">1. Delivery address</h2>
            {list.length === 0 && !showForm && <p className="mb-3 text-sm text-gray-500">You have no saved address yet.</p>}
            <div className="space-y-2">
              {list.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${selectedId === a.id ? 'border-rose-400 bg-rose-50' : 'border-gray-200'}`}>
                  <input type="radio" name="address" checked={selectedId === a.id} onChange={() => setAddressId(a.id)} />
                  <span>
                    <strong>{a.label}</strong>{a.isDefault && ' (default)'}<br />
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}
                  </span>
                </label>
              ))}
            </div>
            {showForm ? (
              <div className="mt-4">
                <AddressForm
                  onCancel={() => setShowForm(false)}
                  onSubmit={async (data) => {
                    const created = await usersApi.addAddress(data);
                    addresses.reload();
                    setAddressId(created.id);
                    setShowForm(false);
                  }}
                />
              </div>
            ) : (
              <button className="btn-outline mt-3" onClick={() => setShowForm(true)}>+ Add a new address</button>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-bold">2. Delivery date and time slot</h2>
            <label className="label" htmlFor="c-date">Delivery date (at least one day from now)</label>
            <input id="c-date" type="date" className="input max-w-xs" min={earliestDeliveryDate()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
            <div className="mt-4">
              {slots.loading && <Loading text="Checking slots..." />}
              {slots.error && <ErrorBox message={slots.error} onRetry={slots.reload} />}
              <div className="grid gap-2 sm:grid-cols-2">
                {slots.data?.map((s) => {
                  const enough = s.available >= units;
                  return (
                    <button
                      key={s.slot}
                      type="button"
                      disabled={!enough}
                      onClick={() => setSlot(s.slot)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${slot === s.slot ? 'border-rose-500 bg-rose-50' : 'border-gray-200 hover:border-rose-300'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className="font-semibold">{s.slot}</span><br />
                      <span className="text-xs text-gray-500">{enough ? `${s.available} cakes can still be booked` : 'Not enough capacity for your order'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="card h-fit space-y-3">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="space-y-1 text-sm">
            {cart.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>{i.quantity} x {i.cakeName}</span>
                <span>
                  {i.lineMrp && <span className="mr-1 text-xs text-gray-400 line-through" aria-label="Original price">{formatINR(i.lineMrp)}</span>}
                  {formatINR(i.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <SavingsLine savings={cart.savings} />
          <div className="flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{formatINR(cart.subtotal)}</span></div>
          <Notice tone="blue">Next step: a simulated payment. No real money is charged.</Notice>
          {cart.hasUnavailableItems && <ErrorBox message="Some cakes are unavailable. Please update your cart." />}
          {error && <ErrorBox message={error} />}
          <button className="btn-primary w-full py-3" disabled={!canPlace} onClick={() => void place()}>
            {placing ? 'Placing order...' : 'Place order'}
          </button>
          {!slot && <p className="text-xs text-gray-500">Choose an address and a time slot to continue.</p>}
        </aside>
      </div>
    </div>
  );
}
