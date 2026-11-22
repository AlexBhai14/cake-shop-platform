import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SetStockDto {
  @IsInt()
  @Min(0)
  @Max(100000)
  onHand: number;
}

export class AdjustStockDto {
  @IsInt()
  @Min(-100000)
  @Max(100000)
  delta: number; // positive = stock received, negative = stock removed (spoiled, sold in shop...)

  @IsString()
  @MaxLength(100)
  reason: string;
}

export class SlotQueryDto {
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

export class SetSlotDto {
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsString()
  @MaxLength(20)
  slot: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  capacity: number;
}

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
