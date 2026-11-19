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
import { LABELS, pdfFile, type DocKind, type DocLang } from './pdf/labels';
import { PdfService, type DocumentItem, type DocumentTotals } from './pdf/pdf.service';
import { CreateInvoiceDto, CreateQuoteDto, RecordPaymentDto, UpdateQuoteStatusDto } from './dto/finance.dto';
import { computeTotals, documentTotals, lineVatRate, NO_TAXES, type LineKind, type TaxSettings } from './totals';

const quoteInclude = { items: true } satisfies Prisma.QuoteInclude;
const invoiceInclude = { items: true, payments: true } satisfies Prisma.InvoiceInclude;

/** Un devis ou une facture tel que renvoyé par l'API : avec ses totaux, toujours remplis (voir totals.ts). */
export const withTotals = <T extends Parameters<typeof documentTotals>[0]>(doc: T) => ({ ...doc, ...documentTotals(doc) });

/** Totaux pour le PDF : ceux du document, avec le taux de TVA de ses lignes « service ». */
const pdfTotals = (doc: Parameters<typeof documentTotals>[0]): DocumentTotals => ({
  ...documentTotals(doc),
  vatRate: doc.items.find((l) => l.kind !== 'DISBURSEMENT')?.vatRate ?? 0,
});

/** Lignes et totaux d'un nouveau document, selon les réglages de taxes de l'agence au moment de la création. */
function priced(items: { label: string; quantity: number; unitPrice: number; kind?: LineKind | null }[], s: TaxSettings) {
  const lines = items.map((i) => {
    const kind: LineKind = s.taxesEnabled ? (i.kind ?? 'SERVICE') : 'SERVICE';
    return { label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, kind, vatRate: lineVatRate(kind, s) };
  });
  return { lines, totals: computeTotals(lines, s) };
}

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

  /** Réglages de taxes de l'agence (défauts : désactivées, 19 %, timbre 1,000 TND). */
  async taxSettings(organizationId: string): Promise<TaxSettings> {
    const s = await this.prisma.agencySettings.findUnique({ where: { organizationId } });
    return { taxesEnabled: s?.taxesEnabled ?? false, vatRate: s?.vatRate ?? 19, stampDuty: s?.stampDuty ?? 1 };
  }

  async quotesFor(actor: AuthUser, candidateId: string) {
    const quotes = await this.prisma.quote.findMany({ where: { organizationId: actor.organizationId, candidateId }, include: quoteInclude, orderBy: { createdAt: 'desc' } });
    return quotes.map(withTotals);
  }

  async createQuote(actor: AuthUser, candidateId: string, dto: CreateQuoteDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const number = await this.counter.next(actor.organizationId, 'quote', 'DEV');
    const { lines, totals } = priced(dto.items, await this.taxSettings(actor.organizationId));
    const quote = await this.prisma.quote.create({
      data: {
        organizationId: actor.organizationId,
        candidateId,
        number,
        currency: dto.currency ?? 'TND',
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        notes: dto.notes,
        createdById: actor.id,
        ...totals,
        items: { create: lines },
      },
      include: quoteInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Devis ${number} créé (${totals.total.toFixed(3)} ${quote.currency})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'quote.create', entity: 'Quote', entityId: quote.id, metadata: { candidateId, number }, meta });
    return withTotals(quote);
  }

  async setQuoteStatus(actor: AuthUser, id: string, dto: UpdateQuoteStatusDto, meta: RequestMeta) {
    const quote = await this.findQuote(actor, id);
    const updated = await this.prisma.quote.update({ where: { id }, data: { status: dto.status }, include: quoteInclude });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', quote.candidateId, TimelineType.SYSTEM, `Devis ${quote.number} : ${dto.status}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'quote.status', entity: 'Quote', entityId: id, metadata: { status: dto.status }, meta });
    return withTotals(updated);
  }

  async quotePdf(actor: AuthUser, id: string, lang?: DocLang) {
    const quote = await this.findQuote(actor, id);
    return this.renderPdf(actor.organizationId, 'quote', quote.number, quote.currency, quote.candidateId, quote.items, lang, pdfTotals(quote));
  }

  /** Transforme un devis accepté en facture : copie les lignes, ne modifie pas le devis. */
  async createInvoiceFromQuote(actor: AuthUser, quoteId: string, meta: RequestMeta) {
    const quote = await this.findQuote(actor, quoteId);
    if (quote.status !== 'ACCEPTED') throw apiError(HttpStatus.CONFLICT, 'QUOTE_NOT_ACCEPTED', 'Seul un devis accepté peut être transformé en facture');
    const number = await this.counter.next(actor.organizationId, 'invoice', 'FAC');
    // Devis ancien ou créé sans taxes : on garde le prix accepté, sans TVA ni timbre (décision du propriétaire).
    // Sinon : lignes avec leur type, taux et timbre des Paramètres à la date de la facture.
    // Un devis créé sans taxes (avant la TVA, ou agence alors non assujettie) garde lui aussi son prix accepté : ses
    // lignes n'ont jamais été classées service / débours, les taxer toucherait aussi les débours.
    const { lines, totals } = priced(quote.items, documentTotals(quote).taxed ? await this.taxSettings(actor.organizationId) : NO_TAXES);
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: actor.organizationId,
        candidateId: quote.candidateId,
        quoteId: quote.id,
        number,
        currency: quote.currency,
        createdById: actor.id,
        ...totals,
        items: { create: lines },
        status: 'ISSUED',
      },
      include: invoiceInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', quote.candidateId, TimelineType.SYSTEM, `Facture ${number} créée à partir du devis ${quote.number}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'invoice.create', entity: 'Invoice', entityId: invoice.id, metadata: { fromQuote: quote.number }, meta });
    return withTotals(invoice);
  }

  // ---------- Factures ----------

  async invoicesFor(actor: AuthUser, candidateId: string) {
    const invoices = await this.prisma.invoice.findMany({ where: { organizationId: actor.organizationId, candidateId }, include: invoiceInclude, orderBy: { createdAt: 'desc' } });
    return invoices.map(withTotals);
  }

  async createInvoice(actor: AuthUser, candidateId: string, dto: CreateInvoiceDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const number = await this.counter.next(actor.organizationId, 'invoice', 'FAC');
    const { lines, totals } = priced(dto.items, await this.taxSettings(actor.organizationId));
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
        ...totals,
        items: { create: lines },
      },
      include: invoiceInclude,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Facture ${number} créée (${totals.total.toFixed(3)} ${invoice.currency})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'invoice.create', entity: 'Invoice', entityId: invoice.id, metadata: { candidateId, number }, meta });
    return withTotals(invoice);
  }

  async invoicePdf(actor: AuthUser, id: string, lang?: DocLang) {
    const invoice = await this.findInvoice(actor, id);
    return this.renderPdf(actor.organizationId, 'invoice', invoice.number, invoice.currency, invoice.candidateId, invoice.items, lang, pdfTotals(invoice));
  }

  /**
   * Enregistre un paiement. Les espèces exigent une caisse ouverte pour la branche de l'employé
   * (le mouvement de caisse est créé automatiquement) ; les autres moyens n'y touchent pas.
   */
  async recordPayment(actor: AuthUser, invoiceId: string, dto: RecordPaymentDto, meta: RequestMeta) {
    const invoice = await this.findInvoice(actor, invoiceId);
    if (invoice.status === 'CANCELLED') throw apiError(HttpStatus.CONFLICT, 'INVOICE_CANCELLED', 'Cette facture est annulée');
    const invoiceTotal = documentTotals(invoice).total;
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

  async receiptPdf(actor: AuthUser, paymentId: string, lang?: DocLang) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId: actor.organizationId }, include: { invoice: true } });
    if (!payment) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Paiement introuvable');
    return this.renderPdf(actor.organizationId, 'receipt', payment.receiptNumber, payment.invoice.currency, payment.invoice.candidateId, (l) => [
      { label: LABELS[l].paymentFor(payment.invoice.number), quantity: 1, unitPrice: payment.amount },
    ], lang);
  }

  // ---------- Rendu PDF commun ----------

  private async renderPdf(
    organizationId: string,
    kind: DocKind,
    number: string,
    currency: string,
    candidateId: string,
    items: DocumentItem[] | ((lang: DocLang) => DocumentItem[]),
    requested?: DocLang,
    totals?: DocumentTotals,
  ) {
    const [candidate, settings] = await Promise.all([
      this.prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } }),
      this.prisma.agencySettings.findUnique({ where: { organizationId } }),
    ]);
    // Langue demandée (?lang), sinon la langue préférée du candidat.
    const lang: DocLang = requested ?? candidate.preferredLanguage ?? 'fr';
    const buffer = await this.pdf.document(
      {
        kind,
        number,
        date: new Date(),
        currency,
        lang,
        agency: {
          name: settings?.name ?? 'Study in World',
          nameAr: settings?.nameAr,
          address: settings?.address,
          addressAr: settings?.addressAr,
          phone: settings?.phone,
          email: settings?.email,
          taxId: settings?.taxId,
        },
        candidate: { firstName: candidate.firstName, lastName: candidate.lastName, phone: candidate.phone, email: candidate.email },
      },
      typeof items === 'function' ? items(lang) : items,
      totals,
    );
    return { buffer, ...pdfFile(kind, lang, number) };
  }

  /** Portail candidat : le candidat ne peut télécharger que sa propre facture. */
  async invoicePdfForCandidate(organizationId: string, candidateId: string, invoiceId: string, lang?: DocLang) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId, candidateId }, include: invoiceInclude });
    if (!invoice) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Facture introuvable');
    return this.renderPdf(organizationId, 'invoice', invoice.number, invoice.currency, invoice.candidateId, invoice.items, lang, pdfTotals(invoice));
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
