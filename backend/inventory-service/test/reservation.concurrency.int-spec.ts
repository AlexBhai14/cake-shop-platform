import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { InsufficientCapacityError, ReservationService } from '../src/inventory/reservation.service';

// WHY this test exists: the unit tests use fakes, so they cannot prove that two customers ordering the
// last cake at the SAME moment never both get it. Only a real MySQL can show that the conditional
// UPDATE statements and row locks work (and that the raw SQL column names are correct).
describe('ReservationService against a real MySQL (Testcontainers)', () => {
  let container: StartedMySqlContainer;
  let prisma: PrismaClient;

  const serviceWith = (capacity: number) =>
    new ReservationService({ get: (k: string) => ({ SLOTS: '10:00-12:00,12:00-14:00', DEFAULT_SLOT_CAPACITY: capacity } as any)[k] } as any);

  const order = (variantId: string, quantity: number, date: string, slot = '10:00-12:00') => ({
    orderId: randomUUID(), userId: randomUUID(), items: [{ variantId, quantity }],
    deliveryDate: date, deliverySlot: slot, totalAmount: '100.00', currency: 'INR',
  });

  // MySQL can abort one of many concurrent transactions with a deadlock. The inventory saga retries such technical errors
  // (retry queue), so the test does the same: only a CAPACITY decision (InsufficientCapacityError) is a final answer.
  const isDeadlock = (e: any) =>
    e?.code === 'P2034' || (e?.code === 'P2010' && /1213|1205|deadlock|lock wait timeout/i.test(String(e?.message)));

  const reserve = async (service: ReservationService, data: ReturnType<typeof order>) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.$transaction((tx) => service.reserve(tx, data), { maxWait: 30000, timeout: 60000 });
      } catch (e) {
        if (!isDeadlock(e) || attempt >= 10) throw e;
      }
    }
  };

  // Short reason of a lost reservation (shows the real error text in the test output if it is not a capacity decision).
  const why = (r: PromiseRejectedResult) =>
    r.reason instanceof InsufficientCapacityError ? r.reason.reason : String(r.reason?.message ?? r.reason).split('\n').pop();
  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.4').start();
    const url = container.getConnectionUri();
    // Prisma refuses a shadow database that is the same as the main one. "db push" never uses it, so any other name works.
    const shadowUrl = new URL(url);
    shadowUrl.pathname = `${shadowUrl.pathname}_shadow`;
    // creates the tables from prisma/schema.prisma in the empty database
    execSync('npx prisma db push --skip-generate', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url, SHADOW_DATABASE_URL: shadowUrl.toString() },
      stdio: 'inherit',
    });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('never oversells: 20 customers race for 5 cakes, exactly 5 win', async () => {
    const variantId = randomUUID();
    await prisma.inventoryItem.create({ data: { variantId, onHand: 5 } });
    const service = serviceWith(1000);

    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(service, order(variantId, 1, '2030-01-10'))));

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(5);
    expect(lost).toHaveLength(15);
    expect(lost.map(why)).toEqual(Array(15).fill('OUT_OF_STOCK'));
    const item = await prisma.inventoryItem.findUnique({ where: { variantId } });
    expect(item).toMatchObject({ onHand: 5, reserved: 5 });
  });

  it('respects the delivery slot capacity under concurrency: 10 made-to-order cakes, 3 places', async () => {
    const variantId = randomUUID(); // no stock record = made to order
    const service = serviceWith(3);

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => reserve(service, order(variantId, 1, '2030-02-10'))));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(lost.map(why)).toEqual(Array(7).fill('DELIVERY_SLOT_FULL')); const slot = await prisma.slotCapacity.findFirst({ where: { slot: '10:00-12:00', deliveryDate: new Date('2030-02-10T00:00:00.000Z') } });
    expect(slot).toMatchObject({ capacity: 3, booked: 3 });
  });

  it('a failed reservation changes nothing (the whole transaction is rolled back)', async () => {
    const variantId = randomUUID();
    await prisma.inventoryItem.create({ data: { variantId, onHand: 1 } });
    const service = serviceWith(10);

    await expect(reserve(service, order(variantId, 2, '2030-03-10'))).rejects.toBeInstanceOf(InsufficientCapacityError);

    const slot = await prisma.slotCapacity.findFirst({ where: { deliveryDate: new Date('2030-03-10T00:00:00.000Z') } });
    expect(slot?.booked ?? 0).toBe(0); // the slot booking was rolled back together with the failed stock update
    expect((await prisma.inventoryItem.findUnique({ where: { variantId } }))?.reserved).toBe(0);
  });

  it('is idempotent: reserving the same order twice reserves the stock only once', async () => {
    const variantId = randomUUID();
    await prisma.inventoryItem.create({ data: { variantId, onHand: 10 } });
    const service = serviceWith(10);
    const data = order(variantId, 3, '2030-04-10');

    await reserve(service, data);
    await reserve(service, data);

    expect((await prisma.inventoryItem.findUnique({ where: { variantId } }))?.reserved).toBe(3);
    expect(await prisma.reservation.count({ where: { orderId: data.orderId } })).toBe(1);
  });

  it('confirm consumes the stock and release (compensation) gives everything back', async () => {
    const variantId = randomUUID();
    await prisma.inventoryItem.create({ data: { variantId, onHand: 10 } });
    const service = serviceWith(10);

    const paid = order(variantId, 4, '2030-05-10');
    await reserve(service, paid);
    await prisma.$transaction((tx) => service.confirm(tx, paid.orderId));
    expect(await prisma.inventoryItem.findUnique({ where: { variantId } })).toMatchObject({ onHand: 6, reserved: 0 });

    const failed = order(variantId, 2, '2030-05-10');
    await reserve(service, failed);
    expect(await prisma.inventoryItem.findUnique({ where: { variantId } })).toMatchObject({ onHand: 6, reserved: 2 });
    await prisma.$transaction((tx) => service.release(tx, failed.orderId));
    expect(await prisma.inventoryItem.findUnique({ where: { variantId } })).toMatchObject({ onHand: 6, reserved: 0 });

    const slot = await prisma.slotCapacity.findFirst({ where: { slot: '10:00-12:00', deliveryDate: new Date('2030-05-10T00:00:00.000Z') } });
    expect(slot?.booked).toBe(4); // only the confirmed order still occupies the slot

    await prisma.$transaction((tx) => service.release(tx, paid.orderId)); // cancellation AFTER payment
    expect(await prisma.inventoryItem.findUnique({ where: { variantId } })).toMatchObject({ onHand: 10, reserved: 0 });
  });
});
