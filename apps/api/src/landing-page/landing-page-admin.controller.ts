import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { apiError } from '../common/errors/api-error';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import {
  CreateLandingFaqItemDto,
  CreateLandingServiceDto,
  CreatePartnerLogoDto,
  CreateTestimonialDto,
  ReorderDto,
  UpdateLandingBrandingDto,
  UpdateLandingContentDto,
  UpdateLandingFaqItemDto,
  UpdateLandingServiceDto,
  UpdatePartnerLogoDto,
  UpdateTestimonialDto,
} from './dto/landing-page.dto';
import { LandingPageService } from './landing-page.service';

/**
 * CMS de la landing page publique — réservé exclusivement au rôle Super Admin (voir SuperAdminGuard),
 * jamais au rôle Administrateur même s'il possède par ailleurs toutes les permissions RBAC.
 */
@ApiTags('landing-page')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('landing-page')
export class LandingPageAdminController {
  constructor(private readonly landingPage: LandingPageService) {}

  @Get()
  getAll(@CurrentUser() user: AuthUser) {
    return this.landingPage.getAdmin(user.organizationId);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw apiError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Aucun fichier reçu');
    return this.landingPage.uploadImage(file);
  }

  @Patch('content')
  updateContent(@CurrentUser() user: AuthUser, @Body() dto: UpdateLandingContentDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updateContent(user, dto, meta);
  }

  @Patch('branding')
  updateBranding(@CurrentUser() user: AuthUser, @Body() dto: UpdateLandingBrandingDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updateBranding(user, dto, meta);
  }

  // ---------- Services ----------

  @Post('services')
  createService(@CurrentUser() user: AuthUser, @Body() dto: CreateLandingServiceDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.createService(user, dto, meta);
  }

  @Patch('services/reorder')
  reorderServices(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.landingPage.reorderServices(user, dto);
  }

  @Patch('services/:id')
  updateService(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLandingServiceDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updateService(user, id, dto, meta);
  }

  @Delete('services/:id') @HttpCode(204)
  removeService(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.removeService(user, id, meta);
  }

  // ---------- FAQ ----------

  @Post('faq')
  createFaqItem(@CurrentUser() user: AuthUser, @Body() dto: CreateLandingFaqItemDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.createFaqItem(user, dto, meta);
  }

  @Patch('faq/reorder')
  reorderFaqItems(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.landingPage.reorderFaqItems(user, dto);
  }

  @Patch('faq/:id')
  updateFaqItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLandingFaqItemDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updateFaqItem(user, id, dto, meta);
  }

  @Delete('faq/:id') @HttpCode(204)
  removeFaqItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.removeFaqItem(user, id, meta);
  }

  // ---------- Témoignages ----------

  @Post('testimonials')
  createTestimonial(@CurrentUser() user: AuthUser, @Body() dto: CreateTestimonialDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.createTestimonial(user, dto, meta);
  }

  @Patch('testimonials/reorder')
  reorderTestimonials(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.landingPage.reorderTestimonials(user, dto);
  }

  @Patch('testimonials/:id')
  updateTestimonial(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTestimonialDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updateTestimonial(user, id, dto, meta);
  }

  @Delete('testimonials/:id') @HttpCode(204)
  removeTestimonial(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.removeTestimonial(user, id, meta);
  }

  // ---------- Logos partenaires ----------

  @Post('partner-logos')
  createPartnerLogo(@CurrentUser() user: AuthUser, @Body() dto: CreatePartnerLogoDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.createPartnerLogo(user, dto, meta);
  }

  @Patch('partner-logos/reorder')
  reorderPartnerLogos(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.landingPage.reorderPartnerLogos(user, dto);
  }

  @Patch('partner-logos/:id')
  updatePartnerLogo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePartnerLogoDto, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.updatePartnerLogo(user, id, dto, meta);
  }

  @Delete('partner-logos/:id') @HttpCode(204)
  removePartnerLogo(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.landingPage.removePartnerLogo(user, id, meta);
  }
}
