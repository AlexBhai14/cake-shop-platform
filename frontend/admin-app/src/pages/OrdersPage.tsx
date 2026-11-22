import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { Pager } from '../components/Pager';
import { ErrorBox, Loading, PageTitle, StatusBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';
import { STATUS_LABEL } from '../lib/orders';
import { OrderStatus } from '../lib/shared-types';

const LIMIT = 15;

export function OrdersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const orders = useAsync(() => ordersApi.list({ status: status || undefined, page, limit: LIMIT }), [status, page]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Orders</PageTitle>
        <select className="input w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {orders.loading && !orders.data && <Loading />}
      {orders.error && <ErrorBox message={orders.error} onRetry={orders.reload} />}
      {orders.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Items</th><th>Total</th><th>Delivery</th><th>Placed</th></tr></thead>
              <tbody>
                {orders.data.items.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="font-semibold text-rose-700" to={`/orders/${o.id}`}>#{o.id.slice(0, 8).toUpperCase()}</Link></td>
                    <td>{o.customerEmail ?? '-'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td>{formatINR(o.totalAmount)}</td>
                    <td>{formatDate(o.deliveryDate)}<br /><span className="text-xs text-slate-500">{o.deliverySlot}</span></td>
                    <td>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {orders.data.items.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No orders found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={orders.data.total} limit={LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  );
}
