'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import type { Country, Paginated, Prospect, ProspectSource } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

interface Values {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  desiredCountryId: string;
  desiredProgram: string;
  budget: string;
  campaign: string;
  nextFollowUpAt: string;
  source: ProspectSource;
  notes: string;
}

const SOURCES: ProspectSource[] = ['WEBSITE', 'PHONE', 'WALK_IN', 'REFERRAL', 'SOCIAL', 'PARTNER', 'OTHER'];

export function ProspectFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('prospects');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const countries = useQuery({ queryKey: ['catalog', 'countries'], queryFn: () => api<Paginated<Country>>('/countries', { query: { pageSize: 100 } }) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>();

  useEffect(() => {
    if (open) {
      reset({ firstName: '', lastName: '', phone: '', email: '', city: '', desiredCountryId: '', desiredProgram: '', budget: '', campaign: '', nextFollowUpAt: '', source: 'PHONE', notes: '' });
      setDuplicateWarning(null);
    }
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: Values & { force?: boolean }) =>
      api<Prospect>('/prospects', {
        method: 'POST',
        body: {
          ...v,
          email: v.email || undefined,
          city: v.city || undefined,
          desiredCountryId: v.desiredCountryId || undefined,
          desiredProgram: v.desiredProgram || undefined,
          budget: v.budget ? Number(v.budget) : undefined,
          campaign: v.campaign || undefined,
          nextFollowUpAt: v.nextFollowUpAt || undefined,
          notes: v.notes || undefined,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success(t('created'));
      onOpenChange(false);
    },
    onError: (err, variables) => {
      if (err instanceof ApiError && err.code === 'DUPLICATE_CONTACT' && !variables.force) {
        setDuplicateWarning(t('duplicateWarning'));
        return;
      }
      toast.error(errorMessage(err));
    },
  });

  const onSubmit = (v: Values) => create.mutate({ ...v, force: !!duplicateWarning });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('newTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} htmlFor="p-first" error={errors.firstName?.message}>
            <Input id="p-first" aria-invalid={!!errors.firstName} {...register('firstName', { required: tc('required') })} />
          </Field>
          <Field label={t('lastName')} htmlFor="p-last" error={errors.lastName?.message}>
            <Input id="p-last" aria-invalid={!!errors.lastName} {...register('lastName', { required: tc('required') })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} htmlFor="p-phone" error={errors.phone?.message}>
            <Input id="p-phone" dir="ltr" aria-invalid={!!errors.phone} {...register('phone', { required: tc('required'), onChange: () => setDuplicateWarning(null) })} />
          </Field>
          <Field label={t('email')} htmlFor="p-email" error={errors.email?.message}>
            <Input id="p-email" type="email" dir="ltr" {...register('email', { pattern: { value: /^$|^\S+@\S+\.\S+$/, message: ta('emailInvalid') } })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('city')} htmlFor="p-city"><Input id="p-city" {...register('city')} /></Field>
          <Field label={t('source')} htmlFor="p-source">
            <Select id="p-source" {...register('source')}>
              {SOURCES.map((s) => <option key={s} value={s}>{t(`sources.${s}`)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('desiredCountry')} htmlFor="p-country">
            <Select id="p-country" {...register('desiredCountryId')}>
              <option value="">—</option>
              {(countries.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.flagEmoji} {c.name}</option>)}
            </Select>
          </Field>
          <Field label={t('desiredProgram')} htmlFor="p-program"><Input id="p-program" {...register('desiredProgram')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('budget')} htmlFor="p-budget"><Input id="p-budget" type="number" dir="ltr" {...register('budget')} /></Field>
          <Field label={t('campaign')} htmlFor="p-campaign"><Input id="p-campaign" {...register('campaign')} /></Field>
          <Field label={t('nextFollowUp')} htmlFor="p-followup"><Input id="p-followup" type="date" dir="ltr" {...register('nextFollowUpAt')} /></Field>
        </div>
        <Field label={t('notes')} htmlFor="p-notes">
          <Textarea id="p-notes" rows={3} {...register('notes')} />
        </Field>
        {duplicateWarning && (
          <p role="alert" className="rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-sm">{duplicateWarning}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant={duplicateWarning ? 'danger' : 'primary'} loading={create.isPending}>
            {duplicateWarning ? t('createAnyway') : tc('create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
