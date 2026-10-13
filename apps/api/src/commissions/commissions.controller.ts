import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CommissionsService } from './commissions.service';
import { CreateCommissionDto, UpdateCommissionStatusDto } from '../partners/dto/partner.dto';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller()
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('candidates/:candidateId/commissions') @RequirePermissions('finance.view')
  forCandidate(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.commissions.forCandidate(user, candidateId);
  }

  @Get('partners/:partnerId/commissions') @RequirePermissions('partner.view')
  forPartner(@CurrentUser() user: AuthUser, @Param('partnerId') partnerId: string) {
    return this.commissions.forPartner(user, partnerId);
  }

  @Post('candidates/:candidateId/commissions') @RequirePermissions('finance.manage')
  create(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateCommissionDto, @ReqMeta() meta: RequestMeta) {
    return this.commissions.create(user, candidateId, dto, meta);
  }

  @Post('commissions/:id/status') @RequirePermissions('finance.manage')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCommissionStatusDto, @ReqMeta() meta: RequestMeta) {
    return this.commissions.setStatus(user, id, dto.status, meta);
  }
}
