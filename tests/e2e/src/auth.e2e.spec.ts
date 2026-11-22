import { api, loginAdmin, PASSWORD, registerCustomer, uniqueEmail, login } from './helpers';

describe('Authentication', () => {
  it('registers a customer: 201, role CUSTOMER, no password in the answer', async () => {
    const email = uniqueEmail('reg');
    const res = await api().post('/api/auth/register').send({ email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, role: 'CUSTOMER' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects a duplicate email (409), a bad email and a short password (400)', async () => {
    const email = uniqueEmail('dup');
    await api().post('/api/auth/register').send({ email, password: PASSWORD });
    expect((await api().post('/api/auth/register').send({ email, password: PASSWORD })).status).toBe(409);
    expect((await api().post('/api/auth/register').send({ email: 'not-an-email', password: PASSWORD })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ email: uniqueEmail(), password: 'short' })).status).toBe(400);
  });

  it('does not let anybody register as ADMIN (extra fields are refused)', async () => {
    const res = await api().post('/api/auth/register').send({ email: uniqueEmail('evil'), password: PASSWORD, role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const user = await registerCustomer('wrongpass');
    const wrong = await login(user.email, 'WrongPassword1');
    const unknown = await login(uniqueEmail('nobody'), PASSWORD);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('protects /me: 200 with a token, 401 without or with a garbage token', async () => {
    const user = await registerCustomer('me');
    const ok = await api().get('/api/auth/me').set(user.auth);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ email: user.email, role: 'CUSTOMER' });
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set({ Authorization: 'Bearer not.a.token' })).status).toBe(401);
  });

  it('rotates refresh tokens and detects the reuse of an old one', async () => {
    const user = await registerCustomer('rotate');
    const first = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    // the OLD token is used again: looks like theft -> refused AND all sessions of the user are revoked
    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(reuse.status).toBe(401);
    const afterTheft = await api().post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(afterTheft.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const user = await registerCustomer('logout');
    expect((await api().post('/api/auth/logout').send({ refreshToken: user.refreshToken })).status).toBe(200);
    expect((await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken })).status).toBe(401);
  });

  it('RBAC demo route: 401 without token, 403 for a customer, 200 for the admin', async () => {
    const customer = await registerCustomer('rbac');
    const admin = await loginAdmin();
    expect((await api().get('/api/auth/admin/ping')).status).toBe(401);
    expect((await api().get('/api/auth/admin/ping').set(customer.auth)).status).toBe(403);
    expect((await api().get('/api/auth/admin/ping').set(admin.auth)).status).toBe(200);
  });
});
