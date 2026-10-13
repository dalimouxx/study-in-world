import { AppointmentStatus, TimelineEntityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAppointmentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(TimelineEntityType) relatedType?: TimelineEntityType;
  @IsOptional() @IsString() relatedId?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

export class ListAppointmentsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
