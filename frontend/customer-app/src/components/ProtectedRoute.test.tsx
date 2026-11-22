import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthState } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

const base: AuthState = { user: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };

function renderCart(auth: AuthState) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/cart" element={<ProtectedRoute><p>Secret cart</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('sends a visitor who is not logged in to the login page', () => {
    renderCart(base);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret cart')).not.toBeInTheDocument();
  });

  it('shows the page to a logged-in user', () => {
    renderCart({ ...base, user: { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' } });
    expect(screen.getByText('Secret cart')).toBeInTheDocument();
  });

  it('waits while a saved session is being restored (no flash of the login page)', () => {
    renderCart({ ...base, loading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
