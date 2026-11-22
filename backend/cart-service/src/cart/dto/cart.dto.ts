import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

export class UpdateItemDto {
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}
