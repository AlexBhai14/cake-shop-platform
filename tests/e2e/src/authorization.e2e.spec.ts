import {
  addAddress, addToCart, api, checkout, createFixture, Fixture, futureDate, getOrder, loginAdmin, pay, placePaidOrder,
  registerCustomer, removeFixture, Session, waitForPayment,
} from './helpers';

describe('Authorization (the backend decides, not the frontend)', () => {
  let admin: Session;
  let customer: Session;
  let other: Session;
  let fixture: Fixture;
  let orderId: string;

  beforeAll(async () => {
    admin = await loginAdmin();
    customer = await registerCustomer('authz');
    other = await registerCustomer('authz-other');
    fixture = await createFixture(admin, 'authz');
    orderId = await placePaidOrder(customer, fixture, futureDate());
  });

  afterAll(async () => {
    await removeFixture(admin, fixture);
  });

  it('401 when no token is sent to protected APIs', async () => {
    for (const path of ['/api/cart', '/api/orders', '/api/users/me', '/api/notifications']) {
      expect((await api().get(path)).status).toBe(401);
    }
    expect((await api().post('/api/orders/checkout').send({})).status).toBe(401);
  });

  it('browsing the shop needs no login', async () => {
    expect((await api().get('/api/cakes')).status).toBe(200);
    expect((await api().get('/api/categories')).status).toBe(200);
  });

  it('403 when a CUSTOMER calls admin APIs', async () => {
    const admin403 = [
      api().post('/api/categories').set(customer.auth).send({ name: 'Hack' }),
      api().post('/api/cakes').set(customer.auth).send({}),
      api().get('/api/cakes/admin/all').set(customer.auth),
      api().get('/api/orders/admin/all').set(customer.auth),
      api().get('/api/orders/admin/stats').set(customer.auth),
      api().patch(`/api/orders/${orderId}/status`).set(customer.auth).send({ status: 'ACCEPTED' }),
      api().get('/api/inventory/items').set(customer.auth),
      api().put('/api/inventory/slots').set(customer.auth).send({ date: futureDate(), slot: '10:00-12:00', capacity: 1 }),
      api().get('/api/payments/admin/all').set(customer.auth),
      api().get('/api/notifications/admin/all').set(customer.auth),
      api().get('/api/auth/admin/users').set(customer.auth),
      api().get('/api/users').set(customer.auth),
    ];
    const statuses = (await Promise.all(admin403)).map((r) => r.status);
    expect(statuses).toEqual(statuses.map(() => 403));
  });

  it('the admin can use the admin APIs', async () => {
    expect((await api().get('/api/orders/admin/all').set(admin.auth)).status).toBe(200);
    const stats = await api().get('/api/orders/admin/stats').set(admin.auth);
    expect(stats.status).toBe(200);
    expect(stats.body).toHaveProperty('statusCounts');
    expect(Array.isArray(stats.body.daily)).toBe(true);
    expect((await api().get('/api/auth/admin/users').set(admin.auth)).status).toBe(200);
  });

  it("a customer cannot read another customer's order (403) but the owner and the admin can", async () => {
    expect((await api().get(`/api/orders/${orderId}`).set(other.auth)).status).toBe(403);
    expect((await api().get(`/api/orders/${orderId}`).set(customer.auth)).status).toBe(200);
    expect((await api().get(`/api/orders/${orderId}`).set(admin.auth)).status).toBe(200);
  });

  it("a customer cannot pay, cancel or see the payment of another customer's order", async () => {
    expect((await pay(other, orderId, 'SUCCESS')).status).toBe(403);
    expect((await api().post(`/api/orders/${orderId}/cancel`).set(other.auth)).status).toBe(403);
    expect((await api().get(`/api/payments/orders/${orderId}`).set(other.auth)).status).toBe(403);
  });

  it("the order list of a customer contains only their own orders", async () => {
    const mine = await api().get('/api/orders').set(other.auth);
    expect(mine.status).toBe(200);
    expect(mine.body.find((o: { id: string }) => o.id === orderId)).toBeUndefined();
  });

  it("another customer's address cannot be used at checkout", async () => {
    const foreignAddress = await addAddress(other);
    await addToCart(customer, fixture.regularVariantId, 1);
    const res = await checkout(customer, foreignAddress, futureDate(), '12:00-14:00');
    expect(res.status).toBe(400); // "Delivery address not found": it is not in THIS customer's address list
  });

  it('every response carries a correlation id, and a valid incoming one is echoed back', async () => {
    const a = await api().get('/api/cakes');
    expect(a.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    const b = await api().get('/api/cakes').set('X-Correlation-Id', 'e2e-trace-12345678');
    expect(b.headers['x-correlation-id']).toBe('e2e-trace-12345678');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await api().get('/api/cakes');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('unknown routes give a clean JSON 404', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ statusCode: 404 });
  });
});
