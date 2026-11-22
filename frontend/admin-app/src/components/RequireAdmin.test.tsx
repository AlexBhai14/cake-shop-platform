import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthState } from '../context/AuthContext';
import { RequireAdmin } from './RequireAdmin';

const base: AuthState = { user: null, loading: false, login: vi.fn(), logout: vi.fn() };

function renderAdminPage(auth: AuthState) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/login" element={<p>Admin login</p>} />
          <Route path="/orders" element={<RequireAdmin><p>Secret admin page</p></RequireAdmin>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireAdmin', () => {
  it('sends visitors to the admin login', () => {
    renderAdminPage(base);
    expect(screen.getByText('Admin login')).toBeInTheDocument();
  });

  it('sends a logged-in CUSTOMER to the login too (customers are not administrators)', () => {
    renderAdminPage({ ...base, user: { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' } });
    expect(screen.getByText('Admin login')).toBeInTheDocument();
    expect(screen.queryByText('Secret admin page')).not.toBeInTheDocument();
  });

  it('shows the page to an ADMIN', () => {
    renderAdminPage({ ...base, user: { userId: 'a1', email: 'admin@x.com', role: 'ADMIN' } });
    expect(screen.getByText('Secret admin page')).toBeInTheDocument();
  });

  it('waits while the saved session is restored', () => {
    renderAdminPage({ ...base, loading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Admin login')).not.toBeInTheDocument();
  });
});
