'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { PlatformInvoice, PlatformInvoiceStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';

const TONE: Record<PlatformInvoiceStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  PENDING: 'primary', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'neutral',
};

interface FormValues { amount: number; periodStart: string; periodEnd: string; dueDate: string; notes: string }

/** Facturation manuelle du SaaS (décision explicite : aucun prestataire de paiement pour l'instant). */
export function PlatformInvoicesDialog({ organizationId, organizationName, open, onOpenChange }: {
  organizationId: string | null; organizationName: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('platformAdmin');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const invoices = useQuery({
    queryKey: ['platform-admin', 'invoices', organizationId],
    queryFn: () => api<PlatformInvoice[]>(`/platform-admin/organizations/${organizationId}/invoices`),
    enabled: !!organizationId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform-admin', 'invoices', organizationId] });

  const create = useMutation({
    mutationFn: (v: FormValues) => api(`/platform-admin/organizations/${organizationId}/invoices`, { method: 'POST', body: { ...v, notes: v.notes || undefined } }),
    onSuccess: () => { reset({ amount: 0, periodStart: '', periodEnd: '', dueDate: '', notes: '' }); void invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlatformInvoiceStatus }) =>
      api(`/platform-admin/organizations/${organizationId}/invoices/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('invoicesTitle', { name: organizationName })} description={t('invoicesHint')}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
          <Field label={t('invoiceAmount')} htmlFor="inv-amount" error={errors.amount?.message}>
            <Input id="inv-amount" type="number" step={0.001} min={0} dir="ltr" {...register('amount', { required: tc('required'), valueAsNumber: true, min: 0 })} />
          </Field>
          <Field label={t('periodStart')} htmlFor="inv-start" error={errors.periodStart?.message}>
            <Input id="inv-start" type="date" {...register('periodStart', { required: tc('required') })} />
          </Field>
          <Field label={t('periodEnd')} htmlFor="inv-end" error={errors.periodEnd?.message}>
            <Input id="inv-end" type="date" {...register('periodEnd', { required: tc('required') })} />
          </Field>
          <Field label={t('dueDate')} htmlFor="inv-due" error={errors.dueDate?.message}>
            <Input id="inv-due" type="date" {...register('dueDate', { required: tc('required') })} />
          </Field>
          <div className="sm:col-span-4">
            <Field label={t('invoiceNotes')} htmlFor="inv-notes">
              <Textarea id="inv-notes" rows={1} {...register('notes')} />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" size="sm" loading={create.isPending}><Plus className="h-4 w-4" aria-hidden />{t('addInvoice')}</Button>
          </div>
        </form>

        {invoices.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : !invoices.data?.length ? (
          <p className="text-sm text-muted-foreground">{t('emptyInvoices')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.data.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-navy">{inv.amount.toFixed(3)} {inv.currency}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(inv.periodStart, locale)} → {formatDateTime(inv.periodEnd, locale)} · {t('dueDate')} {formatDateTime(inv.dueDate, locale)}
                  </p>
                  {inv.notes && <p className="text-xs text-muted-foreground">{inv.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {inv.isOverdue && <Badge tone="danger">{t('subscriptionStatuses.PAST_DUE')}</Badge>}
                  <Select
                    aria-label={t('status')}
                    className="!h-8 !py-0 text-xs"
                    value={inv.status}
                    onChange={(e) => updateStatus.mutate({ id: inv.id, status: e.target.value as PlatformInvoiceStatus })}
                  >
                    {(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] as const).map((s) => <option key={s} value={s}>{t(`invoiceStatuses.${s}`)}</option>)}
                  </Select>
                  <Badge tone={TONE[inv.status]}>{t(`invoiceStatuses.${inv.status}`)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
