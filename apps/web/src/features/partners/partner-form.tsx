'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { CommissionType, Partner, PartnerType } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

interface Values {
  type: PartnerType;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  commissionType: CommissionType;
  commissionValue: number;
}

const TYPES: PartnerType[] = ['UNIVERSITY', 'SCHOOL', 'TRAINING_CENTER', 'LANGUAGE_ORGANIZATION', 'AGENT', 'OTHER'];

export function PartnerFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('partners');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>();

  useEffect(() => {
    if (open) reset({ type: 'AGENT', companyName: '', contactName: '', email: '', phone: '', country: '', notes: '', commissionType: 'PERCENTAGE', commissionValue: 0 });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: Values) =>
      api<Partner>('/partners', {
        method: 'POST',
        body: { ...v, contactName: v.contactName || undefined, email: v.email || undefined, phone: v.phone || undefined, country: v.country || undefined, notes: v.notes || undefined },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success(t('created'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('newTitle')}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('companyName')} htmlFor="p-name" error={errors.companyName?.message}>
            <Input id="p-name" aria-invalid={!!errors.companyName} {...register('companyName', { required: tc('required') })} />
          </Field>
          <Field label={t('type')} htmlFor="p-type">
            <Select id="p-type" {...register('type')}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('contactName')} htmlFor="p-contact"><Input id="p-contact" {...register('contactName')} /></Field>
          <Field label={t('country')} htmlFor="p-country"><Input id="p-country" {...register('country')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('email')} htmlFor="p-email"><Input id="p-email" type="email" dir="ltr" {...register('email')} /></Field>
          <Field label={t('phone')} htmlFor="p-phone"><Input id="p-phone" dir="ltr" {...register('phone')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('commissionType')} htmlFor="p-ctype">
            <Select id="p-ctype" {...register('commissionType')}>
              <option value="PERCENTAGE">{t('commissionTypes.PERCENTAGE')}</option>
              <option value="FIXED">{t('commissionTypes.FIXED')}</option>
            </Select>
          </Field>
          <Field label={t('commissionValue')} htmlFor="p-cvalue">
            <Input id="p-cvalue" type="number" step={0.01} dir="ltr" {...register('commissionValue', { valueAsNumber: true, min: 0 })} />
          </Field>
        </div>
        <Field label={t('notes')} htmlFor="p-notes"><Textarea id="p-notes" rows={3} {...register('notes')} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
