import { useState } from 'react';
import { notificationsApi } from '../api/endpoints';
import { Pager } from '../components/Pager';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDateTime } from '../lib/dates';

const LIMIT = 20;
const TONE: Record<string, string> = { SENT: 'text-green-700', PENDING: 'text-amber-600', FAILED: 'font-semibold text-red-600' };

export function EmailsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync(() => notificationsApi.list({ status: status || undefined, page, limit: LIMIT }), [status, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Email notifications</PageTitle>
        <select className="input w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>
      <Notice tone="blue">In development the emails are delivered to Mailpit: http://localhost:8025. Failed emails are retried automatically before they are marked FAILED.</Notice>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Subject</th><th>To</th><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead>
              <tbody>
                {list.data.items.map((n) => (
                  <tr key={n.id}>
                    <td>{n.subject}{n.lastError && <span className="block text-xs text-red-600">{n.lastError}</span>}</td>
                    <td>{n.toEmail}</td>
                    <td className="text-xs">{n.type}</td>
                    <td className={TONE[n.status]}>{n.status}</td>
                    <td>{n.attempts}</td>
                    <td>{formatDateTime(n.createdAt)}</td>
                  </tr>
                ))}
                {list.data.items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500">No emails yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={list.data.total} limit={LIMIT} onPage={setPage} />
        </>
      )}
    </div>
  );
}
