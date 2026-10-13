'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FadeIn } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { portalApi } from '@/lib/portal-api';
import type { PortalProfile } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

interface FormValues { phone: string; nationality: string }

export function PortalProfilePage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const profile = useQuery({ queryKey: ['portal', 'profile'], queryFn: () => portalApi<PortalProfile>('/portal/profile') });

  useEffect(() => {
    if (profile.data) reset({ phone: profile.data.phone, nationality: profile.data.nationality ?? '' });
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => portalApi('/portal/profile', { method: 'PATCH', body: v }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] }); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (profile.isLoading || !profile.data) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  const p = profile.data;

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('profileTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('profileSubtitle')}</p>

      <FadeIn>
        <Card className="mt-6 grid gap-4 p-5 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">{t('firstName')}</dt><dd className="font-medium text-navy">{p.firstName}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{t('lastName')}</dt><dd className="font-medium text-navy">{p.lastName}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{t('email')}</dt><dd className="font-medium text-navy" dir="ltr">{p.email ?? '–'}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{t('passportNumber')}</dt><dd className="font-medium text-navy" dir="ltr">{p.passportNumber ?? '–'}</dd></div>
        </Card>
      </FadeIn>

      <FadeIn delay={0.08}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="mt-6 space-y-4">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={t('phone')} htmlFor="p-phone"><Input id="p-phone" dir="ltr" {...register('phone')} /></Field>
            <Field label={t('nationality')} htmlFor="p-nat"><Input id="p-nat" {...register('nationality')} /></Field>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </FadeIn>
    </>
  );
}
