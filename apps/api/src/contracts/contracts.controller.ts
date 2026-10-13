import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { ContractsService } from './contracts.service';
import { CreateContractDto, SignContractDto, UpdateContractStatusDto } from './dto/contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller()
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('candidates/:candidateId/contracts') @RequirePermissions('finance.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.contracts.list(user.organizationId, candidateId);
  }

  @Post('candidates/:candidateId/contracts') @RequirePermissions('finance.manage')
  create(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateContractDto, @ReqMeta() meta: RequestMeta) {
    return this.contracts.create(user, candidateId, dto, meta);
  }

  @Post('contracts/:id/status') @RequirePermissions('finance.manage')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateContractStatusDto, @ReqMeta() meta: RequestMeta) {
    return this.contracts.setStatus(user, id, dto.status, meta);
  }

  /** Signature en présentiel : l'employé est authentifié, mais c'est le candidat qui signe sur l'écran. */
  @Post('candidates/:candidateId/contracts/:id/sign') @RequirePermissions('finance.manage')
  sign(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Param('id') id: string, @Body() dto: SignContractDto, @ReqMeta() meta: RequestMeta) {
    return this.contracts.sign(user.organizationId, candidateId, id, dto, meta, user.id);
  }

  @Get('contracts/:id/pdf') @RequirePermissions('finance.view')
  async pdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.contracts.pdf(user.organizationId, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` }).send(buffer);
  }
}
