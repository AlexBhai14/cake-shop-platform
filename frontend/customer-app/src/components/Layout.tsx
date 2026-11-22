import { FormEvent, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';

export function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/cakes?search=${encodeURIComponent(term.trim())}`);
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${isActive ? 'text-rose-700' : 'text-gray-600 hover:text-rose-700'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-rose-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="text-xl font-extrabold text-rose-600">
            🎂 Sweet Layers
          </Link>
          <nav className="flex gap-4">
            <NavLink to="/" end className={link}>
              Home
            </NavLink>
            <NavLink to="/cakes" className={link}>
              Cakes
            </NavLink>
            {user && (
              <NavLink to="/orders" className={link}>
                My orders
              </NavLink>
            )}
          </nav>
          <form onSubmit={onSearch} className="ml-auto flex w-full gap-2 sm:w-auto" role="search">
            <input
              className="input sm:w-56"
              placeholder="Search cakes..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Search cakes"
            />
          </form>
          <Link to="/cart" className="relative text-sm font-medium text-gray-700 hover:text-rose-700">
            🛒 Cart
            {count > 0 && (
              <span className="absolute -right-4 -top-2 rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <Link to="/profile" className="font-medium text-gray-700 hover:text-rose-700">
                {user.email}
              </Link>
              <button className="btn-outline" onClick={() => void logout().then(() => navigate('/'))}>
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="btn-outline">
                Login
              </Link>
              <Link to="/register" className="btn-primary">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-rose-100 bg-white py-6 text-center text-xs text-gray-500">
        Sweet Layers is a student project. Payments are simulated: no real money is ever charged.
      </footer>
    </div>
  );
}
