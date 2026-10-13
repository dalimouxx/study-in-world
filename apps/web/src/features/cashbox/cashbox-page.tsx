'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { CashboxMovement, CashboxSession } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';

export function CashboxPage() {
  return (
    <RequirePermission permission="cashbox.manage">
      <Content />
    </RequirePermission>
  );
}

const fmt = (n: number) => n.toFixed(3);

function Content() {
  const t = useTranslations('cashbox');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const current = useQuery({ queryKey: ['cashbox', 'current'], queryFn: () => api<(CashboxSession & { balance: number; movements: CashboxMovement[] }) | null>('/cashbox/current') });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cashbox'] });

  const openForm = useForm<{ openingAmount: number }>({ defaultValues: { openingAmount: 0 } });
  const open = useMutation({
    mutationFn: (v: { openingAmount: number }) => api('/cashbox/open', { method: 'POST', body: v }),
    onSuccess: () => { void invalidate(); toast.success(t('opened')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const closeForm = useForm<{ closingAmount: number }>();
  const close = useMutation({
    mutationFn: (v: { closingAmount: number }) => api(`/cashbox/${current.data!.id}/close`, { method: 'POST', body: v }),
    onSuccess: () => { void invalidate(); toast.success(t('closed')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const session = current.data;

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      {current.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : !session ? (
        <FadeIn>
        <Card>
          <CardHeader title={t('closedTitle')} description={t('closedHint')} />
          <form onSubmit={openForm.handleSubmit((v) => open.mutate(v))} noValidate className="flex flex-wrap items-end gap-4 p-5">
            <Field label={t('openingAmount')} htmlFor="opening">
              <Input id="opening" type="number" step={0.001} min={0} dir="ltr" className="w-40" {...openForm.register('openingAmount', { valueAsNumber: true, min: 0 })} />
            </Field>
            <Button type="submit" loading={open.isPending}>{t('open')}</Button>
          </form>
        </Card>
        </FadeIn>
      ) : (
        <FadeIn>
        <div className="space-y-6">
          <Card className="grid gap-4 p-5 sm:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">{t('openingAmount')}</p><p className="text-xl font-semibold tabular-nums text-navy">{fmt(session.openingAmount)}</p></div>
            <div><p className="text-sm text-muted-foreground">{t('currentBalance')}</p><p className="text-xl font-semibold tabular-nums text-navy">{fmt(session.balance)}</p></div>
            <div><p className="text-sm text-muted-foreground">{t('openedAt')}</p><p className="text-sm">{formatDateTime(session.openedAt, locale)}</p></div>
          </Card>

          <Card>
            <CardHeader title={t('movements')} />
            {session.movements.length === 0 ? (
              <EmptyState title={t('emptyMovements')} />
            ) : (
              <Table>
                <thead><tr><Th>{t('date')}</Th><Th>{t('reason')}</Th><Th>{t('amount')}</Th></tr></thead>
                <tbody>
                  {session.movements.map((m) => (
                    <tr key={m.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt, locale)}</Td>
                      <Td>{m.reason}</Td>
                      <Td className={m.type === 'IN' ? 'text-success' : 'text-destructive'}>{m.type === 'IN' ? '+' : '−'}{fmt(m.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title={t('closeTitle')} description={t('closeHint')} />
            <form onSubmit={closeForm.handleSubmit((v) => close.mutate(v))} noValidate className="flex flex-wrap items-end gap-4 p-5">
              <Field label={t('closingAmount')} htmlFor="closing">
                <Input id="closing" type="number" step={0.001} min={0} dir="ltr" className="w-40" {...closeForm.register('closingAmount', { valueAsNumber: true, min: 0, required: true })} />
              </Field>
              <Button type="submit" variant="danger" loading={close.isPending}>{t('close')}</Button>
            </form>
          </Card>
        </div>
        </FadeIn>
      )}
    </>
  );
}
