import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LINKS: Array<[string, string]> = [
  ['/', 'Dashboard'],
  ['/analytics', 'Analytics'],
  ['/orders', 'Orders'],
  ['/cakes', 'Cakes'],
  ['/categories', 'Categories'],
  ['/inventory', 'Inventory & slots'],
  ['/customers', 'Customers'],
  ['/payments', 'Payments (mock)'],
  ['/emails', 'Emails'],
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-slate-900 p-4 text-slate-200 md:w-60 md:shrink-0">
        <p className="mb-6 text-lg font-extrabold text-white">🎂 Sweet Layers <span className="text-rose-400">Admin</span></p>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {LINKS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-rose-600 text-white' : 'hover:bg-slate-800'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t border-slate-700 pt-4 text-xs">
          <p className="truncate">{user?.email}</p>
          <button className="mt-2 rounded-lg border border-slate-600 px-3 py-1 hover:bg-slate-800" onClick={() => void logout().then(() => navigate('/login'))}>
            Logout
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
