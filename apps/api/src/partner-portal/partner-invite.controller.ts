import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerAuthService } from './partner-auth.service';
import { CreatePartnerUserDto } from './dto/partner-auth.dto';

/** Côté employé : gestion des comptes du portail partenaire. Jamais @Public — passe par le JwtAuthGuard employé. */
@ApiTags('partners')
@ApiBearerAuth()
@Controller('partners/:partnerId/users')
export class PartnerInviteController {
  constructor(
    private readonly partnerAuth: PartnerAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get() @RequirePermissions('partner.view')
  list(@CurrentUser() user: AuthUser, @Param('partnerId') partnerId: string) {
    return this.prisma.partnerUser.findMany({
      where: { organizationId: user.organizationId, partnerId, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, portalActivatedAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post() @HttpCode(204) @RequirePermissions('partner.manage')
  invite(@CurrentUser() user: AuthUser, @Param('partnerId') partnerId: string, @Body() dto: CreatePartnerUserDto) {
    return this.partnerAuth.createAndInvite(user, partnerId, dto);
  }
}
