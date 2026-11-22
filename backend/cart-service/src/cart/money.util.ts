// Money is calculated in whole paise (integers), never with floating point numbers.
export function toMinor(price: string | number): number {
  const [whole, fraction = ''] = String(price).split('.');
  return parseInt(whole, 10) * 100 + parseInt((fraction + '00').slice(0, 2), 10);
}

export function fromMinor(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}
