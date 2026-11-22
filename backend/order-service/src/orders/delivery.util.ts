import { BadRequestException } from '@nestjs/common';

export const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

// Delivery date must be a real calendar date between (today + minLeadDays) and (today + maxAdvanceDays).
export function validateDeliveryDate(dateStr: string, now: Date, minLeadDays: number, maxAdvanceDays: number): void {
  const date = parseDate(dateStr);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr) {
    throw new BadRequestException('deliveryDate is not a valid date');
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < minLeadDays) {
    throw new BadRequestException(`Cakes need at least ${minLeadDays} day(s) notice`);
  }
  if (days > maxAdvanceDays) {
    throw new BadRequestException(`Orders can be placed at most ${maxAdvanceDays} days in advance`);
  }
}
