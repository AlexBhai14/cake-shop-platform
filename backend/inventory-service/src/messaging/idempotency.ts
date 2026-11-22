import { buildEnvelope, DataMap, EventType, ROUTING_KEYS } from './events';

// Transactional Outbox: the event is saved in the SAME database transaction as the business change.
// A background publisher (OutboxPublisher) sends it to RabbitMQ afterwards.
// So either both the change and the event exist, or neither does.
export async function enqueueEvent<K extends EventType>(
  tx: any,
  type: K,
  data: DataMap[K],
  correlationId: string,
) {
  const envelope = buildEnvelope(type, data, correlationId);
  await tx.outboxEvent.create({
    data: { id: envelope.eventId, type, routingKey: ROUTING_KEYS[type], payload: envelope as any },
  });
  return envelope;
}

// Idempotent consumer: RabbitMQ can deliver the same event twice.
// The event id is recorded in the SAME transaction as the work, so the work happens once.
export async function processOnce<T>(
  prisma: any,
  eventId: string,
  work: (tx: any) => Promise<T>,
): Promise<{ duplicate: boolean; result?: T }> {
  return prisma.$transaction(async (tx: any) => {
    const seen = await tx.processedEvent.findUnique({ where: { eventId } });
    if (seen) return { duplicate: true };
    await tx.processedEvent.create({ data: { eventId } });
    const result = await work(tx);
    return { duplicate: false, result };
  });
}
