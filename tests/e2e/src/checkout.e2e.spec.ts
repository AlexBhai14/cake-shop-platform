import {
  addAddress, addToCart, api, bookedOf, checkout, createFixture, eventually, Fixture, futureDate, getOrder, loginAdmin,
  pay, placePaidOrder, registerCustomer, removeFixture, Session, waitForPayment, waitForStatus,
} from './helpers';

const setStatus = (admin: Session, orderId: string, status: string) =>
  api().patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status });

const paymentOf = async (user: Session, orderId: string) => (await api().get(`/api/payments/orders/${orderId}`).set(user.auth)).body;

describe('Checkout saga, end to end (all payments are simulated)', () => {
  let admin: Session;
  let f: Fixture;

  beforeAll(async () => {
    admin = await loginAdmin();
    f = await createFixture(admin, 'checkout');
  });

  afterAll(async () => {
    await removeFixture(admin, f);
  });

  describe('happy path', () => {
    const date = futureDate(8, 25);
    const slot = '10:00-12:00';
    let user: Session;
    let addressId: string;
    let orderId: string;
    let bookedBefore: number;
    const key = `e2e-key-${Date.now()}`;

    beforeAll(async () => {
      user = await registerCustomer('happy');
      addressId = await addAddress(user);
    });

    it('the cart always shows the CURRENT price (no stale price)', async () => {
      await addToCart(user, f.regularVariantId, 2, 'Happy Birthday');
      await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ price: 560 });
      const cart = (await api().get('/api/cart').set(user.auth)).body;
      expect(Number(cart.items[0].unitPrice)).toBe(560);
      await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ price: 549 });
      const again = (await api().get('/api/cart').set(user.auth)).body;
      expect(Number(again.subtotal)).toBe(1098);
    });

    it('checkout creates a PENDING_PAYMENT order with price, product and address snapshots', async () => {
      bookedBefore = await bookedOf(user, date, slot);
      const res = await checkout(user, addressId, date, slot, key);
      expect(res.status).toBe(201);
      orderId = res.body.id;
      expect(res.body.status).toBe('PENDING_PAYMENT');
      expect(Number(res.body.totalAmount)).toBe(1098);
      expect(res.body.items[0]).toMatchObject({ cakeName: f.cakeName, quantity: 2, message: 'Happy Birthday' });
      expect(Number(res.body.items[0].unitPrice)).toBe(549);
      expect(res.body.deliveryAddress).toMatchObject({ city: 'Mumbai' });
    });

    it('the order keeps its price when the shop changes the price later', async () => {
      await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ price: 700 });
      const order = await getOrder(user, orderId);
      expect(Number(order.totalAmount)).toBe(1098);
      expect(Number(order.items[0].unitPrice)).toBe(549);
      await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ price: 549 });
    });

    it('repeating the checkout with the same Idempotency-Key returns the SAME order', async () => {
      const again = await checkout(user, addressId, date, slot, key);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(orderId);
    });

    it('the cart is empty after checkout', async () => {
      expect((await api().get('/api/cart').set(user.auth)).body.items).toHaveLength(0);
    });

    it('the saga reserves the delivery slot and creates the payment (events through RabbitMQ)', async () => {
      const res = await waitForPayment(user, orderId);
      expect(res.body.status).toBe('PENDING');
      expect(Number(res.body.amount)).toBe(1098);
      expect(res.body.notice).toMatch(/No real money/i);
      const booked = await eventually(() => bookedOf(user, date, slot), (b) => b === bookedBefore + 2);
      expect(booked).toBe(bookedBefore + 2);
    });

    it('paying succeeds once; paying again does NOT charge twice (idempotent)', async () => {
      const first = await pay(user, orderId, 'SUCCESS');
      expect(first.status).toBe(201);
      expect(first.body.status).toBe('SUCCEEDED');
      const second = await pay(user, orderId, 'SUCCESS');
      expect(second.body.status).toBe('SUCCEEDED');
      const payment = await paymentOf(user, orderId);
      expect(payment.transactions.filter((t: { type: string }) => t.type === 'CHARGE')).toHaveLength(1);
    });

    it('the order becomes CONFIRMED', async () => {
      const order = await waitForStatus(user, orderId, 'CONFIRMED');
      expect(order.paymentId).toBeTruthy();
    });

    it('the admin moves the order along the state machine; invalid jumps are refused with 409', async () => {
      expect((await setStatus(admin, orderId, 'DELIVERED')).status).toBe(409); // cannot skip steps
      expect((await setStatus(admin, orderId, 'CONFIRMED')).status).toBe(400); // payment statuses are not settable by hand
      for (const status of ['ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
        const res = await setStatus(admin, orderId, status);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
      expect((await api().post(`/api/orders/${orderId}/cancel`).set(user.auth)).status).toBe(409);
    });

    it('the tracking history shows every step', async () => {
      const order = await getOrder(user, orderId);
      expect(order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED',
      ]);
    });
  });

  describe('failed payment (compensation)', () => {
    it('payment FAILURE -> order PAYMENT_FAILED and the reserved slot is released', async () => {
      const user = await registerCustomer('payfail');
      const date = futureDate(26, 35);
      const addressId = await addAddress(user);
      const before = await bookedOf(user, date, '10:00-12:00');
      await addToCart(user, f.regularVariantId, 1);
      const res = await checkout(user, addressId, date, '10:00-12:00');
      await waitForPayment(user, res.body.id);
      await eventually(() => bookedOf(user, date, '10:00-12:00'), (b) => b === before + 1);

      const paid = await pay(user, res.body.id, 'FAILURE');
      expect(paid.body.status).toBe('FAILED');

      const order = await waitForStatus(user, res.body.id, 'PAYMENT_FAILED');
      expect(order.cancelReason).toBe('PAYMENT_FAILED');
      await eventually(() => bookedOf(user, date, '10:00-12:00'), (b) => b === before);
    });
  });

  describe('stock and capacity limits', () => {
    it('ready-made stock: the last cake is sold once, then the saga cancels with OUT_OF_STOCK', async () => {
      expect((await api().put(`/api/inventory/items/${f.egglessVariantId}`).set(admin.auth).send({ onHand: 1 })).status).toBe(200);
      const date = futureDate(36, 45);
      const user = await registerCustomer('stock');
      const addressId = await addAddress(user);

      // 2 cakes requested but only 1 in stock
      await addToCart(user, f.egglessVariantId, 2);
      const tooMany = await checkout(user, addressId, date, '10:00-12:00');
      const cancelled = await waitForStatus(user, tooMany.body.id, 'CANCELLED');
      expect(cancelled.cancelReason).toBe('OUT_OF_STOCK');
      expect(await bookedOf(user, date, '10:00-12:00')).toBe(0); // nothing stayed reserved

      // 1 cake: works and uses the last unit
      await addToCart(user, f.egglessVariantId, 1);
      const one = await checkout(user, addressId, date, '10:00-12:00');
      await waitForPayment(user, one.body.id);
      await pay(user, one.body.id, 'SUCCESS');
      await waitForStatus(user, one.body.id, 'CONFIRMED');
      const history = await eventually(
        async () => (await api().get(`/api/inventory/items/${f.egglessVariantId}/history`).set(admin.auth)).body,
        (h: Array<{ reason: string }>) => h.some((m) => m.reason === 'ORDER_CONFIRMED'),
      );
      expect(history.some((m: { reason: string }) => m.reason === 'ORDER_RESERVED')).toBe(true);

      // stock is now 0
      await addToCart(user, f.egglessVariantId, 1);
      const soldOut = await checkout(user, addressId, date, '12:00-14:00');
      expect((await waitForStatus(user, soldOut.body.id, 'CANCELLED')).cancelReason).toBe('OUT_OF_STOCK');
    });

    it('delivery slot capacity: a full slot cancels the order with DELIVERY_SLOT_FULL', async () => {
      const date = futureDate(46, 55);
      const slot = '14:00-16:00';
      expect((await api().put('/api/inventory/slots').set(admin.auth).send({ date, slot, capacity: 1 })).status).toBe(200);
      const a = await registerCustomer('slot-a');
      const b = await registerCustomer('slot-b');
      const addrA = await addAddress(a);
      const addrB = await addAddress(b);

      await addToCart(a, f.regularVariantId, 2); // 2 cakes, capacity 1
      const tooBig = await checkout(a, addrA, date, slot);
      expect((await waitForStatus(a, tooBig.body.id, 'CANCELLED')).cancelReason).toBe('DELIVERY_SLOT_FULL');

      await addToCart(a, f.regularVariantId, 1);
      const first = await checkout(a, addrA, date, slot);
      await waitForPayment(a, first.body.id); // the last place is taken

      await addToCart(b, f.regularVariantId, 1);
      const second = await checkout(b, addrB, date, slot);
      expect((await waitForStatus(b, second.body.id, 'CANCELLED')).cancelReason).toBe('DELIVERY_SLOT_FULL');

      const slots = await api().get('/api/inventory/slots').query({ date }).set(a.auth);
      expect(slots.body.find((s: { slot: string }) => s.slot === slot)).toMatchObject({ capacity: 1, booked: 1, available: 0 });
    });

    it('a delivery slot that does not exist cancels the order with INVALID_SLOT', async () => {
      const user = await registerCustomer('badslot');
      const addressId = await addAddress(user);
      await addToCart(user, f.regularVariantId, 1);
      const res = await checkout(user, addressId, futureDate(8, 20), '23:00-24:00');
      expect((await waitForStatus(user, res.body.id, 'CANCELLED')).cancelReason).toBe('INVALID_SLOT');
    });
  });

  describe('cancellation and refund', () => {
    it('cancelling a paid order releases stock and slot and refunds the (mock) payment', async () => {
      const user = await registerCustomer('refund');
      const date = futureDate(8, 25);
      const before = await bookedOf(user, date, '16:00-18:00');
      const orderId = await placePaidOrder(user, f, date, '16:00-18:00', 1);
      expect(await bookedOf(user, date, '16:00-18:00')).toBe(before + 1);

      const res = await api().post(`/api/orders/${orderId}/cancel`).set(user.auth);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CANCELLED');

      const payment = await eventually(() => paymentOf(user, orderId), (p) => p.status === 'REFUNDED');
      expect(payment.transactions.map((t: { type: string }) => t.type)).toEqual(['CHARGE', 'REFUND']);
      await eventually(() => bookedOf(user, date, '16:00-18:00'), (b) => b === before);

      expect((await api().post(`/api/orders/${orderId}/cancel`).set(user.auth)).status).toBe(409); // already cancelled
      expect((await api().post(`/api/payments/orders/${orderId}/refund`).set(admin.auth)).status).toBe(409); // no double refund
    });

    it('a customer cannot cancel once the bakery accepted the order, but an admin can (with refund)', async () => {
      const user = await registerCustomer('adm-cancel');
      const orderId = await placePaidOrder(user, f, futureDate(26, 40), '12:00-14:00', 1);
      expect((await setStatus(admin, orderId, 'ACCEPTED')).status).toBe(200);
      expect((await api().post(`/api/orders/${orderId}/cancel`).set(user.auth)).status).toBe(409);
      expect((await api().post(`/api/orders/${orderId}/cancel`).set(admin.auth)).status).toBe(201);
      await eventually(() => paymentOf(user, orderId), (p) => p.status === 'REFUNDED');
    });

    it('an unpaid order can be cancelled and then cannot be paid any more', async () => {
      const user = await registerCustomer('unpaid');
      const addressId = await addAddress(user);
      await addToCart(user, f.regularVariantId, 1);
      const res = await checkout(user, addressId, futureDate(8, 25), '10:00-12:00');
      await waitForPayment(user, res.body.id);
      expect((await api().post(`/api/orders/${res.body.id}/cancel`).set(user.auth)).status).toBe(201);
      await eventually(() => paymentOf(user, res.body.id), (p) => p.status === 'CANCELLED');
      expect((await pay(user, res.body.id, 'SUCCESS')).status).toBe(409);
    });
  });

  describe('input rules', () => {
    it('refuses an empty cart, a past date, a quantity above 20 and an unknown address', async () => {
      const user = await registerCustomer('rules');
      const addressId = await addAddress(user);
      expect((await checkout(user, addressId, futureDate(8, 20), '10:00-12:00')).status).toBe(400); // empty cart
      expect((await api().post('/api/cart/items').set(user.auth).send({ variantId: f.regularVariantId, quantity: 21 })).status).toBe(400);
      await addToCart(user, f.regularVariantId, 1);
      expect((await checkout(user, addressId, '2020-01-01', '10:00-12:00')).status).toBe(400); // past date
      const today = new Date().toISOString().slice(0, 10);
      expect((await checkout(user, addressId, today, '10:00-12:00')).status).toBe(400); // needs one day notice
      expect((await checkout(user, '11111111-1111-1111-1111-111111111111', futureDate(8, 20), '10:00-12:00')).status).toBe(400);
    });
  });
});
