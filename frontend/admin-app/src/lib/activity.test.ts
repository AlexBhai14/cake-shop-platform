import { buildActivity, timeAgo } from './activity';
import { AdminOrder } from './types';

const order = (id: string, status: AdminOrder['status'], updatedAt: string): AdminOrder =>
  ({ id, status, totalAmount: '549.00', createdAt: '2026-11-01T00:00:00Z', updatedAt }) as unknown as AdminOrder;

describe('buildActivity', () => {
  it('puts the most recently changed order first and writes a readable sentence', () => {
    const list = buildActivity([
      order('aaaaaaaa-1', 'ACCEPTED', '2026-11-22T10:00:00Z'),
      order('bbbbbbbb-2', 'CONFIRMED', '2026-11-22T11:00:00Z'),
    ]);
    expect(list[0].text).toBe('Order #BBBBBBBB paid, waiting to be accepted');
    expect(list[0].tone).toBe('green');
    expect(list[1].text).toBe('Order #AAAAAAAA accepted');
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => order(`id${i}xxxxxx`, 'DELIVERED', `2026-11-22T10:${String(i).padStart(2, '0')}:00Z`));
    expect(buildActivity(many, 5)).toHaveLength(5);
  });

  it('falls back to createdAt when updatedAt is missing', () => {
    const o = { id: 'cccccccc', status: 'CANCELLED', totalAmount: '1.00', createdAt: '2026-11-20T00:00:00Z' } as unknown as AdminOrder;
    expect(buildActivity([o])[0].at).toBe('2026-11-20T00:00:00Z');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  it('formats seconds, minutes, hours and days', () => {
    expect(timeAgo('2026-11-22T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-22T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-22T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-20T12:00:00Z', now)).toBe('2 d ago');
  });
});
