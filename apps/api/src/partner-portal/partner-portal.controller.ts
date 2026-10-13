import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import type { PartnerAuthUser } from '../common/auth-user';
import { CurrentPartner } from './current-partner.decorator';
import { AddPartnerCommentDto } from './dto/partner-comment.dto';
import { PartnerJwtAuthGuard } from './guards/partner-jwt-auth.guard';
import { PartnerPortalService } from './partner-portal.service';

@Public()
@UseGuards(PartnerJwtAuthGuard)
@ApiBearerAuth()
@ApiTags('partner-portal')
@Controller('partner-portal')
export class PartnerPortalController {
  constructor(private readonly portal: PartnerPortalService) {}

  @Get('profile')
  profile(@CurrentPartner() partner: PartnerAuthUser) {
    return this.portal.profile(partner);
  }

  @Get('candidates')
  candidates(@CurrentPartner() partner: PartnerAuthUser) {
    return this.portal.candidates(partner);
  }

  @Get('candidates/:id')
  candidate(@CurrentPartner() partner: PartnerAuthUser, @Param('id') id: string) {
    return this.portal.candidate(partner, id);
  }

  @Get('candidates/:id/comments')
  comments(@CurrentPartner() partner: PartnerAuthUser, @Param('id') id: string) {
    return this.portal.comments(partner, id);
  }

  @Post('candidates/:id/comments')
  addComment(@CurrentPartner() partner: PartnerAuthUser, @Param('id') id: string, @Body() dto: AddPartnerCommentDto) {
    return this.portal.addComment(partner, id, dto.content);
  }

  @Get('commissions')
  commissions(@CurrentPartner() partner: PartnerAuthUser) {
    return this.portal.commissions(partner);
  }
}
