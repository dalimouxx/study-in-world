import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateMessageTemplateDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) nameFr!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) nameAr!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) subjectFr?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) subjectAr?: string;
  @IsString() @MinLength(1) @MaxLength(2000) bodyFr!: string;
  @IsString() @MinLength(1) @MaxLength(2000) bodyAr!: string;
}

export class RenderQueryDto {
  @IsString() key!: string;
  @IsIn(['WHATSAPP', 'EMAIL']) channel!: 'WHATSAPP' | 'EMAIL';
  @IsIn(['CANDIDATE', 'PROSPECT']) entityType!: 'CANDIDATE' | 'PROSPECT';
  @IsString() entityId!: string;
}

export class MessageSentDto {
  @IsString() key!: string;
  @IsIn(['CANDIDATE', 'PROSPECT']) entityType!: 'CANDIDATE' | 'PROSPECT';
  @IsString() entityId!: string;
}
