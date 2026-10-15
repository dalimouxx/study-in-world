import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { AiAssistantService } from '../ai-assistant/ai-assistant.service';
import { DraftUniversityContentDto } from './dto/catalog-ai.dto';
import { CreateUniversityDto, ListUniversitiesQuery, UpdateUniversityDto } from './dto/university.dto';
import { UniversitiesService } from './universities.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('universities')
export class UniversitiesController {
  constructor(
    private readonly universities: UniversitiesService,
    private readonly ai: AiAssistantService,
  ) {}

  @Get() @RequirePermissions('catalog.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListUniversitiesQuery) {
    return this.universities.list(user, q);
  }

  /** Brouillon IA : jamais enregistré directement, juste renvoyé pour relecture dans le formulaire. */
  @Post('ai-draft') @RequirePermissions('catalog.manage')
  draftContent(@Body() dto: DraftUniversityContentDto) {
    return this.ai.draftUniversityContent(dto.name, dto.city, dto.countryName);
  }

  @Get(':id') @RequirePermissions('catalog.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.universities.get(user, id);
  }

  @Post() @RequirePermissions('catalog.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUniversityDto, @ReqMeta() meta: RequestMeta) {
    return this.universities.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('catalog.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUniversityDto, @ReqMeta() meta: RequestMeta) {
    return this.universities.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('catalog.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.universities.remove(user, id, meta);
  }
}
