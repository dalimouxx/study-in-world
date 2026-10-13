import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateVisaFileDto, UpdateVisaFileDto } from './dto/visa.dto';
import { VisaService } from './visa.service';

@ApiTags('visa')
@ApiBearerAuth()
@Controller()
export class VisaController {
  constructor(private readonly visa: VisaService) {}

  @Get('candidates/:candidateId/visa-files') @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.visa.list(user, candidateId);
  }

  @Post('candidates/:candidateId/visa-files') @RequirePermissions('visa.manage')
  create(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateVisaFileDto, @ReqMeta() meta: RequestMeta) {
    return this.visa.create(user, candidateId, dto, meta);
  }

  @Patch('visa-files/:id') @RequirePermissions('visa.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVisaFileDto, @ReqMeta() meta: RequestMeta) {
    return this.visa.update(user, id, dto, meta);
  }
}
