import { OutboxPublisher } from './outbox.publisher';

describe('OutboxPublisher', () => {
  const row = (id: string) => ({ id, routingKey: 'order.created', payload: { eventId: id } });
  let prisma: any;
  let rabbit: { publish: jest.Mock };
  let publisher: OutboxPublisher;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma = { outboxEvent: { findMany: jest.fn(), update: jest.fn() } };
    rabbit = { publish: jest.fn().mockResolvedValue(undefined) };
    publisher = new OutboxPublisher(prisma, rabbit as any);
  });

  it('publishes pending events in order and marks them as published', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([row('a'), row('b')]);
    expect(await publisher.tick()).toBe(2);
    expect(rabbit.publish.mock.calls.map((c) => c[1].eventId)).toEqual(['a', 'b']);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { publishedAt: expect.any(Date) } });
  });

  it('stops at the first failure, counts the attempt and leaves the event unpublished', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([row('a'), row('b')]);
    rabbit.publish.mockRejectedValueOnce(new Error('broker down'));
    expect(await publisher.tick()).toBe(0);
    expect(rabbit.publish).toHaveBeenCalledTimes(1); // b was NOT published before a
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { attempts: { increment: 1 } } });
  });
});
