import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { History, ProgressBar } from '../components/OrderTimeline';
import { ErrorBox, Loading, Notice, PageTitle, StatusBadge } from '../components/ui';
import { usePolling } from '../hooks/usePolling';
import { getErrorMessage } from '../lib/api';
import { formatDate } from '../lib/dates';
import { formatINR } from '../lib/money';
import { canCustomerCancel, cancelReasonText, isFinalStatus } from '../lib/orders';
import { Order } from '../lib/types';
import { weightLabel } from '../lib/variants';

// Order confirmation and tracking in one page. It refreshes itself until the order is final.
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await ordersApi.get(id));
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [id]);

  usePolling(load, 4000, !order || !isFinalStatus(order.status));

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setCancelling(true);
    try {
      setOrder(await ordersApi.cancel(id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  if (!order && !error) return <Loading />;
  if (!order) return <ErrorBox message={error ?? 'Order not found'} />;

  const reason = cancelReasonText(order.cancelReason);
  const a = order.deliveryAddress;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Order #{order.id.slice(0, 8).toUpperCase()}</PageTitle>
        <StatusBadge status={order.status} />
      </div>
      {error && <ErrorBox message={error} />}

      {order.status === 'CONFIRMED' && <Notice tone="green">Thank you! Your order is confirmed. We will keep you updated by email.</Notice>}
      {order.status === 'PENDING_PAYMENT' && (
        <Notice>
          Your order is waiting for payment. <Link to={`/orders/${order.id}/pay`} className="font-semibold underline">Go to payment</Link>
        </Notice>
      )}
      {(order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED') && reason && <ErrorBox message={reason} />}

      <ProgressBar status={order.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Items</h2>
          <ul className="divide-y">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2 text-sm">
                <div>
                  <p className="font-medium">{i.quantity} x {i.cakeName}</p>
                  <p className="text-gray-500">{i.flavour} · {weightLabel(i.weightGrams)} · {i.eggless ? 'Eggless' : 'Regular'}</p>
                  {i.message && <p className="italic text-gray-500">"{i.message}"</p>}
                </div>
                <p>{formatINR(Number(i.unitPrice) * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{formatINR(order.totalAmount)}</span></div>
        </section>

        <aside className="space-y-4">
          <section className="card text-sm">
            <h2 className="mb-2 text-lg font-bold">Delivery</h2>
            <p>{formatDate(order.deliveryDate)}, {order.deliverySlot}</p>
            <p className="mt-2 text-gray-600">{a.label && <strong>{a.label}<br /></strong>}{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}</p>
          </section>
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Tracking</h2>
            <History entries={order.history ?? []} />
          </section>
          {canCustomerCancel(order.status) && (
            <button className="btn-danger w-full" disabled={cancelling} onClick={() => void cancel()}>
              {cancelling ? 'Cancelling...' : 'Cancel order'}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
