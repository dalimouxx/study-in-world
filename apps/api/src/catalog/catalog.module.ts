import { Module } from '@nestjs/common';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { PublicCatalogController } from './public/public-catalog.controller';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
  controllers: [CountriesController, UniversitiesController, ProgramsController, PublicCatalogController],
  providers: [CountriesService, UniversitiesService, ProgramsService],
  exports: [CountriesService, UniversitiesService, ProgramsService],
})
export class CatalogModule {}
