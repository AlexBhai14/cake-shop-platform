export type EmailKind =
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_STATUS'
  | 'ORDER_SHIPPED'
  | 'REFUND_PROCESSED';

export interface EmailContext {
  orderId: string;
  status?: string;
  reason?: string;
  amount?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export const orderNumber = (orderId: string) => orderId.slice(0, 8).toUpperCase();

// Everything that comes from outside is escaped before it goes into HTML.
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CANCEL_REASONS: Record<string, string> = {
  PAYMENT_FAILED: 'your payment could not be completed. No money was taken (this shop uses a simulated payment system).',
  PAYMENT_TIMEOUT: 'we did not receive your payment in time.',
  OUT_OF_STOCK: 'one of the cakes is out of stock.',
  DELIVERY_SLOT_FULL: 'the delivery slot you chose is full.',
  INVALID_SLOT: 'the delivery slot you chose is not available.',
  CUSTOMER_REQUEST: 'you asked us to cancel it.',
  CANCELLED_BY_ADMIN: 'the shop had to cancel it.',
};

const STATUS_TEXT: Record<string, { subject: string; line: string }> = {
  ACCEPTED: { subject: 'Your order was accepted', line: 'The bakery has accepted your order.' },
  PREPARING: { subject: 'Your cake is being prepared', line: 'Our bakers have started preparing your cake.' },
  READY_FOR_DISPATCH: { subject: 'Your cake is ready', line: 'Your cake is ready and waits for the delivery partner.' },
  DELIVERED: { subject: 'Your cake was delivered', line: 'Your cake was delivered. Enjoy, and thank you for ordering!' },
};

export function isNotifiableStatus(status: string): boolean {
  return status in STATUS_TEXT; // OUT_FOR_DELIVERY is sent through the OrderShipped event
}

function wrap(subject: string, line: string, orderId: string): RenderedEmail {
  const no = orderNumber(orderId);
  const text = `${line}\n\nOrder number: ${no}\n\nCake Shop`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px">` +
    `<h2>${escapeHtml(subject)}</h2><p>${escapeHtml(line)}</p>` +
    `<p>Order number: <strong>${escapeHtml(no)}</strong></p><p>Cake Shop</p></div>`;
  return { subject: `${subject} (#${no})`, text, html };
}

export function renderEmail(kind: EmailKind, ctx: EmailContext): RenderedEmail {
  switch (kind) {
    case 'ORDER_CONFIRMED':
      return wrap('Order confirmed', 'Thank you! Your order is confirmed and your (simulated) payment was received.', ctx.orderId);
    case 'ORDER_CANCELLED': {
      const why = CANCEL_REASONS[ctx.reason ?? ''] ?? 'of a problem with the order.';
      const isPayment = ctx.reason === 'PAYMENT_FAILED' || ctx.reason === 'PAYMENT_TIMEOUT';
      return wrap(isPayment ? 'Payment failed, order cancelled' : 'Order cancelled', `Your order was cancelled because ${why}`, ctx.orderId);
    }
    case 'ORDER_STATUS': {
      const t = STATUS_TEXT[ctx.status ?? ''] ?? { subject: 'Order update', line: 'Your order status changed.' };
      return wrap(t.subject, t.line, ctx.orderId);
    }
    case 'ORDER_SHIPPED':
      return wrap('Your cake is out for delivery', 'Your cake is on its way to you.', ctx.orderId);
    case 'REFUND_PROCESSED':
      return wrap('Refund processed', `A (simulated) refund of INR ${ctx.amount ?? ''} was processed for your order. The amount has been added to your wallet.`, ctx.orderId);
  }
}
