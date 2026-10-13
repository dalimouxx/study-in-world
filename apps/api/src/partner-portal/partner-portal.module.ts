import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PartnerAuthController } from './partner-auth.controller';
import { PartnerAuthService } from './partner-auth.service';
import { PartnerInviteController } from './partner-invite.controller';
import { PartnerPortalController } from './partner-portal.controller';
import { PartnerPortalService } from './partner-portal.service';
import { PartnerJwtStrategy } from './strategies/partner-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [PartnerAuthController, PartnerInviteController, PartnerPortalController],
  providers: [PartnerAuthService, PartnerPortalService, PartnerJwtStrategy],
})
export class PartnerPortalModule {}
