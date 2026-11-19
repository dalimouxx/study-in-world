import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateInvoiceDto, CreateQuoteDto, RecordPaymentDto, UpdateQuoteStatusDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';
import { PdfLangQueryDto } from './dto/pdf-lang.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // ----- Devis -----
  @Get('candidates/:candidateId/quotes') @RequirePermissions('finance.view')
  quotes(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.finance.quotesFor(user, candidateId);
  }

  @Post('candidates/:candidateId/quotes') @RequirePermissions('finance.manage')
  createQuote(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateQuoteDto, @ReqMeta() meta: RequestMeta) {
    return this.finance.createQuote(user, candidateId, dto, meta);
  }

  @Post('quotes/:id/status') @RequirePermissions('finance.manage')
  setQuoteStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateQuoteStatusDto, @ReqMeta() meta: RequestMeta) {
    return this.finance.setQuoteStatus(user, id, dto, meta);
  }

  @Post('quotes/:id/to-invoice') @RequirePermissions('finance.manage')
  toInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.finance.createInvoiceFromQuote(user, id, meta);
  }

  @Get('quotes/:id/pdf') @RequirePermissions('finance.view')
  async quotePdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: PdfLangQueryDto, @Res() res: Response) {
    const { buffer, disposition } = await this.finance.quotePdf(user, id, q.lang);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': disposition }).send(buffer);
  }

  // ----- Factures -----
  @Get('candidates/:candidateId/invoices') @RequirePermissions('finance.view')
  invoices(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.finance.invoicesFor(user, candidateId);
  }

  @Post('candidates/:candidateId/invoices') @RequirePermissions('finance.manage')
  createInvoice(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateInvoiceDto, @ReqMeta() meta: RequestMeta) {
    return this.finance.createInvoice(user, candidateId, dto, meta);
  }

  @Get('invoices/:id/pdf') @RequirePermissions('finance.view')
  async invoicePdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: PdfLangQueryDto, @Res() res: Response) {
    const { buffer, disposition } = await this.finance.invoicePdf(user, id, q.lang);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': disposition }).send(buffer);
  }

  @Post('invoices/:id/payments') @RequirePermissions('finance.manage')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordPaymentDto, @ReqMeta() meta: RequestMeta) {
    return this.finance.recordPayment(user, id, dto, meta);
  }

  @Get('payments/:id/receipt') @RequirePermissions('finance.view')
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: PdfLangQueryDto, @Res() res: Response) {
    const { buffer, disposition } = await this.finance.receiptPdf(user, id, q.lang);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': disposition }).send(buffer);
  }
}
