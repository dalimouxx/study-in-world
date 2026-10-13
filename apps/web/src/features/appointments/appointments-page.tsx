'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Appointment } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

export function AppointmentsPage() {
  return (
    <RequirePermission permission="appointment.view">
      <Content />
    </RequirePermission>
  );
}

interface FormValues { title: string; startAt: string; endAt: string; location: string }

function Content() {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const list = useQuery({ queryKey: ['appointments'], queryFn: () => api<Appointment[]>('/appointments') });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['appointments'] });

  const create = useMutation({
    mutationFn: (v: FormValues) => api('/appointments', { method: 'POST', body: { ...v, location: v.location || undefined } }),
    onSuccess: () => { void invalidate(); setFormOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/appointments/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = list.data ?? [];
  const upcoming = items.filter((a) => new Date(a.endAt) >= new Date());

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={can('appointment.manage') && <Button className="!rounded-full" onClick={() => { reset({ title: '', startAt: '', endAt: '', location: '' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
      />
      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : upcoming.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <StaggerGroup className="space-y-2">
          {upcoming.map((a) => (
            <StaggerItem key={a.id}>
            <Card hoverable className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-navy">{a.title}</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(a.startAt, locale)}{a.location ? ` · ${a.location}` : ''}</p>
              </div>
              {can('appointment.manage') && (
                <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => remove.mutate(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              )}
            </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('newTitle')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('appointmentTitle')} htmlFor="appt-title" error={errors.title?.message}>
            <Input id="appt-title" aria-invalid={!!errors.title} {...register('title', { required: tc('required') })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('startAt')} htmlFor="appt-start" error={errors.startAt?.message}>
              <Input id="appt-start" type="datetime-local" dir="ltr" aria-invalid={!!errors.startAt} {...register('startAt', { required: tc('required') })} />
            </Field>
            <Field label={t('endAt')} htmlFor="appt-end" error={errors.endAt?.message}>
              <Input id="appt-end" type="datetime-local" dir="ltr" aria-invalid={!!errors.endAt} {...register('endAt', { required: tc('required') })} />
            </Field>
          </div>
          <Field label={t('location')} htmlFor="appt-location">
            <Input id="appt-location" {...register('location')} />
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
