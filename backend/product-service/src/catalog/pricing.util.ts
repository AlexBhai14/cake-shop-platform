// "Discount display" helper.
// The admin sets the REAL selling price (for example 70) and a discount percent (for example 30).
// The shop shows a crossed-out price of  price / (1 - discount/100)  (here 100), then "30% OFF", then the real price (70).
// This is for DISPLAY only. Orders and payments always use the real variant price.
export function computeMrp(price: { toString(): string } | string | number, discountPercent: number): string | null {
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 90) return null;
  const paise = Math.round(Number(price.toString()) * 100); // whole paise: no floating point drift
  if (!Number.isFinite(paise) || paise <= 0) return null;
  const mrpRupees = Math.round(paise / (100 - discountPercent)); // = paise * 100 / (100 - d) / 100
  if (mrpRupees * 100 <= paise) return null; // rounding made it equal to the real price: show no fake discount
  return `${mrpRupees}.00`;
}

type PriceLike = { price: { toString(): string } | string | number };

// Adds "mrp" (the crossed-out price, or null) to every variant of a cake.
export function withMrp<C extends { discountPercent: number; variants: PriceLike[] }>(
  cake: C,
): Omit<C, 'variants'> & { variants: Array<C['variants'][number] & { mrp: string | null }> } {
  return {
    ...cake,
    variants: cake.variants.map((v) => ({ ...v, mrp: computeMrp(v.price, cake.discountPercent) })),
  };
}