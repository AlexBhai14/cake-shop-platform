import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBox } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api';

function useRedirectTarget() {
  const location = useLocation();
  return (location.state as { from?: string } | null)?.from ?? '/';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useRedirectTarget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Welcome back</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="l-email">Email</label>
          <input id="l-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Login'}</button>
        <p className="text-center text-sm text-gray-600">New here? <Link to="/register" state={{ from }} className="font-semibold text-rose-700">Create an account</Link></p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const from = useRedirectTarget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="r-email">Email</label>
          <input id="r-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="r-pass">Password (at least 8 characters)</label>
          <input id="r-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="r-confirm">Repeat password</label>
          <input id="r-confirm" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account...' : 'Sign up'}</button>
        <p className="text-center text-sm text-gray-600">Already registered? <Link to="/login" state={{ from }} className="font-semibold text-rose-700">Login</Link></p>
      </form>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <p className="text-5xl">🍰</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
