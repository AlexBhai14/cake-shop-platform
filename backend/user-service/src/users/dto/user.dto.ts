import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Matches(/^[0-9+\- ]{7,20}$/, { message: 'phone must be 7-20 digits, spaces, + or -' })
  phone?: string;
}

export class CreateAddressDto {
  @IsString() @MinLength(1) @MaxLength(50) label: string;
  @IsString() @MinLength(3) @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(2) @MaxLength(100) city: string;
  @IsString() @MinLength(2) @MaxLength(100) state: string;
  @IsString() @MinLength(3) @MaxLength(12) postalCode: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) label?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(12) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
}

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
