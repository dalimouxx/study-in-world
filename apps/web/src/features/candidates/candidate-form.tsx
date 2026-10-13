'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Candidate } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

interface Values { firstName: string; lastName: string; phone: string; email: string }

export function CandidateFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>();

  const create = useMutation({
    mutationFn: (v: Values) => api<Candidate>('/candidates', { method: 'POST', body: { ...v, email: v.email || undefined } }),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(t('created'));
      onOpenChange(false);
      router.push(`/candidates/${c.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) reset({ firstName: '', lastName: '', phone: '', email: '' }); }} title={t('newTitle')}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} htmlFor="c-first" error={errors.firstName?.message}>
            <Input id="c-first" aria-invalid={!!errors.firstName} {...register('firstName', { required: tc('required') })} />
          </Field>
          <Field label={t('lastName')} htmlFor="c-last" error={errors.lastName?.message}>
            <Input id="c-last" aria-invalid={!!errors.lastName} {...register('lastName', { required: tc('required') })} />
          </Field>
        </div>
        <Field label={t('phone')} htmlFor="c-phone" error={errors.phone?.message}>
          <Input id="c-phone" dir="ltr" aria-invalid={!!errors.phone} {...register('phone', { required: tc('required') })} />
        </Field>
        <Field label={t('email')} htmlFor="c-email" error={errors.email?.message}>
          <Input id="c-email" type="email" dir="ltr" {...register('email', { pattern: { value: /^$|^\S+@\S+\.\S+$/, message: ta('emailInvalid') } })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
