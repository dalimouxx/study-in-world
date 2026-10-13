import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({ imports: [CandidatesModule, CatalogModule], controllers: [ApplicationsController], providers: [ApplicationsService] })
export class ApplicationsModule {}
