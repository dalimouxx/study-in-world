'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Expense } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';

export function ExpensesPage() {
  return (
    <RequirePermission permission="expense.manage">
      <Content />
    </RequirePermission>
  );
}

interface FormValues { category: string; amount: number; description: string }

function Content() {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const list = useQuery({ queryKey: ['expenses'], queryFn: () => api<Expense[]>('/expenses') });

  const create = useMutation({
    mutationFn: (v: FormValues) => api('/expenses', { method: 'POST', body: v }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setFormOpen(false);
      toast.success(t('created'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = list.data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={<Button className="!rounded-full" onClick={() => { reset({ category: '', amount: 0, description: '' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
      />
      <FadeIn>
      <Card>
        {list.isLoading ? (
          <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <Table>
            <thead><tr><Th>{t('date')}</Th><Th>{t('category')}</Th><Th>{t('description')}</Th><Th>{t('amount')}</Th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.date, locale)}</Td>
                  <Td>{e.category}</Td>
                  <Td>{e.description}</Td>
                  <Td className="tabular-nums">{e.amount.toFixed(3)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      </FadeIn>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('newTitle')} description={t('newHint')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('category')} htmlFor="exp-category" error={errors.category?.message}>
            <Input id="exp-category" aria-invalid={!!errors.category} {...register('category', { required: tc('required') })} />
          </Field>
          <Field label={t('amount')} htmlFor="exp-amount" error={errors.amount?.message}>
            <Input id="exp-amount" type="number" step={0.001} min={0} dir="ltr" aria-invalid={!!errors.amount} {...register('amount', { valueAsNumber: true, required: true, min: { value: 0.001, message: tc('required') } })} />
          </Field>
          <Field label={t('description')} htmlFor="exp-desc" error={errors.description?.message}>
            <Textarea id="exp-desc" rows={2} aria-invalid={!!errors.description} {...register('description', { required: tc('required') })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
