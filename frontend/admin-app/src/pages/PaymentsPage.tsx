import { useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsApi } from '../api/endpoints';
import { Pager } from '../components/Pager';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { getErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';

const LIMIT = 20;

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const payments = useAsync(() => paymentsApi.list(page, LIMIT), [page]);

  const refund = async (orderId: string) => {
    if (!window.confirm('Refund this payment (simulated)? The amount is added to the customer wallet.')) return;
    setError(null);
    try {
      await paymentsApi.refund(orderId);
      payments.reload();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle>Payments</PageTitle>
      <Notice><strong>MOCK PAYMENTS.</strong> Everything here is a simulation. No real money moves.</Notice>
      {error && <ErrorBox message={error} />}
      {payments.loading && !payments.data && <Loading />}
      {payments.error && <ErrorBox message={payments.error} onRetry={payments.reload} />}
      {payments.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Created</th><th /></tr></thead>
              <tbody>
                {payments.data.items.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="font-semibold text-rose-700" to={`/orders/${p.orderId}`}>#{p.orderId.slice(0, 8).toUpperCase()}</Link></td>
                    <td>{p.customerEmail ?? '-'}</td>
                    <td>{formatINR(p.amount)}</td>
                    <td className={p.status === 'UNKNOWN' ? 'font-semibold text-amber-600' : ''}>{p.status}</td>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td className="text-right">{p.refundable && <button className="btn-danger" onClick={() => void refund(p.orderId)}>Refund</button>}</td>
                  </tr>
                ))}
                {payments.data.items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500">No payments yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={payments.data.total} limit={LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  );
}
