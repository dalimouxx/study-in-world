import { TaskPriority, TaskStatus, TimelineEntityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsEnum(TimelineEntityType) relatedType?: TimelineEntityType;
  @IsOptional() @IsString() relatedId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class ListTasksQuery extends PaginationQuery {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() mine?: string;
}
