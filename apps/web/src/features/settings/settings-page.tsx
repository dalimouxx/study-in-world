'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { AgencySettings } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

type SocialKey = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube';
const SOCIALS: SocialKey[] = ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'];
const TEXT_FIELDS = [
  'name', 'logoUrl', 'logoDarkUrl', 'faviconUrl', 'address', 'phone', 'whatsapp', 'email', 'website', 'openingHours',
  'legalInfo', 'taxId', 'bankDetails', 'currency', 'timezone', 'footerText', 'privacyPolicy', 'termsOfService', 'legalNotice',
  'contractTemplate',
] as const;

type Values = { [K in (typeof TEXT_FIELDS)[number]]: string } & { social: Record<SocialKey, string> };

const toValues = (s: AgencySettings): Values => ({
  ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, (s[k] as string | null) ?? ''])) as Omit<Values, 'social'>),
  social: Object.fromEntries(SOCIALS.map((k) => [k, s.socialLinks?.[k] ?? ''])) as Values['social'],
});

export function SettingsPage() {
  return (
    <RequirePermission permission="settings.view">
      <Content />
    </RequirePermission>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Content() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('settings.manage');

  const query = useQuery({ queryKey: ['agency-settings'], queryFn: () => api<AgencySettings>('/settings/agency') });
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Values>();

  useEffect(() => {
    if (query.data) reset(toValues(query.data));
  }, [query.data, reset]);

  const save = useMutation({
    mutationFn: ({ social, ...rest }: Values) => api<AgencySettings>('/settings/agency', { method: 'PATCH', body: { ...rest, socialLinks: social } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['agency-settings'], data);
      void queryClient.invalidateQueries({ queryKey: ['public-agency'] });
      reset(toValues(data));
      toast.success(t('saved'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">{errorMessage(query.error)}</p>;

  const ro = !canManage;
  const f = (k: keyof Omit<Values, 'social'>, opts?: { required?: boolean }) =>
    register(k, { ...(opts?.required ? { required: tc('required') } : {}), disabled: ro });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="max-w-4xl space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={canManage && <Button type="submit" disabled={!isDirty} loading={save.isPending}>{tc('save')}</Button>}
      />

      <Section title={t('identity')} description={t('identityHint')}>
        <Field label={t('name')} htmlFor="s-name" error={errors.name?.message} className="sm:col-span-2">
          <Input id="s-name" aria-invalid={!!errors.name} {...f('name', { required: true })} />
        </Field>
        <Field label={t('logoUrl')} htmlFor="s-logo" hint={t('urlHint')}><Input id="s-logo" dir="ltr" inputMode="url" {...f('logoUrl')} /></Field>
        <Field label={t('logoDarkUrl')} htmlFor="s-logo-dark"><Input id="s-logo-dark" dir="ltr" inputMode="url" {...f('logoDarkUrl')} /></Field>
        <Field label={t('faviconUrl')} htmlFor="s-favicon"><Input id="s-favicon" dir="ltr" inputMode="url" {...f('faviconUrl')} /></Field>
      </Section>

      <Section title={t('contact')}>
        <Field label={t('phone')} htmlFor="s-phone"><Input id="s-phone" type="tel" dir="ltr" {...f('phone')} /></Field>
        <Field label={t('whatsapp')} htmlFor="s-wa"><Input id="s-wa" type="tel" dir="ltr" {...f('whatsapp')} /></Field>
        <Field label={t('email')} htmlFor="s-email" error={errors.email?.message}>
          <Input id="s-email" type="email" dir="ltr" aria-invalid={!!errors.email} {...register('email', { disabled: ro, pattern: { value: /^$|^\S+@\S+\.\S+$/, message: ta('emailInvalid') } })} />
        </Field>
        <Field label={t('website')} htmlFor="s-web"><Input id="s-web" dir="ltr" {...f('website')} /></Field>
        <Field label={t('address')} htmlFor="s-addr" className="sm:col-span-2"><Input id="s-addr" {...f('address')} /></Field>
        <Field label={t('openingHours')} htmlFor="s-hours" className="sm:col-span-2"><Input id="s-hours" {...f('openingHours')} /></Field>
      </Section>

      <Section title={t('social')} description={t('socialHint')}>
        {SOCIALS.map((k) => (
          <Field key={k} label={t(`socials.${k}`)} htmlFor={`s-${k}`}>
            <Input id={`s-${k}`} dir="ltr" inputMode="url" placeholder="https://" {...register(`social.${k}`, { disabled: ro })} />
          </Field>
        ))}
      </Section>

      <Section title={t('legal')} description={t('legalHint')}>
        <Field label={t('taxId')} htmlFor="s-tax"><Input id="s-tax" dir="ltr" {...f('taxId')} /></Field>
        <Field label={t('currency')} htmlFor="s-cur">
          <Select id="s-cur" {...f('currency')}>
            {['TND', 'EUR', 'USD'].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label={t('timezone')} htmlFor="s-tz" className="sm:col-span-2">
          <Select id="s-tz" {...f('timezone')}>
            {['Africa/Tunis', 'Europe/Paris', 'Europe/Rome', 'Europe/Warsaw', 'UTC'].map((z) => <option key={z} value={z}>{z}</option>)}
          </Select>
        </Field>
        <Field label={t('legalInfo')} htmlFor="s-legal" className="sm:col-span-2"><Textarea id="s-legal" rows={3} {...f('legalInfo')} /></Field>
        <Field label={t('bankDetails')} htmlFor="s-bank" hint={t('bankHint')} className="sm:col-span-2"><Textarea id="s-bank" rows={3} {...f('bankDetails')} /></Field>
      </Section>

      <Section title={t('content')} description={t('contentHint')}>
        <Field label={t('footerText')} htmlFor="s-footer" className="sm:col-span-2"><Input id="s-footer" {...f('footerText')} /></Field>
        <Field label={t('privacyPolicy')} htmlFor="s-privacy" className="sm:col-span-2"><Textarea id="s-privacy" rows={5} {...f('privacyPolicy')} /></Field>
        <Field label={t('termsOfService')} htmlFor="s-terms" className="sm:col-span-2"><Textarea id="s-terms" rows={5} {...f('termsOfService')} /></Field>
        <Field label={t('legalNotice')} htmlFor="s-notice" className="sm:col-span-2"><Textarea id="s-notice" rows={5} {...f('legalNotice')} /></Field>
      </Section>

      <Section title={t('contractTemplateTitle')} description={t('contractTemplateHint')}>
        <Field label={t('contractTemplate')} htmlFor="s-contract" hint={t('contractTemplateVars')} className="sm:col-span-2">
          <Textarea id="s-contract" rows={10} {...f('contractTemplate')} />
        </Field>
      </Section>
    </form>
  );
}
