import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { PdfService } from '../finance/pdf/pdf.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [CandidatesModule],
  controllers: [ContractsController],
  providers: [ContractsService, PdfService],
  exports: [ContractsService],
})
export class ContractsModule {}
