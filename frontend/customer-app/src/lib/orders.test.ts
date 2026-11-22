import { canCustomerCancel, cancelReasonText, isFinalStatus, progressIndex, statusTone } from './orders';

describe('order helpers', () => {
  it('lets a customer cancel only before the bakery accepts the order', () => {
    expect(canCustomerCancel('PENDING_PAYMENT')).toBe(true);
    expect(canCustomerCancel('CONFIRMED')).toBe(true);
    expect(canCustomerCancel('ACCEPTED')).toBe(false);
    expect(canCustomerCancel('PREPARING')).toBe(false);
  });

  it('knows the final statuses (polling stops there)', () => {
    expect(isFinalStatus('DELIVERED')).toBe(true);
    expect(isFinalStatus('CANCELLED')).toBe(true);
    expect(isFinalStatus('PAYMENT_FAILED')).toBe(true);
    expect(isFinalStatus('CONFIRMED')).toBe(false);
  });

  it('shows a progress bar only for healthy orders', () => {
    expect(progressIndex('CONFIRMED')).toBe(0);
    expect(progressIndex('DELIVERED')).toBe(5);
    expect(progressIndex('PENDING_PAYMENT')).toBe(-1);
    expect(progressIndex('CANCELLED')).toBe(-1);
  });

  it('picks colours', () => {
    expect(statusTone('DELIVERED')).toBe('green');
    expect(statusTone('PAYMENT_FAILED')).toBe('red');
    expect(statusTone('PENDING_PAYMENT')).toBe('amber');
  });

  it('explains why an order was cancelled', () => {
    expect(cancelReasonText('OUT_OF_STOCK')).toContain('out of stock');
    expect(cancelReasonText('SOMETHING_NEW')).toBe('The order was cancelled.');
    expect(cancelReasonText(null)).toBeNull();
  });
});
