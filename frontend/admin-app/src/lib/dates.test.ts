import { earliestDeliveryDate, newIdempotencyKey, toLocalIsoDate } from './dates';

describe('dates', () => {
  it('the earliest delivery date is tomorrow', () => {
    expect(earliestDeliveryDate(new Date(2026, 10, 10, 23, 30))).toBe('2026-11-11');
  });

  it('handles the end of a month and of a year', () => {
    expect(earliestDeliveryDate(new Date(2026, 10, 30))).toBe('2026-12-01');
    expect(earliestDeliveryDate(new Date(2026, 11, 31))).toBe('2027-01-01');
  });

  it('formats a local date with zero padding', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('creates a different idempotency key every time', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
