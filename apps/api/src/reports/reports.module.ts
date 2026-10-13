import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({ imports: [CandidatesModule], controllers: [ReportsController], providers: [ReportsService], exports: [ReportsService] })
export class ReportsModule {}
