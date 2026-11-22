import { adminCanCancel, NEXT_LABEL, nextStatus } from './orderFlow';

describe('order flow (admin)', () => {
  it('moves a paid order along the production pipeline one step at a time', () => {
    expect(nextStatus('CONFIRMED')).toBe('ACCEPTED');
    expect(nextStatus('ACCEPTED')).toBe('PREPARING');
    expect(nextStatus('PREPARING')).toBe('READY_FOR_DISPATCH');
    expect(nextStatus('READY_FOR_DISPATCH')).toBe('OUT_FOR_DELIVERY');
    expect(nextStatus('OUT_FOR_DELIVERY')).toBe('DELIVERED');
  });

  it('offers no next step for waiting, final or failed orders', () => {
    expect(nextStatus('PENDING_PAYMENT')).toBeNull();
    expect(nextStatus('DELIVERED')).toBeNull();
    expect(nextStatus('CANCELLED')).toBeNull();
    expect(nextStatus('PAYMENT_FAILED')).toBeNull();
  });

  it('allows cancelling only until the bakery starts preparing', () => {
    expect(adminCanCancel('PENDING_PAYMENT')).toBe(true);
    expect(adminCanCancel('CONFIRMED')).toBe(true);
    expect(adminCanCancel('ACCEPTED')).toBe(true);
    expect(adminCanCancel('PREPARING')).toBe(false);
    expect(adminCanCancel('DELIVERED')).toBe(false);
  });

  it('has a button label for every step the admin can trigger', () => {
    for (const s of ['ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const) {
      expect(NEXT_LABEL[s]).toBeTruthy();
    }
  });
});
