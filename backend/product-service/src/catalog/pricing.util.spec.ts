import { computeMrp, withMrp } from './pricing.util';

describe('computeMrp (discount display)', () => {
  it('real price 70 with 30% discount is shown as 100', () => {
    expect(computeMrp('70.00', 30)).toBe('100.00');
  });

  it('works with numbers and rounds to a whole rupee', () => {
    expect(computeMrp(549, 20)).toBe('686.00'); // 549 / 0.8 = 686.25
    expect(computeMrp('499.00', 10)).toBe('554.00'); // 554.44
  });

  it('returns null when there is no discount', () => {
    expect(computeMrp('70.00', 0)).toBeNull();
  });

  it('returns null for a discount outside 1..90 or a non-integer', () => {
    expect(computeMrp('70.00', 95)).toBeNull();
    expect(computeMrp('70.00', -5)).toBeNull();
    expect(computeMrp('70.00', 12.5)).toBeNull();
  });

  it('returns null for an invalid price', () => {
    expect(computeMrp('abc', 30)).toBeNull();
    expect(computeMrp('0.00', 30)).toBeNull();
  });

  it('shows no fake discount when rounding would make both prices equal', () => {
    expect(computeMrp('10.00', 1)).toBeNull(); // 10.10 rounds to 10
  });
});

describe('withMrp', () => {
  it('adds mrp to every variant and keeps the real price untouched', () => {
    const cake = withMrp({ discountPercent: 30, variants: [{ price: '70.00', id: 'v1' }, { price: '140.00', id: 'v2' }] });
    expect(cake.variants.map((v) => v.mrp)).toEqual(['100.00', '200.00']);
    expect(cake.variants[0].price).toBe('70.00');
  });

  it('gives mrp null when the cake has no discount', () => {
    expect(withMrp({ discountPercent: 0, variants: [{ price: '70.00' }] }).variants[0].mrp).toBeNull();
  });
});
