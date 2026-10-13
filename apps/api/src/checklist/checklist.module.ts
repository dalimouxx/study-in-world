import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';

@Module({ imports: [CandidatesModule], controllers: [ChecklistController], providers: [ChecklistService], exports: [ChecklistService] })
export class ChecklistModule {}
