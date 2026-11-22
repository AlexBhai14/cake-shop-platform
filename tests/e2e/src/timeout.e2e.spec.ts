import {
  addAddress, addToCart, api, checkout, createFixture, eventually, Fixture, futureDate, getOrder, loginAdmin, pay,
  registerCustomer, removeFixture, Session, waitForPayment, waitForStatus,
} from './helpers';

// This test needs about 60 seconds: the payment service re-checks an UNKNOWN payment after
// RECONCILE_AFTER_SECONDS (30 s) in a job that runs every 15 s.
jest.setTimeout(180_000);

describe('Uncertain payment outcome (bank timeout)', () => {
  let admin: Session;
  let f: Fixture;

  beforeAll(async () => {
    admin = await loginAdmin();
    f = await createFixture(admin, 'timeout');
  });
  afterAll(async () => {
    await removeFixture(admin, f);
  });

  it('TIMEOUT -> payment UNKNOWN, order waits, reconciliation later confirms the order', async () => {
    const user = await registerCustomer('timeout');
    const addressId = await addAddress(user);
    await addToCart(user, f.regularVariantId, 1);
    const res = await checkout(user, addressId, futureDate(8, 30), '10:00-12:00');
    await waitForPayment(user, res.body.id);

    const paid = await pay(user, res.body.id, 'TIMEOUT');
    expect(paid.body.status).toBe('UNKNOWN');
    expect((await getOrder(user, res.body.id)).status).toBe('PENDING_PAYMENT'); // we do not guess

    const order = await waitForStatus(user, res.body.id, 'CONFIRMED', 120_000); // the mock bank says "it succeeded"
    expect(order.paymentId).toBeTruthy();
    const payment = await eventually(
      async () => (await api().get(`/api/payments/orders/${res.body.id}`).set(user.auth)).body,
      (p) => p.status === 'SUCCEEDED',
    );
    expect(payment.transactions[0]).toMatchObject({ type: 'CHARGE', status: 'SUCCEEDED' });
  });
});
