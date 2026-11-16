import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { RenderQueryDto, UpdateMessageTemplateDto } from './dto/message-template.dto';
import { MessageTemplatesService } from './message-templates.service';

@ApiBearerAuth()
@ApiTags('message-templates')
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly templates: MessageTemplatesService) {}

  /** Texte rempli pour un dossier : permission vérifiée dans le service (candidats OU prospects). */
  @Get('render')
  render(@CurrentUser() user: AuthUser, @Query() q: RenderQueryDto) {
    return this.templates.renderForEntity(user, q.key, q.channel, q.entityType, q.entityId);
  }

  /** Liste des modèles WhatsApp utilisables depuis un dossier (noms seulement) : candidats OU prospects. */
  @Get('whatsapp')
  async whatsapp(@CurrentUser() user: AuthUser) {
    const all = await this.templates.list(user);
    return all.filter((t) => t.channel === 'WHATSAPP').map((t) => ({ key: t.key, nameFr: t.nameFr, nameAr: t.nameAr, isSystem: t.isSystem }));
  }

  @Get() @RequirePermissions('settings.view')
  list(@CurrentUser() user: AuthUser) {
    return this.templates.list(user);
  }

  @Patch(':id') @RequirePermissions('settings.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMessageTemplateDto, @ReqMeta() meta: RequestMeta) {
    return this.templates.update(user, id, dto, meta);
  }

  @Post(':id/reset') @RequirePermissions('settings.manage')
  reset(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.reset(user, id, meta);
  }
}
