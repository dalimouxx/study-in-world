import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { AiAssistantService } from '../ai-assistant/ai-assistant.service';
import { CountriesService } from './countries.service';
import { CreateCountryDto, ListCountriesQuery, UpdateCountryDto } from './dto/country.dto';
import { DraftCountryContentDto } from './dto/catalog-ai.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('countries')
export class CountriesController {
  constructor(
    private readonly countries: CountriesService,
    private readonly ai: AiAssistantService,
  ) {}

  @Get() @RequirePermissions('catalog.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListCountriesQuery) {
    return this.countries.list(user, q);
  }

  /** Brouillon IA (Phase « catalogue ») : jamais enregistré directement, juste renvoyé pour relecture dans le formulaire. */
  @Post('ai-draft') @RequirePermissions('catalog.manage')
  draftContent(@Body() dto: DraftCountryContentDto) {
    return this.ai.draftCountryContent(dto.name);
  }

  @Get(':id') @RequirePermissions('catalog.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.countries.get(user, id);
  }

  @Post() @RequirePermissions('catalog.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCountryDto, @ReqMeta() meta: RequestMeta) {
    return this.countries.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('catalog.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCountryDto, @ReqMeta() meta: RequestMeta) {
    return this.countries.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('catalog.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.countries.remove(user, id, meta);
  }
}
