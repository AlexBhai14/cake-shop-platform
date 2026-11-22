import { useState } from 'react';
import { Link } from 'react-router-dom';
import { walletApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDateTime } from '../lib/dates';
import { formatINR } from '../lib/money';

const LIMIT = 20;

const REASONS: Record<string, string> = {
  ORDER_CANCELLED: 'Refund: order cancelled',
  ADMIN_REFUND: 'Refund by shop',
};

export function WalletPage() {
  const [page, setPage] = useState(1);
  const wallet = useAsync(() => walletApi.get(), []);
  const txs = useAsync(() => walletApi.transactions(page, LIMIT), [page]);
  const pages = txs.data ? Math.max(1, Math.ceil(txs.data.total / LIMIT)) : 1;

  return (
    <div className="space-y-6">
      <PageTitle>My wallet</PageTitle>
      <Notice tone="blue">
        <strong>MOCK WALLET.</strong> This is a simulation. Refunded money is added here; no real money is stored.
      </Notice>

      {wallet.loading && !wallet.data && <Loading />}
      {wallet.error && <ErrorBox message={wallet.error} onRetry={wallet.reload} />}
      {wallet.data && (
        <section className="card">
          <p className="text-sm text-gray-500">Available balance</p>
          <p className="text-3xl font-extrabold text-rose-600">{formatINR(wallet.data.balance)}</p>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Wallet history</h2>
        {txs.loading && !txs.data && <Loading />}
        {txs.error && <ErrorBox message={txs.error} onRetry={txs.reload} />}
        {txs.data && txs.data.items.length === 0 && (
          <p className="text-sm text-gray-500">No wallet activity yet. Refunds for cancelled orders will appear here.</p>
        )}
        {txs.data && txs.data.items.length > 0 && (
          <ul className="divide-y text-sm">
            {txs.data.items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{(t.reason && REASONS[t.reason]) ?? (t.type === 'CREDIT' ? 'Money added' : 'Money used')}</p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(t.createdAt)}
                    {t.orderId && (
                      <>
                        {' · '}
                        <Link to={`/orders/${t.orderId}`} className="font-semibold text-rose-700">
                          Order #{t.orderId.slice(0, 8).toUpperCase()}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${t.type === 'CREDIT' ? 'text-green-700' : 'text-gray-700'}`}>
                    {t.type === 'CREDIT' ? '+' : '-'}
                    {formatINR(t.amount)}
                  </p>
                  <p className="text-xs text-gray-500">Balance {formatINR(t.balanceAfter)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="btn-outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
