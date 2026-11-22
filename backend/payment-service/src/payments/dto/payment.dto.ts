import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const SCENARIOS = ['SUCCESS', 'FAILURE', 'TIMEOUT'] as const;

export class PayDto {
  // The customer picks what the MOCK bank should do (a real shop would never allow this).
  @IsOptional()
  @IsIn(SCENARIOS)
  scenario?: (typeof SCENARIOS)[number];
}

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
