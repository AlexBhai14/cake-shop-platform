import { enqueueEvent, processOnce } from './idempotency';

describe('enqueueEvent (outbox)', () => {
  it('stores the event in the outbox table with its routing key and envelope', async () => {
    const tx = { outboxEvent: { create: jest.fn() } };
    const env = await enqueueEvent(tx, 'StockReserved', { orderId: 'o1' }, 'corr-1');
    const arg = tx.outboxEvent.create.mock.calls[0][0].data;
    expect(arg.id).toBe(env.eventId);
    expect(arg.type).toBe('StockReserved');
    expect(arg.routingKey).toBe('stock.reserved');
    expect(arg.payload).toMatchObject({ version: 1, correlationId: 'corr-1', data: { orderId: 'o1' } });
  });
});

describe('processOnce (idempotent consumer)', () => {
  const makePrisma = (alreadyProcessed: boolean) => {
    const tx = {
      processedEvent: {
        findUnique: jest.fn().mockResolvedValue(alreadyProcessed ? { eventId: 'e1' } : null),
        create: jest.fn(),
      },
    };
    return { tx, prisma: { $transaction: jest.fn(async (fn: any) => fn(tx)) } };
  };

  it('runs the work once and records the event id', async () => {
    const { prisma, tx } = makePrisma(false);
    const work = jest.fn().mockResolvedValue('done');
    const r = await processOnce(prisma, 'e1', work);
    expect(r).toEqual({ duplicate: false, result: 'done' });
    expect(tx.processedEvent.create).toHaveBeenCalledWith({ data: { eventId: 'e1' } });
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('skips the work when the event was already processed', async () => {
    const { prisma } = makePrisma(true);
    const work = jest.fn();
    const r = await processOnce(prisma, 'e1', work);
    expect(r.duplicate).toBe(true);
    expect(work).not.toHaveBeenCalled();
  });

  it('propagates errors so the message goes to the retry queue', async () => {
    const { prisma } = makePrisma(false);
    await expect(processOnce(prisma, 'e1', async () => { throw new Error('db down'); })).rejects.toThrow('db down');
  });
});
