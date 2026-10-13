import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';

@Module({ imports: [CandidatesModule], controllers: [CommissionsController], providers: [CommissionsService] })
export class CommissionsModule {}
