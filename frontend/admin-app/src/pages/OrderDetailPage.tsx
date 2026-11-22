import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi, paymentsApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle, StatusBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { usePolling } from '../hooks/usePolling';
import { getErrorMessage, statusOf } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';
import { adminCanCancel, NEXT_LABEL, nextStatus } from '../lib/orderFlow';
import { isFinalStatus, STATUS_LABEL } from '../lib/orders';
import { OrderStatus } from '../lib/shared-types';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useAsync(() => ordersApi.get(id), [id]);
  const payment = useAsync(async () => {
    try {
      return await paymentsApi.get(id);
    } catch (e) {
      if (statusOf(e) === 404) return null; // no payment record (yet)
      throw e;
    }
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payments, stock and emails are updated by background events, so the page refreshes itself
  usePolling(() => {
    order.reload();
    payment.reload();
  }, 6000, !order.data || !isFinalStatus(order.data.status));

  if (order.loading && !order.data) return <Loading />;
  if (!order.data) return <ErrorBox message={order.error ?? 'Order not found'} onRetry={order.reload} />;
  const o = order.data;
  const next = nextStatus(o.status);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      order.reload();
      payment.reload();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const a = o.deliveryAddress;
  return (
    <div className="space-y-6">
      <Link to="/orders" className="text-sm font-semibold text-rose-700">&larr; All orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Order #{o.id.slice(0, 8).toUpperCase()}</PageTitle>
        <StatusBadge status={o.status} />
      </div>
      {error && <ErrorBox message={error} />}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {next && (
            <button className="btn-primary" disabled={busy} onClick={() => void act(() => ordersApi.setStatus(id, next as OrderStatus))}>
              {NEXT_LABEL[next] ?? STATUS_LABEL[next]}
            </button>
          )}
          {adminCanCancel(o.status) && (
            <button className="btn-danger" disabled={busy} onClick={() => { if (window.confirm('Cancel this order? Stock is released and a paid order is refunded (simulated).')) void act(() => ordersApi.cancel(id)); }}>
              Cancel order
            </button>
          )}
          {!next && !adminCanCancel(o.status) && <p className="text-sm text-slate-500">No further actions: this order is {STATUS_LABEL[o.status].toLowerCase()}.</p>}
        </div>
        {o.status === 'PENDING_PAYMENT' && <Notice>Waiting for the customer to pay (simulated payment).</Notice>}
        <p className="text-xs text-slate-500">Status changes follow the state machine; the backend rejects any invalid jump with HTTP 409.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2 className="text-lg font-bold">Order</h2>
          <p><span className="text-slate-500">Customer:</span> {o.customerEmail ?? '-'}</p>
          <p><span className="text-slate-500">Placed:</span> {formatDateTime(o.createdAt)}</p>
          <p><span className="text-slate-500">Delivery:</span> {formatDate(o.deliveryDate)}, {o.deliverySlot}</p>
          <p><span className="text-slate-500">Address:</span> {a.label && <strong>{a.label}: </strong>}{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}</p>
          {o.cancelReason && <p><span className="text-slate-500">Cancel reason:</span> {o.cancelReason}</p>}
          <ul className="mt-3 divide-y border-t">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span>{i.quantity} x {i.cakeName} <span className="text-slate-500">({i.flavour}, {i.weightGrams} g, {i.eggless ? 'eggless' : 'regular'})</span>{i.message && <em className="block text-slate-500">"{i.message}"</em>}</span>
                <span>{formatINR(Number(i.unitPrice) * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t pt-2 text-right text-base font-bold">Total {formatINR(o.totalAmount)}</p>
        </section>

        <div className="space-y-6">
          <section className="card text-sm">
            <h2 className="mb-2 text-lg font-bold">Payment (simulated)</h2>
            {payment.data ? (
              <>
                <p>Status: <strong>{payment.data.status}</strong> · {formatINR(payment.data.amount)}</p>
                <ul className="mt-2 space-y-1">
                  {payment.data.transactions?.map((t) => (
                    <li key={t.id} className="text-slate-600">{t.type} {t.status} · {formatINR(t.amount)} · {formatDateTime(t.createdAt)}</li>
                  ))}
                </ul>
                {payment.data.status === 'SUCCEEDED' && (
                  <button className="btn-danger mt-3" disabled={busy} onClick={() => { if (window.confirm('Refund this payment (simulated)?')) void act(() => paymentsApi.refund(id)); }}>
                    Refund (mock)
                  </button>
                )}
              </>
            ) : (
              <p className="text-slate-500">No payment record yet.</p>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-bold">History</h2>
            <ul className="space-y-2 text-sm">
              {(o.history ?? []).map((h) => (
                <li key={h.id} className="flex justify-between gap-3">
                  <span>{STATUS_LABEL[h.toStatus as OrderStatus] ?? h.toStatus} <span className="text-xs text-slate-500">by {h.changedBy}{h.note ? ` (${h.note})` : ''}</span></span>
                  <span className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
