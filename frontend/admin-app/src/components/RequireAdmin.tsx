import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loading } from './ui';

// Hides the admin pages from everyone who is not a logged-in administrator.
// The real protection is the backend: every admin API returns 401/403 without an ADMIN token.
export function RequireAdmin({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}
