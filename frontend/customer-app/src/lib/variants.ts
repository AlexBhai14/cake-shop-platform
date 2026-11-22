import { Variant } from './types';

export const weightLabel = (g: number) => (g >= 1000 ? `${g / 1000} kg` : `${g} g`);

export const flavoursOf = (vs: Variant[]) => [...new Set(vs.map((v) => v.flavour))];

export const weightsFor = (vs: Variant[], flavour: string) =>
  [...new Set(vs.filter((v) => v.flavour === flavour).map((v) => v.weightGrams))].sort((a, b) => a - b);

// false (regular) first, then true (eggless)
export const typesFor = (vs: Variant[], flavour: string, weight: number) =>
  [...new Set(vs.filter((v) => v.flavour === flavour && v.weightGrams === weight).map((v) => v.eggless))].sort(
    (a, b) => Number(a) - Number(b),
  );

export const findVariant = (vs: Variant[], flavour: string, weight: number, eggless: boolean) =>
  vs.find((v) => v.flavour === flavour && v.weightGrams === weight && v.eggless === eggless);

export function lowestPrice(vs: Variant[]): string | null {
  if (vs.length === 0) return null;
  return vs.reduce((min, v) => (Number(v.price) < Number(min) ? v.price : min), vs[0].price);
}

export interface Selection {
  flavour?: string;
  weight?: number;
  eggless?: boolean;
}

// Turns what the customer picked into a valid combination. If an earlier choice makes a later choice
// impossible (for example this flavour has no 1 kg size), the first valid option is used.
export function resolveSelection(vs: Variant[], sel: Selection) {
  const flavours = flavoursOf(vs);
  const flavour = sel.flavour && flavours.includes(sel.flavour) ? sel.flavour : flavours[0];
  const weights = flavour ? weightsFor(vs, flavour) : [];
  const weight = sel.weight !== undefined && weights.includes(sel.weight) ? sel.weight : weights[0];
  const types = flavour && weight !== undefined ? typesFor(vs, flavour, weight) : [];
  const eggless = sel.eggless !== undefined && types.includes(sel.eggless) ? sel.eggless : types[0];
  const variant =
    flavour !== undefined && weight !== undefined && eggless !== undefined
      ? findVariant(vs, flavour, weight, eggless)
      : undefined;
  return { flavours, flavour, weights, weight, types, eggless, variant };
}
