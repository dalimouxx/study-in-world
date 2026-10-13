import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { apiError } from '../common/errors/api-error';
import { HttpStatus } from '@nestjs/common';
import { ReviewDocumentDto, UploadDocumentDto } from './dto/document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('candidates/:candidateId/documents') @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.documents.list(user, candidateId);
  }

  @Post('candidates/:candidateId/documents')
  @RequirePermissions('document.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @ReqMeta() meta: RequestMeta,
  ) {
    if (!file) throw apiError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Aucun fichier reçu');
    return this.documents.upload(user, candidateId, dto, file, meta);
  }

  @Get('documents/:id/download') @RequirePermissions('candidate.view')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType, filename } = await this.documents.download(user, id);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"` });
    res.send(buffer);
  }

  @Patch('documents/:id') @RequirePermissions('document.manage')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewDocumentDto, @ReqMeta() meta: RequestMeta) {
    return this.documents.review(user, id, dto, meta);
  }

  /** OCR (section 20) : lecture seule, ne modifie jamais le document — l'employé applique lui-même ce qui lui semble fiable. */
  @Post('documents/:id/extract') @RequirePermissions('document.manage')
  extract(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.extract(user, id);
  }

  @Delete('documents/:id') @HttpCode(204) @RequirePermissions('document.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.documents.remove(user, id, meta);
  }
}
