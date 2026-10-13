'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { useRouter } from '@/i18n/navigation';
import { api, AuthPayload } from '@/lib/api';
import { passwordSchema } from '@/lib/schemas';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

export function AccountPage() {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { user, applySession } = useAuth();
  const forced = !!user?.mustChangePassword;

  const schema = z
    .object({ currentPassword: z.string().min(1, tc('required')), newPassword: passwordSchema(ta), confirm: z.string().min(1, tc('required')) })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: ta('passwordMismatch') })
    .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: t('samePassword') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const change = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      api<AuthPayload>('/auth/change-password', { method: 'POST', body: { currentPassword: v.currentPassword, newPassword: v.newPassword } }),
    onSuccess: (payload) => {
      applySession(payload);
      reset();
      toast.success(t('changed'));
      if (forced) router.replace('/dashboard');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title={t('title')} />
      {forced && (
        <p role="alert" className="rounded-md border border-accent/60 bg-accent/10 px-4 py-3 text-sm">
          {t('mustChange')}
        </p>
      )}

      <Card>
        <CardHeader title={t('profile')} />
        <dl className="grid gap-3 p-5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{t('name')}</dt>
          <dd>{user?.firstName} {user?.lastName}</dd>
          <dt className="text-muted-foreground">{t('email')}</dt>
          <dd dir="ltr" className="text-start">{user?.email}</dd>
          <dt className="text-muted-foreground">{t('role')}</dt>
          <dd>{user?.roleName}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader title={t('passwordTitle')} description={t('passwordHint')} />
        <form onSubmit={handleSubmit((v) => change.mutate(v))} noValidate className="space-y-4 p-5">
          <Field label={t('currentPassword')} htmlFor="currentPassword" error={errors.currentPassword?.message}>
            <Input id="currentPassword" type="password" dir="ltr" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register('currentPassword')} />
          </Field>
          <Field label={ta('newPassword')} htmlFor="newPassword" hint={ta('passwordRule')} error={errors.newPassword?.message}>
            <Input id="newPassword" type="password" dir="ltr" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register('newPassword')} />
          </Field>
          <Field label={ta('confirmPassword')} htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" dir="ltr" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={change.isPending}>{t('changePassword')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
