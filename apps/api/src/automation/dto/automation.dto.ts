import { AutomationActionType, AutomationTrigger, TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateTaskActionConfig {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) daysOffset?: number;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
}

export class ActionDto {
  @IsEnum(AutomationActionType) type!: AutomationActionType;
  /**
   * Contenu selon `type` :
   * - CREATE_TASK        : { title, daysOffset?, priority? }
   * - ADD_CHECKLIST_ITEM : { label }
   * - TIMELINE_NOTE      : { content }
   */
  config!: Record<string, unknown>;
}

export class CreateAutomationRuleDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsEnum(AutomationTrigger) trigger!: AutomationTrigger;
  @IsOptional() @IsString() @MaxLength(60) triggerValue?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ActionDto) actions!: ActionDto[];
}

export class UpdateAutomationRuleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsEnum(AutomationTrigger) trigger?: AutomationTrigger;
  @IsOptional() @IsString() @MaxLength(60) triggerValue?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ActionDto) actions?: ActionDto[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
