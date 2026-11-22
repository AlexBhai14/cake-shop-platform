import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { ErrorBox, Loading, PageTitle, StatusBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const stats = useAsync(() => ordersApi.stats(14), []);
  const recent = useAsync(() => ordersApi.list({ limit: 8 }), []);

  if (stats.loading) return <Loading />;
  if (stats.error || !stats.data) return <ErrorBox message={stats.error ?? 'No data'} onRetry={stats.reload} />;
  const s = stats.data.statusCounts;
  const n = (k: string) => s[k] ?? 0;

  return (
    <div className="space-y-8">
      <PageTitle>Dashboard</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Total orders" value={stats.data.totalOrders} />
        <Card label="Revenue (paid orders)" value={formatINR(stats.data.revenue)} hint="Simulated payments" />
        <Card label="Waiting for payment" value={n('PENDING_PAYMENT')} />
        <Card label="New: to accept" value={n('CONFIRMED')} hint="Paid, not yet accepted" />
        <Card label="In the kitchen" value={n('ACCEPTED') + n('PREPARING') + n('READY_FOR_DISPATCH')} />
        <Card label="Out for delivery" value={n('OUT_FOR_DELIVERY')} />
        <Card label="Delivered" value={n('DELIVERED')} />
        <Card label="Cancelled / failed" value={n('CANCELLED') + n('PAYMENT_FAILED')} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Latest orders</h2>
          <Link to="/orders" className="text-sm font-semibold text-rose-700">All orders</Link>
        </div>
        {recent.loading && <Loading />}
        {recent.error && <ErrorBox message={recent.error} onRetry={recent.reload} />}
        {recent.data && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
              <tbody>
                {recent.data.items.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="font-semibold text-rose-700" to={`/orders/${o.id}`}>#{o.id.slice(0, 8).toUpperCase()}</Link></td>
                    <td>{o.customerEmail ?? '-'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatINR(o.totalAmount)}</td>
                    <td>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {recent.data.items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
