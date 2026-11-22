import { escapeHtml, isNotifiableStatus, orderNumber, renderEmail } from './templates';

const ID = 'abcdef12-0000-0000-0000-000000000000';

describe('email templates', () => {
  it('uses a short upper-case order number', () => {
    expect(orderNumber(ID)).toBe('ABCDEF12');
  });

  it('confirms the order and mentions the simulated payment', () => {
    const m = renderEmail('ORDER_CONFIRMED', { orderId: ID });
    expect(m.subject).toBe('Order confirmed (#ABCDEF12)');
    expect(m.text).toContain('simulated');
    expect(m.html).toContain('ABCDEF12');
  });

  it('explains payment failure with the right title', () => {
    const m = renderEmail('ORDER_CANCELLED', { orderId: ID, reason: 'PAYMENT_FAILED' });
    expect(m.subject).toContain('Payment failed');
    expect(m.text).toContain('payment could not be completed');
  });

  it('explains other cancellation reasons and survives unknown reasons', () => {
    expect(renderEmail('ORDER_CANCELLED', { orderId: ID, reason: 'DELIVERY_SLOT_FULL' }).text).toContain('slot you chose is full');
    expect(renderEmail('ORDER_CANCELLED', { orderId: ID, reason: 'SOMETHING_NEW' }).text).toContain('problem with the order');
  });

  it('has a message for each preparation status and for shipping and refunds', () => {
    expect(renderEmail('ORDER_STATUS', { orderId: ID, status: 'PREPARING' }).subject).toContain('being prepared');
    expect(renderEmail('ORDER_STATUS', { orderId: ID, status: 'DELIVERED' }).subject).toContain('delivered');
    expect(renderEmail('ORDER_SHIPPED', { orderId: ID }).subject).toContain('out for delivery');
    expect(renderEmail('REFUND_PROCESSED', { orderId: ID, amount: '1847.00' }).text).toContain('1847.00');
  });

  it('does not email OUT_FOR_DELIVERY twice (OrderShipped covers it)', () => {
    expect(isNotifiableStatus('OUT_FOR_DELIVERY')).toBe(false);
    expect(isNotifiableStatus('PREPARING')).toBe(true);
  });

  it('escapes HTML in text that comes from outside', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    const m = renderEmail('REFUND_PROCESSED', { orderId: '<b>x</b>', amount: '1' });
    expect(m.html).not.toContain('<b>x</b>');
  });
});
