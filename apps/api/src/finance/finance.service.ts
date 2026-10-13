import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { CounterService } from '../common/services/counter.service';
import { CashboxService } from '../cashbox/cashbox.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { PdfService } from './pdf/pdf.service';
import { CreateInvoiceDto, CreateQuoteDto, RecordPaymentDto, UpdateQuoteStatusDto } from './dto/finance.dto';

const quoteInclude = { items: true } satisfies Prisma.QuoteInclude;
const invoiceInclude = { items: true, payments: true } satisfies Prisma.InvoiceInclude;

const total = (items: { quantity: number; unitPrice: number }[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly counter: CounterService,
    private readonly cashbox: CashboxService,
    private readonly pdf: PdfService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  // ---------- Devis ----------

  quotesFor(actor: AuthUser, candidateId: string) {
    return this.prisma.quote.findMany({ where: { organizationId: actor.organizationId, candidateId }, include: quoteInclude, orderBy: { createdAt: 'desc' } });
  }

  async createQuote(actor: AuthUser, candidateId: string, dto: CreateQuoteDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const number = await this.counter.next(actor.organizationId, 'quote', 'DEV');
    const quote = await this.prisma.quote.create({
      data: {
        organizationId: actor.organizationId,
        candidateId,
        number,
        currency: dto.currency ?? 'TND',
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        notes: dto.notes,
        createdById: actor.id,
        items: { create: dto.items },
      },
      include: quoteInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Devis ${number} créé (${total(dto.items).toFixed(3)} ${quote.currency})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'quote.create', entity: 'Quote', entityId: quote.id, metadata: { candidateId, number }, meta });
    return quote;
  }

  async setQuoteStatus(actor: AuthUser, id: string, dto: UpdateQuoteStatusDto, meta: RequestMeta) {
    const quote = await this.findQuote(actor, id);
    const updated = await this.prisma.quote.update({ where: { id }, data: { status: dto.status }, include: quoteInclude });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', quote.candidateId, TimelineType.SYSTEM, `Devis ${quote.number} : ${dto.status}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'quote.status', entity: 'Quote', entityId: id, metadata: { status: dto.status }, meta });
    return updated;
  }

  async quotePdf(actor: AuthUser, id: string) {
    const quote = await this.findQuote(actor, id);
    return this.renderPdf(actor.organizationId, 'Devis', quote.number, quote.currency, quote.candidateId, quote.items);
  }

  /** Transforme un devis accepté en facture : copie les lignes, ne modifie pas le devis. */
  async createInvoiceFromQuote(actor: AuthUser, quoteId: string, meta: RequestMeta) {
    const quote = await this.findQuote(actor, quoteId);
    if (quote.status !== 'ACCEPTED') throw apiError(HttpStatus.CONFLICT, 'QUOTE_NOT_ACCEPTED', 'Seul un devis accepté peut être transformé en facture');
    const number = await this.counter.next(actor.organizationId, 'invoice', 'FAC');
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: actor.organizationId,
        candidateId: quote.candidateId,
        quoteId: quote.id,
        number,
        currency: quote.currency,
        createdById: actor.id,
        items: { create: quote.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice })) },
        status: 'ISSUED',
      },
      include: invoiceInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', quote.candidateId, TimelineType.SYSTEM, `Facture ${number} créée à partir du devis ${quote.number}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'invoice.create', entity: 'Invoice', entityId: invoice.id, metadata: { fromQuote: quote.number }, meta });
    return invoice;
  }

  // ---------- Factures ----------

  invoicesFor(actor: AuthUser, candidateId: string) {
    return this.prisma.invoice.findMany({ where: { organizationId: actor.organizationId, candidateId }, include: invoiceInclude, orderBy: { createdAt: 'desc' } });
  }

  async createInvoice(actor: AuthUser, candidateId: string, dto: CreateInvoiceDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const number = await this.counter.next(actor.organizationId, 'invoice', 'FAC');
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: actor.organizationId,
        candidateId,
        number,
        currency: dto.currency ?? 'TND',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        createdById: actor.id,
        status: 'ISSUED',
        items: { create: dto.items },
      },
      include: invoiceInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Facture ${number} créée (${total(dto.items).toFixed(3)} ${invoice.currency})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'invoice.create', entity: 'Invoice', entityId: invoice.id, metadata: { candidateId, number }, meta });
    return invoice;
  }

  async invoicePdf(actor: AuthUser, id: string) {
    const invoice = await this.findInvoice(actor, id);
    return this.renderPdf(actor.organizationId, 'Facture', invoice.number, invoice.currency, invoice.candidateId, invoice.items);
  }

  /**
   * Enregistre un paiement. Les espèces exigent une caisse ouverte pour la branche de l'employé
   * (le mouvement de caisse est créé automatiquement) ; les autres moyens n'y touchent pas.
   */
  async recordPayment(actor: AuthUser, invoiceId: string, dto: RecordPaymentDto, meta: RequestMeta) {
    const invoice = await this.findInvoice(actor, invoiceId);
    if (invoice.status === 'CANCELLED') throw apiError(HttpStatus.CONFLICT, 'INVOICE_CANCELLED', 'Cette facture est annulée');
    const invoiceTotal = total(invoice.items);
    const alreadyPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = invoiceTotal - alreadyPaid;
    if (dto.amount > remaining + 0.001) {
      throw apiError(HttpStatus.BAD_REQUEST, 'PAYMENT_EXCEEDS_BALANCE', `Le montant dépasse le solde restant (${remaining.toFixed(3)} ${invoice.currency})`);
    }
    const receiptNumber = await this.counter.next(actor.organizationId, 'receipt', 'REC');

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: actor.organizationId,
        invoiceId,
        amount: dto.amount,
        method: dto.method,
        receiptNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        createdById: actor.id,
      },
    });

    if (dto.method === 'CASH') {
      const branchId = actor.branchId;
      if (!branchId) throw apiError(HttpStatus.BAD_REQUEST, 'BRANCH_REQUIRED', 'Une branche est nécessaire pour encaisser en espèces');
      await this.cashbox.addMovement(actor.organizationId, branchId, 'IN', dto.amount, `Paiement facture ${invoice.number}`, { paymentId: payment.id }, actor.id);
    }

    const newPaid = alreadyPaid + dto.amount;
    const status = newPaid >= invoiceTotal - 0.001 ? 'PAID' : 'PARTIALLY_PAID';
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status } });

    await this.timeline.add(actor.organizationId, 'CANDIDATE', invoice.candidateId, TimelineType.SYSTEM, `Paiement de ${dto.amount.toFixed(3)} ${invoice.currency} reçu (facture ${invoice.number}, reçu ${receiptNumber})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'payment.create', entity: 'Payment', entityId: payment.id, metadata: { invoiceId, amount: dto.amount, method: dto.method }, meta });
    return payment;
  }

  async receiptPdf(actor: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId: actor.organizationId }, include: { invoice: true } });
    if (!payment) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Paiement introuvable');
    return this.renderPdf(actor.organizationId, 'Reçu', payment.receiptNumber, payment.invoice.currency, payment.invoice.candidateId, [
      { label: `Paiement — facture ${payment.invoice.number}`, quantity: 1, unitPrice: payment.amount },
    ]);
  }

  // ---------- Rendu PDF commun ----------

  private async renderPdf(
    organizationId: string,
    kind: 'Devis' | 'Facture' | 'Reçu',
    number: string,
    currency: string,
    candidateId: string,
    items: { label: string; quantity: number; unitPrice: number }[],
  ) {
    const [candidate, settings] = await Promise.all([
      this.prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } }),
      this.prisma.agencySettings.findUnique({ where: { organizationId } }),
    ]);
    const buffer = await this.pdf.document(
      {
        kind,
        number,
        date: new Date(),
        currency,
        agency: {
          name: settings?.name ?? 'Study in World',
          address: settings?.address,
          phone: settings?.phone,
          email: settings?.email,
          taxId: settings?.taxId,
        },
        candidate: { firstName: candidate.firstName, lastName: candidate.lastName, phone: candidate.phone, email: candidate.email },
      },
      items,
    );
    return { buffer, filename: `${number}.pdf` };
  }

  /** Portail candidat : le candidat ne peut télécharger que sa propre facture. */
  async invoicePdfForCandidate(organizationId: string, candidateId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId, candidateId }, include: invoiceInclude });
    if (!invoice) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Facture introuvable');
    return this.renderPdf(organizationId, 'Facture', invoice.number, invoice.currency, invoice.candidateId, invoice.items);
  }

  private async findQuote(actor: AuthUser, id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, organizationId: actor.organizationId }, include: quoteInclude });
    if (!quote) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Devis introuvable');
    return quote;
  }

  private async findInvoice(actor: AuthUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, organizationId: actor.organizationId }, include: invoiceInclude });
    if (!invoice) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Facture introuvable');
    return invoice;
  }
}
