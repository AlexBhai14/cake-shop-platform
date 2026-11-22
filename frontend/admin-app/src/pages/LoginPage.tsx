import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErrorBox } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user?.role === 'ADMIN') return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message === 'NOT_ADMIN' ? 'This account is not an administrator.' : getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-extrabold">🎂 Sweet Layers <span className="text-rose-600">Admin</span></h1>
        <p className="text-sm text-gray-500">Administrator accounts are created by the shop owner. There is no public sign-up.</p>
        <div>
          <label className="label" htmlFor="a-email">Email</label>
          <input id="a-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="a-pass">Password</label>
          <input id="a-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Login'}</button>
      </form>
    </div>
  );
}
