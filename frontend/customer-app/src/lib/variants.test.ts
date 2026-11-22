import { Variant } from './types';
import { cheapestVariant, lowestPrice, resolveSelection, weightLabel } from './variants';

const v = (id: string, flavour: string, weightGrams: number, eggless: boolean, price: string): Variant => ({
  id, cakeId: 'k1', flavour, weightGrams, eggless, price, isActive: true,
});

const variants = [
  v('1', 'Chocolate', 500, false, '549.00'),
  v('2', 'Chocolate', 500, true, '599.00'),
  v('3', 'Chocolate', 1000, false, '999.00'),
  v('4', 'Vanilla', 500, true, '449.00'),
];

describe('variant selection', () => {
  it('starts with the first valid combination', () => {
    const r = resolveSelection(variants, {});
    expect(r.flavour).toBe('Chocolate');
    expect(r.weight).toBe(500);
    expect(r.eggless).toBe(false);
    expect(r.variant?.id).toBe('1');
  });

  it('offers only sizes and types that exist for the chosen flavour', () => {
    const r = resolveSelection(variants, { flavour: 'Vanilla' });
    expect(r.weights).toEqual([500]);
    expect(r.types).toEqual([true]);
    expect(r.variant?.id).toBe('4');
  });

  it('falls back to a valid option when an earlier choice makes a later one impossible', () => {
    const r = resolveSelection(variants, { flavour: 'Vanilla', weight: 1000, eggless: false });
    expect(r.weight).toBe(500);
    expect(r.eggless).toBe(true);
  });

  it('finds the exact variant for flavour, size and eggless', () => {
    expect(resolveSelection(variants, { flavour: 'Chocolate', weight: 500, eggless: true }).variant?.id).toBe('2');
  });

  it('handles a cake without variants', () => {
    const r = resolveSelection([], {});
    expect(r.variant).toBeUndefined();
    expect(r.flavours).toEqual([]);
  });
});

describe('helpers', () => {
  it('finds the lowest price', () => {
    expect(lowestPrice(variants)).toBe('449.00');
    expect(lowestPrice([])).toBeNull();
  });
  it('picks the cheapest variant by real price', () => {
    expect(cheapestVariant(variants)?.id).toBe('4');
    expect(cheapestVariant([])).toBeNull();
  });
  it('labels weights', () => {
    expect(weightLabel(500)).toBe('500 g');
    expect(weightLabel(1000)).toBe('1 kg');
    expect(weightLabel(1500)).toBe('1.5 kg');
  });
});
