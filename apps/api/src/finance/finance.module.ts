import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { CashboxModule } from '../cashbox/cashbox.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PdfService } from './pdf/pdf.service';

@Module({ imports: [CandidatesModule, CashboxModule], controllers: [FinanceController], providers: [FinanceService, PdfService], exports: [FinanceService] })
export class FinanceModule {}
