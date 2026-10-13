import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ContractsModule } from '../contracts/contracts.module';
import { FinanceModule } from '../finance/finance.module';
import { MessagesModule } from '../messages/messages.module';
import { CandidateAuthController } from './candidate-auth.controller';
import { CandidateAuthService } from './candidate-auth.service';
import { CandidateInviteController } from './candidate-invite.controller';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { CandidateJwtStrategy } from './strategies/candidate-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), FinanceModule, MessagesModule, ContractsModule],
  controllers: [CandidateAuthController, CandidateInviteController, PortalController],
  providers: [CandidateAuthService, PortalService, CandidateJwtStrategy],
  exports: [CandidateAuthService],
})
export class PortalModule {}
