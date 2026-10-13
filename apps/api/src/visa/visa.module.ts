import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { VisaController } from './visa.controller';
import { VisaService } from './visa.service';

@Module({ imports: [CandidatesModule, ChecklistModule], controllers: [VisaController], providers: [VisaService] })
export class VisaModule {}
