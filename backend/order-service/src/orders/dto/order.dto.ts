import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ADMIN_TARGETS, ALL_STATUSES } from '../order-status';

export class CheckoutDto {
  @IsUUID()
  addressId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'deliveryDate must be YYYY-MM-DD' })
  deliveryDate: string;

  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, { message: 'deliverySlot must look like 10:00-12:00' })
  deliverySlot: string;
}

export class SetStatusDto {
  @IsIn(ADMIN_TARGETS)
  status: (typeof ADMIN_TARGETS)[number];
}

export class OrderListQueryDto {
  @IsOptional() @IsIn(ALL_STATUSES) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
