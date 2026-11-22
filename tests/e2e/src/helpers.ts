import request from 'supertest';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
export const PASSWORD = 'Password123';

export const api = () => request(BASE);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const uniqueEmail = (prefix = 'e2e') => `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;

// A date in the future (UTC), different for each test so that tests do not fight for the same delivery slot
export function futureDate(minDays = 8, maxDays = 55): string {
  const offset = minDays + Math.floor(Math.random() * (maxDays - minDays + 1));
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

// The system works with events in the background (saga, RabbitMQ), so tests wait for the RESULT
export async function eventually<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 25_000,
  intervalMs = 700,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs} ms. Last value: ${JSON.stringify(value)}`);
    }
    await sleep(intervalMs);
  }
}

// If the gateway rate limit answers 429 the helper waits for Retry-After and tries again
async function withRetry429(send: () => Promise<request.Response>): Promise<request.Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await send();
    if (res.status !== 429) return res;
    await sleep((Number(res.headers['retry-after']) || 60) * 1000 + 500);
  }
  throw new Error('Still rate limited after several waits. Raise the gateway limits while running the tests (see docs/TESTING.md).');
}

export const login = (email: string, password: string) =>
  withRetry429(() => api().post('/api/auth/login').send({ email, password }));

export interface Session {
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

export async function registerCustomer(prefix = 'customer'): Promise<Session> {
  const email = uniqueEmail(prefix);
  const reg = await withRetry429(() => api().post('/api/auth/register').send({ email, password: PASSWORD }));
  expect(reg.status).toBe(201);
  const res = await login(email, PASSWORD);
  expect(res.status).toBe(200);
  return {
    email,
    userId: reg.body.id,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

export async function loginAdmin(): Promise<Session> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in tests/e2e/.env');
  const res = await login(email, password);
  if (res.status !== 200) throw new Error(`Admin login failed (${res.status}). Did you run "npm run seed" in the auth service?`);
  return {
    email,
    userId: '',
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

// ---------- shop fixtures: every test file creates its own cake, so tests do not depend on seed data ----------
export interface Fixture {
  categoryId: string;
  cakeId: string;
  cakeName: string;
  regularVariantId: string; // 500 g regular, 549.00
  egglessVariantId: string; // 500 g eggless, 599.00
}

export async function createFixture(admin: Session, label: string): Promise<Fixture> {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const category = await api().post('/api/categories').set(admin.auth).send({ name: `E2E ${label} ${stamp}` });
  expect(category.status).toBe(201);
  const cakeName = `E2E Cake ${label} ${stamp}`;
  const cake = await api()
    .post('/api/cakes')
    .set(admin.auth)
    .send({
      name: cakeName,
      description: 'Created by the end-to-end tests',
      categoryId: category.body.id,
      variants: [
        { flavour: 'Chocolate', weightGrams: 500, eggless: false, price: 549 },
        { flavour: 'Chocolate', weightGrams: 500, eggless: true, price: 599 },
      ],
    });
  expect(cake.status).toBe(201);
  const find = (eggless: boolean) => cake.body.variants.find((v: { eggless: boolean }) => v.eggless === eggless).id as string;
  return { categoryId: category.body.id, cakeId: cake.body.id, cakeName, regularVariantId: find(false), egglessVariantId: find(true) };
}

export async function removeFixture(admin: Session, f: Fixture) {
  await api().patch(`/api/cakes/${f.cakeId}`).set(admin.auth).send({ isActive: false });
  await api().patch(`/api/categories/${f.categoryId}`).set(admin.auth).send({ isActive: false });
}

// ---------- customer actions ----------
export async function addAddress(user: Session): Promise<string> {
  const res = await api()
    .post('/api/users/me/addresses')
    .set(user.auth)
    .send({ label: 'Home', line1: '12 MG Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' });
  expect(res.status).toBe(201);
  return res.body.id;
}

export async function addToCart(user: Session, variantId: string, quantity: number, message?: string) {
  const res = await api().post('/api/cart/items').set(user.auth).send({ variantId, quantity, message });
  expect(res.status).toBe(201);
  return res.body;
}

export const checkout = (user: Session, addressId: string, date: string, slot: string, key?: string) => {
  const req = api().post('/api/orders/checkout').set(user.auth);
  if (key) req.set('Idempotency-Key', key);
  return req.send({ addressId, deliveryDate: date, deliverySlot: slot });
};

export const getOrder = async (user: Session, id: string) => (await api().get(`/api/orders/${id}`).set(user.auth)).body;
export const getSlots = async (user: Session, date: string) => (await api().get('/api/inventory/slots').query({ date }).set(user.auth)).body as Array<{ slot: string; booked: number; capacity: number; available: number }>;
export const bookedOf = async (user: Session, date: string, slot: string) => (await getSlots(user, date)).find((s) => s.slot === slot)!.booked;

export async function waitForPayment(user: Session, orderId: string) {
  return eventually(
    async () => api().get(`/api/payments/orders/${orderId}`).set(user.auth),
    (res) => res.status === 200,
  );
}

export const pay = (user: Session, orderId: string, scenario: 'SUCCESS' | 'FAILURE' | 'TIMEOUT') =>
  api().post(`/api/payments/orders/${orderId}/pay`).set(user.auth).send({ scenario });

export async function waitForStatus(user: Session, orderId: string, status: string, timeoutMs?: number) {
  return eventually(() => getOrder(user, orderId), (o) => o.status === status, timeoutMs);
}

// Creates an order and pays it, so it ends CONFIRMED
export async function placePaidOrder(user: Session, f: Fixture, date: string, slot = '10:00-12:00', quantity = 1) {
  const addressId = await addAddress(user);
  await addToCart(user, f.regularVariantId, quantity);
  const res = await checkout(user, addressId, date, slot);
  expect(res.status).toBe(201);
  await waitForPayment(user, res.body.id);
  const paid = await pay(user, res.body.id, 'SUCCESS');
  expect(paid.status).toBe(201);
  await waitForStatus(user, res.body.id, 'CONFIRMED');
  return res.body.id as string;
}
