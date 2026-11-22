import { ConflictException } from '@nestjs/common';
import { canTransition, OrderStatus } from './order-status';

// Moves an order to a new status INSIDE a transaction and records the history row.
// The update only succeeds if the order is still in the status we read ("from"), so two
// requests changing the same order at the same moment cannot both win.
export async function applyTransition(
  tx: any,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  changedBy: string,
  note?: string,
  extra: Record<string, unknown> = {},
) {
  if (!canTransition(from, to)) {
    throw new ConflictException(`An order cannot change from ${from} to ${to}`);
  }
  const result = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to, ...extra } });
  if (result.count === 0) throw new ConflictException('The order was changed by another request');
  await tx.orderStatusHistory.create({ data: { orderId, fromStatus: from, toStatus: to, changedBy, note } });
}
