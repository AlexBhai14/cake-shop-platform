import { useState } from 'react';
import { authApi, usersApi } from '../api/endpoints';
import { Pager } from '../components/Pager';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { fetchAll, mergeCustomers } from '../lib/admin';
import { getErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/dates';

const LIMIT = 20;

export function CustomersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const accounts = useAsync(() => authApi.users(page, LIMIT), [page]);
  const profiles = useAsync(() => fetchAll((p) => usersApi.profiles(p)), []);

  const toggle = async (id: string, email: string, status: 'ACTIVE' | 'SUSPENDED') => {
    const verb = status === 'SUSPENDED' ? 'Suspend' : 'Re-activate';
    if (!window.confirm(`${verb} ${email}?`)) return;
    setError(null);
    try {
      await authApi.setStatus(id, status);
      accounts.reload();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (accounts.loading && !accounts.data) return <Loading />;
  if (accounts.error || !accounts.data) return <ErrorBox message={accounts.error ?? 'No data'} onRetry={accounts.reload} />;

  const rows = mergeCustomers(accounts.data.items, profiles.data ?? []).filter((r) =>
    `${r.email} ${r.fullName ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageTitle>Customers</PageTitle>
      <Notice tone="blue">Suspending an account ends its sessions (refresh tokens are revoked). A token that is already issued works until it expires (15 minutes at most).</Notice>
      {error && <ErrorBox message={error} />}
      <input className="input max-w-xs" placeholder="Search this page by email or name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.email}</td>
                <td>{r.fullName ?? '-'}</td>
                <td>{r.phone ?? '-'}</td>
                <td>{r.role}</td>
                <td>{r.status === 'ACTIVE' ? 'Active' : <span className="font-semibold text-red-600">Suspended</span>}</td>
                <td>{formatDateTime(r.createdAt)}</td>
                <td className="text-right">
                  {r.id === user?.userId ? (
                    <span className="text-xs text-slate-400">You</span>
                  ) : r.status === 'ACTIVE' ? (
                    <button className="btn-danger" onClick={() => void toggle(r.id, r.email, 'SUSPENDED')}>Suspend</button>
                  ) : (
                    <button className="btn-outline" onClick={() => void toggle(r.id, r.email, 'ACTIVE')}>Re-activate</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No accounts found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={accounts.data.total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}
