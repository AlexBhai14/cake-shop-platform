const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

// Display only. All money calculations are done by the backend (in whole paise).
export function formatINR(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? formatter.format(n) : '-';
}
