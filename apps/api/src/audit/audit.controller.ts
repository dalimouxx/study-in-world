import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { PaginationQuery } from '../common/pagination';
import { AuditService } from './audit.service';

class ActivityQuery extends PaginationQuery {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() userId?: string;
}

class LoginQuery extends PaginationQuery {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @Type(() => Boolean)
  @IsBoolean()
  success?: boolean;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('activity')
  @RequirePermissions('audit.view')
  activity(@CurrentUser() user: AuthUser, @Query() q: ActivityQuery) {
    return this.audit.listActivity(user.organizationId, q);
  }

  @Get('logins')
  @RequirePermissions('audit.view')
  logins(@CurrentUser() user: AuthUser, @Query() q: LoginQuery) {
    return this.audit.listLogins(user.organizationId, q);
  }
}
