import { ADMIN_TARGETS, ALL_STATUSES, canTransition, CUSTOMER_CANCELLABLE } from './order-status';
import { validateDeliveryDate } from './delivery.util';
import { fromMinor, toMinor } from './money.util';

describe('order status machine', () => {
  it('allows the normal happy path step by step', () => {
    const path = ['PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('does not allow skipping steps or going backwards', () => {
    expect(canTransition('PENDING_PAYMENT', 'PREPARING')).toBe(false);
    expect(canTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(canTransition('PREPARING', 'ACCEPTED')).toBe(false);
  });

  it('has no way out of the final states', () => {
    for (const final of ['DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'] as const) {
      for (const to of ALL_STATUSES) expect(canTransition(final, to)).toBe(false);
    }
  });

  it('cannot cancel once the cake is being prepared', () => {
    expect(canTransition('PREPARING', 'CANCELLED')).toBe(false);
    expect(canTransition('ACCEPTED', 'CANCELLED')).toBe(true);
  });

  it('keeps payment statuses away from admins and cancellation limited for customers', () => {
    expect(ADMIN_TARGETS).not.toContain('CONFIRMED');
    expect(ADMIN_TARGETS).not.toContain('PAYMENT_FAILED');
    expect(CUSTOMER_CANCELLABLE).toEqual(['PENDING_PAYMENT', 'CONFIRMED']);
  });
});

describe('validateDeliveryDate', () => {
  const now = new Date('2026-11-10T08:00:00Z');
  it('accepts tomorrow and a date 30 days ahead', () => {
    expect(() => validateDeliveryDate('2026-11-11', now, 1, 60)).not.toThrow();
    expect(() => validateDeliveryDate('2026-12-10', now, 1, 60)).not.toThrow();
  });
  it('rejects today, the past, too far ahead and impossible dates', () => {
    expect(() => validateDeliveryDate('2026-11-10', now, 1, 60)).toThrow('notice');
    expect(() => validateDeliveryDate('2026-11-01', now, 1, 60)).toThrow();
    expect(() => validateDeliveryDate('2027-06-01', now, 1, 60)).toThrow('in advance');
    expect(() => validateDeliveryDate('2026-02-31', now, 1, 60)).toThrow('not a valid date');
  });
});

describe('money util', () => {
  it('adds prices exactly', () => {
    expect(fromMinor(toMinor('549.00') * 2 + toMinor('0.10'))).toBe('1098.10');
  });
});
