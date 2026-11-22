import { loadPolicies, selectSubject } from './rate-limit.config';

describe('loadPolicies', () => {
  it('uses defaults when nothing is configured', () => {
    const p = loadPolicies({});
    expect(p.login).toEqual({ name: 'login', limit: 5, windowSec: 60 });
    expect(p.public.limit).toBe(120);
  });

  it('reads overrides from the environment', () => {
    const p = loadPolicies({ RATE_LOGIN_LIMIT: '3', RATE_LOGIN_WINDOW_SEC: '30' });
    expect(p.login).toEqual({ name: 'login', limit: 3, windowSec: 30 });
  });

  it('falls back to defaults for invalid values', () => {
    expect(loadPolicies({ RATE_ADMIN_LIMIT: 'abc' }).admin.limit).toBe(60);
  });
});

describe('selectSubject', () => {
  const customer = { userId: 'u1', role: 'CUSTOMER' };
  const admin = { userId: 'a1', role: 'ADMIN' };

  it('limits login by IP', () => {
    expect(selectSubject('/api/auth/login', null, '1.2.3.4')).toEqual({ policy: 'login', id: '1.2.3.4' });
  });
  it('limits other auth routes by IP with the auth policy', () => {
    expect(selectSubject('/api/auth/register', null, '1.2.3.4').policy).toBe('auth');
  });
  it('limits admins by user id with the admin policy', () => {
    expect(selectSubject('/api/cakes', admin, '1.2.3.4')).toEqual({ policy: 'admin', id: 'a1' });
  });
  it('limits customers by user id', () => {
    expect(selectSubject('/api/cart', customer, '1.2.3.4')).toEqual({ policy: 'user', id: 'u1' });
  });
  it('does not apply the strict auth limit to logged-in auth routes (me, admin user management)', () => {
    expect(selectSubject('/api/auth/me', customer, '1.2.3.4')).toEqual({ policy: 'user', id: 'u1' });
    expect(selectSubject('/api/auth/admin/users', admin, '1.2.3.4')).toEqual({ policy: 'admin', id: 'a1' });
  });
  it('limits anonymous browsing by IP', () => {
    expect(selectSubject('/api/cakes', null, '1.2.3.4')).toEqual({ policy: 'public', id: '1.2.3.4' });
  });
});
