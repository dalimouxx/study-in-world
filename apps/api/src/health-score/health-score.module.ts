import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { HealthScoreController } from './health-score.controller';
import { HealthScoreService } from './health-score.service';

@Module({ imports: [CandidatesModule], controllers: [HealthScoreController], providers: [HealthScoreService], exports: [HealthScoreService] })
export class HealthScoreModule {}
