import request from 'supertest';
import {
  api, createFixture, eventually, Fixture, futureDate, loginAdmin, MAILPIT, placePaidOrder, registerCustomer,
  removeFixture, Session,
} from './helpers';

// Mailpit is the test inbox: the notification service sends real SMTP mails to it.
const subjectsFor = async (email: string): Promise<string[]> => {
  const res = await request(MAILPIT).get('/api/v1/search').query({ query: `to:${email}` });
  return (res.body.messages ?? []).map((m: { Subject: string }) => m.Subject);
};

describe('Email notifications arrive in Mailpit', () => {
  let admin: Session;
  let f: Fixture;

  beforeAll(async () => {
    admin = await loginAdmin();
    f = await createFixture(admin, 'mail');
  });
  afterAll(async () => {
    await removeFixture(admin, f);
  });

  it('confirmation and preparation emails follow the order', async () => {
    const user = await registerCustomer('mail');
    const orderId = await placePaidOrder(user, f, futureDate(8, 30), '10:00-12:00', 1);

    await eventually(() => subjectsFor(user.email), (s) => s.some((x) => /Order confirmed/i.test(x)), 30_000);

    await api().patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status: 'ACCEPTED' });
    await api().patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status: 'PREPARING' });
    await eventually(() => subjectsFor(user.email), (s) => s.some((x) => /being prepared/i.test(x)), 30_000);
  });

  it('cancelling a paid order sends a cancellation email and a refund email', async () => {
    const user = await registerCustomer('mail-cancel');
    const orderId = await placePaidOrder(user, f, futureDate(8, 30), '12:00-14:00', 1);
    expect((await api().post(`/api/orders/${orderId}/cancel`).set(user.auth)).status).toBe(201);

    const subjects = await eventually(() => subjectsFor(user.email), (s) => s.some((x) => /Refund processed/i.test(x)), 30_000);
    expect(subjects.some((x) => /Order cancelled/i.test(x))).toBe(true);
  });

  it('the notification log of the customer shows only their own emails', async () => {
    const user = await registerCustomer('mail-own');
    const res = await api().get('/api/notifications').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
