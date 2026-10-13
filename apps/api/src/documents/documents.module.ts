import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { OcrModule } from '../ocr/ocr.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({ imports: [CandidatesModule, OcrModule], controllers: [DocumentsController], providers: [DocumentsService] })
export class DocumentsModule {}
