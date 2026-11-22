import { useState } from 'react';
import { ordersApi } from '../api/endpoints';
import { ErrorBox, Loading, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { barHeights } from '../lib/admin';
import { formatINR } from '../lib/money';
import { STATUS_LABEL } from '../lib/orders';
import { OrderStatus } from '../lib/shared-types';

function BarChart({ title, labels, values, format }: { title: string; labels: string[]; values: number[]; format: (v: number) => string }) {
  const heights = barHeights(values);
  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="flex h-44 items-end gap-1" role="img" aria-label={title}>
        {heights.map((h, i) => (
          <div key={labels[i]} className="flex h-full flex-1 flex-col justify-end" title={`${labels[i]}: ${format(values[i])}`}>
            <div className="w-full rounded-t bg-rose-500" style={{ height: `${h}%`, minHeight: values[i] > 0 ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </section>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const stats = useAsync(() => ordersApi.stats(days), [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Analytics</PageTitle>
        <select className="input w-40" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      {stats.loading && <Loading />}
      {stats.error && <ErrorBox message={stats.error} onRetry={stats.reload} />}
      {stats.data && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <BarChart title="Orders per day" labels={stats.data.daily.map((d) => d.date.slice(5))} values={stats.data.daily.map((d) => d.orders)} format={(v) => `${v} orders`} />
            <BarChart title="Revenue per day (paid orders)" labels={stats.data.daily.map((d) => d.date.slice(5))} values={stats.data.daily.map((d) => Number(d.revenue))} format={(v) => formatINR(v)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="mb-3 text-lg font-bold">Orders by status (all time)</h2>
              <ul className="space-y-2 text-sm">
                {Object.entries(stats.data.statusCounts).map(([status, count]) => (
                  <li key={status}>
                    <div className="flex justify-between"><span>{STATUS_LABEL[status as OrderStatus] ?? status}</span><span className="font-semibold">{count}</span></div>
                    <div className="mt-1 h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-rose-400" style={{ width: `${Math.round((count / Math.max(1, stats.data!.totalOrders)) * 100)}%` }} />
                    </div>
                  </li>
                ))}
                {Object.keys(stats.data.statusCounts).length === 0 && <li className="text-slate-500">No orders yet.</li>}
              </ul>
            </section>
            <section className="card">
              <h2 className="mb-3 text-lg font-bold">Best-selling cakes (paid orders)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {stats.data.topCakes.map((c) => (
                  <li key={c.cakeName}><span className="font-medium">{c.cakeName}</span> <span className="text-slate-500">({c.quantity} sold)</span></li>
                ))}
                {stats.data.topCakes.length === 0 && <li className="list-none text-slate-500">No paid orders yet.</li>}
              </ol>
              <p className="mt-4 text-sm text-slate-600">Total revenue: <strong>{formatINR(stats.data.revenue)}</strong> (simulated payments)</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
