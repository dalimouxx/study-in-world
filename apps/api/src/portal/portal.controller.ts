import { Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators';
import { apiError } from '../common/errors/api-error';
import { CurrentCandidate } from './current-candidate.decorator';
import { PortalUploadDocumentDto, UpdatePortalProfileDto } from './dto/portal.dto';
import { CandidateJwtAuthGuard } from './guards/candidate-jwt-auth.guard';
import { PortalService } from './portal.service';
import type { CandidateAuthUser } from '../common/auth-user';
import { SendMessageDto } from '../messages/dto/message.dto';
import { SignContractDto } from '../contracts/dto/contract.dto';

/**
 * @Public() ignore le JwtAuthGuard employé (global) ; @UseGuards(CandidateJwtAuthGuard) applique à la place
 * l'authentification candidat sur l'ensemble des routes de ce contrôleur.
 */
@Public()
@UseGuards(CandidateJwtAuthGuard)
@ApiBearerAuth()
@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('profile')
  profile(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.profile(candidate);
  }

  @Patch('profile')
  updateProfile(@CurrentCandidate() candidate: CandidateAuthUser, @Body() dto: UpdatePortalProfileDto) {
    return this.portal.updateProfile(candidate, dto);
  }

  @Get('documents')
  documents(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.documents(candidate);
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(@CurrentCandidate() candidate: CandidateAuthUser, @Body() dto: PortalUploadDocumentDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw apiError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Aucun fichier reçu');
    return this.portal.uploadDocument(candidate, dto, file);
  }

  @Get('documents/:id/download')
  async download(@CurrentCandidate() candidate: CandidateAuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType, filename } = await this.portal.downloadDocument(candidate, id);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"` });
    res.send(buffer);
  }

  @Get('checklist')
  checklist(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.checklist(candidate);
  }

  @Get('applications')
  applications(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.applications(candidate);
  }

  @Get('visa-files')
  visaFiles(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.visaFiles(candidate);
  }

  @Get('visa-files/:id/checklist')
  visaChecklist(@CurrentCandidate() candidate: CandidateAuthUser, @Param('id') id: string) {
    return this.portal.visaChecklist(candidate, id);
  }

  @Get('quotes')
  quotes(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.quotes(candidate);
  }

  @Get('invoices')
  invoices(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.invoices(candidate);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@CurrentCandidate() candidate: CandidateAuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.portal.invoicePdf(candidate, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` }).send(buffer);
  }

  @Get('appointments')
  appointments(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.appointments(candidate);
  }

  @Get('timeline')
  timeline(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.timeline(candidate);
  }

  @Get('messages')
  messages(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.messagesList(candidate);
  }

  @Post('messages')
  sendMessage(@CurrentCandidate() candidate: CandidateAuthUser, @Body() dto: SendMessageDto) {
    return this.portal.sendMessage(candidate, dto.content);
  }

  @Get('contracts')
  contracts(@CurrentCandidate() candidate: CandidateAuthUser) {
    return this.portal.contracts(candidate);
  }

  @Get('contracts/:id/pdf')
  async contractPdf(@CurrentCandidate() candidate: CandidateAuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.portal.contractPdf(candidate, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` }).send(buffer);
  }

  @Post('contracts/:id/sign')
  async signContract(@CurrentCandidate() candidate: CandidateAuthUser, @Param('id') id: string, @Body() dto: SignContractDto) {
    await this.portal.signContract(candidate, id, dto);
  }
}
