import { Module } from '@nestjs/common';
import { LandingPageAdminController } from './landing-page-admin.controller';
import { LandingPagePublicController } from './landing-page-public.controller';
import { LandingPageService } from './landing-page.service';

@Module({
  controllers: [LandingPageAdminController, LandingPagePublicController],
  providers: [LandingPageService],
})
export class LandingPageModule {}
