import { formatINR } from './money';

describe('formatINR', () => {
  it('formats a price string with the rupee sign and two decimals', () => {
    const text = formatINR('549.00');
    expect(text).toContain('₹');
    expect(text).toContain('549.00');
  });

  it('adds Indian digit grouping', () => {
    expect(formatINR('1847')).toContain('1,847.00');
    expect(formatINR(100000)).toContain('1,00,000.00');
  });

  it('shows a dash for something that is not a number', () => {
    expect(formatINR('abc')).toBe('-');
  });
});
