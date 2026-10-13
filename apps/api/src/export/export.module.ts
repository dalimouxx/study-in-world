import { Global, Module } from '@nestjs/common';
import { ExportService } from './export.service';

/** @Global() : réutilisé par plusieurs modules indépendants (candidats, prospects, finance) sans lien entre eux. */
@Global()
@Module({ providers: [ExportService], exports: [ExportService] })
export class ExportModule {}
