import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { ErrorBox, Loading, PageTitle, StatusBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { buildActivity, timeAgo } from '../lib/activity';
import { formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';

const DOT = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', gray: 'bg-slate-400' };

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
  const activity = useAsync(() => ordersApi.list({ limit: 20 }), []);
  // Refresh the activity list by itself every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => activity.reload(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2 className="mb-3 text-lg font-bold">Recent activity</h2>
        {activity.data && buildActivity(activity.data.items).length > 0 ? (
          <ul className="card divide-y text-sm">
            {buildActivity(activity.data.items).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[a.tone]}`} aria-hidden />
                  <Link to={`/orders/${a.orderId}`} className="truncate hover:underline">{a.text}</Link>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{formatINR(a.amount)} · {timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{activity.loading ? 'Loading...' : 'No activity yet.'}</p>
        )}
      </section>

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
