'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, FileText, Plus, Receipt, Trash, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { api, apiBaseUrl, getAccessToken } from '@/lib/api';
import type { CandidateProfitability, Commission, CommissionStatus, Contract, ContractStatus, Expense, Invoice, LineItem, PaymentMethod, Quote, QuoteStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';
import { SignContractDialog } from '@/features/shared/sign-contract-dialog';

const QUOTE_TONE: Record<QuoteStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { DRAFT: 'neutral', SENT: 'primary', ACCEPTED: 'success', REJECTED: 'danger', EXPIRED: 'neutral' };
const INVOICE_TONE = { DRAFT: 'neutral', ISSUED: 'primary', PARTIALLY_PAID: 'primary', PAID: 'success', CANCELLED: 'danger' } as const;
const CONTRACT_TONE: Record<ContractStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { DRAFT: 'neutral', SENT: 'primary', SIGNED: 'success', CANCELLED: 'danger' };
const COMMISSION_TONE: Record<CommissionStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { TO_CONFIRM: 'neutral', EXPECTED: 'primary', INVOICED: 'primary', PARTIALLY_RECEIVED: 'primary', RECEIVED: 'success', CANCELLED: 'danger' };

function CommissionsSection({ candidateId, hasPartner }: { candidateId: string; hasPartner: boolean }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<{ amount: number; notes: string }>();

  const commissions = useQuery({ queryKey: ['candidates', candidateId, 'commissions'], queryFn: () => api<Commission[]>(`/candidates/${candidateId}/commissions`) });

  const create = useMutation({
    mutationFn: (v: { amount: number; notes: string }) => api(`/candidates/${candidateId}/commissions`, { method: 'POST', body: { amount: v.amount, notes: v.notes || undefined } }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'commissions'] }); setFormOpen(false); toast.success(t('commissionCreated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommissionStatus }) => api(`/commissions/${id}/status`, { method: 'POST', body: { status } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'commissions'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!hasPartner) return null;
  const STATUSES: CommissionStatus[] = ['TO_CONFIRM', 'EXPECTED', 'INVOICED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('commissions')}</h3>
        {can('finance.manage') && <Button size="sm" variant="secondary" onClick={() => { reset({ amount: 0, notes: '' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('newCommission')}</Button>}
      </div>
      {!commissions.data?.length ? (
        <EmptyState title={t('emptyCommissions')} />
      ) : (
        <div className="space-y-2">
          {commissions.data.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-sm">{c.amount.toFixed(3)} {c.currency}{c.notes ? ` — ${c.notes}` : ''}</span>
              {can('finance.manage') ? (
                <Select className="w-auto" aria-label={t('status')} value={c.status} onChange={(e) => setStatus.mutate({ id: c.id, status: e.target.value as CommissionStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`commissionStatuses.${s}`)}</option>)}
                </Select>
              ) : (
                <Badge tone={COMMISSION_TONE[c.status]}>{t(`commissionStatuses.${c.status}`)}</Badge>
              )}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('newCommission')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('amount')} htmlFor="com-amount"><Input id="com-amount" type="number" step={0.001} dir="ltr" {...register('amount', { valueAsNumber: true, required: true, min: 0 })} /></Field>
          <Field label={t('notes')} htmlFor="com-notes"><Input id="com-notes" {...register('notes')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE'];

const total = (items: LineItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const fmt = (n: number, currency: string) => `${n.toFixed(3)} ${currency}`;

function openPdf(path: string) {
  const token = getAccessToken();
  fetch(`${apiBaseUrl}${path}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
    .then((r) => r.blob())
    .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
}

interface ItemForm { label: string; quantity: number; unitPrice: number }

function ItemsFormDialog({
  open, onOpenChange, title, onSubmit, loading,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onSubmit: (items: ItemForm[]) => void; loading: boolean }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const { register, control, handleSubmit, reset } = useForm<{ items: ItemForm[] }>({ defaultValues: { items: [{ label: '', quantity: 1, unitPrice: 0 }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) reset({ items: [{ label: '', quantity: 1, unitPrice: 0 }] }); }} title={title}>
      <form onSubmit={handleSubmit((v) => onSubmit(v.items))} noValidate className="space-y-4">
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-end gap-2">
              <Input className="flex-1" placeholder={t('itemLabel')} {...register(`items.${i}.label`, { required: true })} />
              <Input type="number" min={1} step={1} className="w-20" aria-label={t('quantity')} {...register(`items.${i}.quantity`, { valueAsNumber: true, min: 1 })} />
              <Input type="number" min={0} step={0.001} className="w-32" aria-label={t('unitPrice')} {...register(`items.${i}.unitPrice`, { valueAsNumber: true, min: 0 })} />
              <Button type="button" variant="ghost" size="icon" aria-label={tc('delete')} disabled={fields.length <= 1} onClick={() => remove(i)}>
                <Trash className="h-4 w-4 text-destructive" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => append({ label: '', quantity: 1, unitPrice: 0 })}>{t('addLine')}</Button>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={loading}>{tc('create')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function CreateContractDialog({
  open, onOpenChange, quotes, onSubmit, loading,
}: { open: boolean; onOpenChange: (o: boolean) => void; quotes: Quote[]; onSubmit: (quoteId: string) => void; loading: boolean }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const [quoteId, setQuoteId] = useState('');
  const eligible = quotes.filter((q) => q.status === 'ACCEPTED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('newContract')} description={t('newContractHint')}>
      <div className="space-y-4">
        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noAcceptedQuote')}</p>
        ) : (
          <Field label={t('basedOnQuote')} htmlFor="ctr-quote">
            <Select id="ctr-quote" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
              <option value="">—</option>
              {eligible.map((q) => <option key={q.id} value={q.id}>{q.number} — {fmt(total(q.items), q.currency)}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button disabled={!quoteId} loading={loading} onClick={() => onSubmit(quoteId)}>{tc('create')}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ProfitabilitySection({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<{ category: string; amount: number; description: string }>();

  const profitability = useQuery({ queryKey: ['candidates', candidateId, 'profitability'], queryFn: () => api<CandidateProfitability>(`/candidates/${candidateId}/profitability`) });
  const expenses = useQuery({ queryKey: ['candidates', candidateId, 'expenses'], queryFn: () => api<Expense[]>('/expenses', { query: { candidateId } }) });

  const addExpense = useMutation({
    mutationFn: (v: { category: string; amount: number; description: string }) => api('/expenses', { method: 'POST', body: { ...v, candidateId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'profitability'] });
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'expenses'] });
      setFormOpen(false);
      toast.success(t('expenseAttributed'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (profitability.isLoading || !profitability.data) return null;
  const p = profitability.data;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('profitability')}</h3>
        {can('expense.manage') && <Button size="sm" variant="secondary" onClick={() => { reset({ category: '', amount: 0, description: '' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('attributeExpense')}</Button>}
      </div>
      <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">{t('revenue')}</p><p className="text-lg font-semibold tabular-nums">{p.revenue.toFixed(3)}</p></div>
        <div><p className="text-xs text-muted-foreground">{t('attributedExpenses')}</p><p className="text-lg font-semibold tabular-nums">{p.expenses.toFixed(3)}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">{t('margin')}</p>
          <p className={`text-lg font-semibold tabular-nums ${p.margin >= 0 ? 'text-success' : 'text-destructive'}`}>{p.margin.toFixed(3)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-lg font-semibold tabular-nums">{p.marginPercent.toFixed(0)}%</span>
        </div>
      </Card>
      {expenses.data && expenses.data.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {expenses.data.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>{e.category} — {e.description}</span>
              <span className="tabular-nums">{e.amount.toFixed(3)}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('attributeExpense')} description={t('attributeExpenseHint')}>
        <form onSubmit={handleSubmit((v) => addExpense.mutate(v))} noValidate className="space-y-4">
          <Field label={t('category')} htmlFor="exp-cat"><Input id="exp-cat" {...register('category', { required: true })} /></Field>
          <Field label={t('amount')} htmlFor="exp-amount"><Input id="exp-amount" type="number" step={0.001} dir="ltr" {...register('amount', { valueAsNumber: true, required: true, min: 0.001 })} /></Field>
          <Field label={t('description')} htmlFor="exp-desc"><Input id="exp-desc" {...register('description', { required: true })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={addExpense.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

export function FinanceTab({ candidateId, hasPartner }: { candidateId: string; hasPartner: boolean }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'quotes'] });
    void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'contracts'] });
  };

  const quotes = useQuery({ queryKey: ['candidates', candidateId, 'quotes'], queryFn: () => api<Quote[]>(`/candidates/${candidateId}/quotes`) });
  const invoices = useQuery({ queryKey: ['candidates', candidateId, 'invoices'], queryFn: () => api<Invoice[]>(`/candidates/${candidateId}/invoices`) });
  const contracts = useQuery({ queryKey: ['candidates', candidateId, 'contracts'], queryFn: () => api<Contract[]>(`/candidates/${candidateId}/contracts`) });

  const createQuote = useMutation({
    mutationFn: (items: ItemForm[]) => api(`/candidates/${candidateId}/quotes`, { method: 'POST', body: { items } }),
    onSuccess: () => { invalidate(); setQuoteFormOpen(false); toast.success(t('quoteCreated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const createInvoice = useMutation({
    mutationFn: (items: ItemForm[]) => api(`/candidates/${candidateId}/invoices`, { method: 'POST', body: { items } }),
    onSuccess: () => { invalidate(); setInvoiceFormOpen(false); toast.success(t('invoiceCreated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setQuoteStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/quotes/${id}/status`, { method: 'POST', body: { status } }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const toInvoice = useMutation({
    mutationFn: (id: string) => api(`/quotes/${id}/to-invoice`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success(t('invoiceCreated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const pay = useMutation({
    mutationFn: (v: { amount: number; method: PaymentMethod }) => api(`/invoices/${payingInvoice!.id}/payments`, { method: 'POST', body: v }),
    onSuccess: () => { invalidate(); setPayingInvoice(null); toast.success(t('paymentRecorded')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const createContract = useMutation({
    mutationFn: (quoteId: string) => api(`/candidates/${candidateId}/contracts`, { method: 'POST', body: { quoteId } }),
    onSuccess: () => { invalidate(); setContractFormOpen(false); toast.success(t('contractCreated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setContractStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'SENT' | 'CANCELLED' }) => api(`/contracts/${id}/status`, { method: 'POST', body: { status } }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const signContract = useMutation({
    mutationFn: (v: { signatureImage: string; signerName: string; method: 'DRAWN' }) => api(`/candidates/${candidateId}/contracts/${signingContract!.id}/sign`, { method: 'POST', body: v }),
    onSuccess: () => { invalidate(); setSigningContract(null); toast.success(t('contractSigned')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('quotes')}</h3>
          {can('finance.manage') && <Button size="sm" onClick={() => setQuoteFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('newQuote')}</Button>}
        </div>
        {quotes.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : !quotes.data?.length ? (
          <EmptyState title={t('emptyQuotes')} />
        ) : (
          <div className="space-y-2">
            {quotes.data.map((q) => (
              <Card key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{q.number}</p>
                  <p className="text-sm text-muted-foreground">{fmt(total(q.items), q.currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={QUOTE_TONE[q.status]}>{t(`quoteStatuses.${q.status}`)}</Badge>
                  <Button variant="ghost" size="icon" aria-label={tc('download')} onClick={() => openPdf(`/quotes/${q.id}/pdf`)}>
                    <FileText className="h-4 w-4" aria-hidden />
                  </Button>
                  {can('finance.manage') && q.status === 'DRAFT' && (
                    <Button size="sm" variant="secondary" onClick={() => setQuoteStatus.mutate({ id: q.id, status: 'SENT' })}>{t('markSent')}</Button>
                  )}
                  {can('finance.manage') && q.status === 'SENT' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setQuoteStatus.mutate({ id: q.id, status: 'ACCEPTED' })}>{t('markAccepted')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setQuoteStatus.mutate({ id: q.id, status: 'REJECTED' })}>{t('markRejected')}</Button>
                    </>
                  )}
                  {can('finance.manage') && q.status === 'ACCEPTED' && (
                    <Button size="sm" loading={toInvoice.isPending} onClick={() => toInvoice.mutate(q.id)}>{t('toInvoice')}</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('contracts')}</h3>
          {can('finance.manage') && <Button size="sm" onClick={() => setContractFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('newContract')}</Button>}
        </div>
        {contracts.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : !contracts.data?.length ? (
          <EmptyState title={t('emptyContracts')} />
        ) : (
          <div className="space-y-2">
            {contracts.data.map((ctr) => (
              <Card key={ctr.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{ctr.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmt(ctr.totalAmount, ctr.currency)}
                    {ctr.signedAt && <> · {t('signedBy', { name: ctr.signerName ?? '' })}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={CONTRACT_TONE[ctr.status]}>{t(`contractStatuses.${ctr.status}`)}</Badge>
                  <Button variant="ghost" size="icon" aria-label={tc('download')} onClick={() => openPdf(`/contracts/${ctr.id}/pdf`)}>
                    <FileText className="h-4 w-4" aria-hidden />
                  </Button>
                  {can('finance.manage') && ctr.status === 'DRAFT' && (
                    <Button size="sm" variant="secondary" onClick={() => setContractStatus.mutate({ id: ctr.id, status: 'SENT' })}>{t('markSent')}</Button>
                  )}
                  {can('finance.manage') && (ctr.status === 'DRAFT' || ctr.status === 'SENT') && (
                    <>
                      <Button size="sm" onClick={() => setSigningContract(ctr)}><FileSignature className="h-4 w-4" aria-hidden />{t('signContract')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setContractStatus.mutate({ id: ctr.id, status: 'CANCELLED' })}>{t('cancelContract')}</Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('invoices')}</h3>
          {can('finance.manage') && <Button size="sm" onClick={() => setInvoiceFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('newInvoice')}</Button>}
        </div>
        {invoices.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : !invoices.data?.length ? (
          <EmptyState title={t('emptyInvoices')} />
        ) : (
          <div className="space-y-2">
            {invoices.data.map((inv) => {
              const invTotal = total(inv.items);
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              return (
                <Card key={inv.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{inv.number}</p>
                      <p className="text-sm text-muted-foreground">{fmt(paid, inv.currency)} / {fmt(invTotal, inv.currency)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={INVOICE_TONE[inv.status]}>{t(`invoiceStatuses.${inv.status}`)}</Badge>
                      <Button variant="ghost" size="icon" aria-label={tc('download')} onClick={() => openPdf(`/invoices/${inv.id}/pdf`)}>
                        <FileText className="h-4 w-4" aria-hidden />
                      </Button>
                      {can('finance.manage') && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                        <Button size="sm" onClick={() => setPayingInvoice(inv)}>{t('recordPayment')}</Button>
                      )}
                    </div>
                  </div>
                  {inv.payments.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                      {inv.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between">
                          <span>{t(`paymentMethods.${p.method}`)} · {fmt(p.amount, inv.currency)}</span>
                          <Button variant="ghost" size="icon" aria-label={t('receipt')} onClick={() => openPdf(`/payments/${p.id}/receipt`)}>
                            <Receipt className="h-4 w-4" aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ProfitabilitySection candidateId={candidateId} />

      <CommissionsSection candidateId={candidateId} hasPartner={hasPartner} />

      <ItemsFormDialog open={quoteFormOpen} onOpenChange={setQuoteFormOpen} title={t('newQuote')} onSubmit={(items) => createQuote.mutate(items)} loading={createQuote.isPending} />
      <ItemsFormDialog open={invoiceFormOpen} onOpenChange={setInvoiceFormOpen} title={t('newInvoice')} onSubmit={(items) => createInvoice.mutate(items)} loading={createInvoice.isPending} />
      <CreateContractDialog open={contractFormOpen} onOpenChange={setContractFormOpen} quotes={quotes.data ?? []} onSubmit={(quoteId) => createContract.mutate(quoteId)} loading={createContract.isPending} />
      <SignContractDialog contract={signingContract} open={!!signingContract} onOpenChange={(o) => !o && setSigningContract(null)} onSign={(v) => signContract.mutate(v)} loading={signContract.isPending} />

      <Dialog open={!!payingInvoice} onOpenChange={(o) => !o && setPayingInvoice(null)} title={t('recordPayment')}>
        {payingInvoice && <PaymentForm invoice={payingInvoice} onSubmit={(v) => pay.mutate(v)} loading={pay.isPending} onCancel={() => setPayingInvoice(null)} />}
      </Dialog>
    </div>
  );
}

function PaymentForm({ invoice, onSubmit, loading, onCancel }: { invoice: Invoice; onSubmit: (v: { amount: number; method: PaymentMethod }) => void; loading: boolean; onCancel: () => void }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const remaining = total(invoice.items) - invoice.payments.reduce((s, p) => s + p.amount, 0);
  const { register, handleSubmit, formState: { errors } } = useForm<{ amount: number; method: PaymentMethod }>({ defaultValues: { amount: remaining, method: 'CASH' } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('remainingBalance')} : {fmt(remaining, invoice.currency)}</p>
      <Field label={t('amount')} htmlFor="pay-amount" error={errors.amount?.message}>
        <Input id="pay-amount" type="number" step={0.001} dir="ltr" aria-invalid={!!errors.amount} {...register('amount', { valueAsNumber: true, required: true, min: { value: 0.001, message: tc('required') } })} />
      </Field>
      <Field label={t('method')} htmlFor="pay-method">
        <Select id="pay-method" {...register('method')}>
          {METHODS.map((m) => <option key={m} value={m}>{t(`paymentMethods.${m}`)}</option>)}
        </Select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>{tc('cancel')}</Button>
        <Button type="submit" loading={loading}>{tc('save')}</Button>
      </div>
    </form>
  );
}
