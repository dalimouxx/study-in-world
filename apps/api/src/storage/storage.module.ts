import { Global, Module } from '@nestjs/common';
import { PublicFilesController } from './public-files.controller';
import { StorageService } from './storage.service';

@Global()
@Module({ controllers: [PublicFilesController], providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
