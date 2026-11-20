'use client';

import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/features/auth/auth-context';

type Setup = { otpauthUrl: string; qrDataUrl: string; secret: string };

/**
 * Double authentification dans « Mon compte » : activation (QR code, premier code, codes de secours affichés une
 * seule fois), ou désactivation (mot de passe + code) quand le rôle ne l'exige pas.
 */
export function TwoFactorSection() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  // Activation obligatoire : une fois terminée, on rejoint le tableau de bord.
  const [wasForced] = useState(!!user?.mustSetupTwoFactor);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const enableForm = useForm<{ code: string }>();
  const disableForm = useForm<{ password: string; code: string }>();
  const required = !!user && (user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'ADMIN' || user.isPlatformAdmin);

  const start = useMutation({
    mutationFn: () => api<Setup>('/auth/2fa/setup', { method: 'POST', body: {} }),
    onSuccess: setSetup,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const enable = useMutation({
    mutationFn: (code: string) => api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { method: 'POST', body: { code } }),
    onSuccess: (res) => {
      setSetup(null);
      setRecoveryCodes(res.recoveryCodes);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      enableForm.reset({ code: '' });
    },
  });
  const disable = useMutation({
    mutationFn: (v: { password: string; code: string }) => api('/auth/2fa/disable', { method: 'POST', body: v }),
    onSuccess: async () => {
      disableForm.reset();
      await refreshUser();
      toast.success(t('twoFactorDisabled'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const download = () => {
    const blob = new Blob([`Study in World — ${user?.email}\n\n${recoveryCodes!.join('\n')}\n`], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'codes-de-secours-study-in-world.txt' });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Codes de secours : affichés une seule fois, juste après l'activation.
  if (recoveryCodes) {
    return (
      <Card>
        <CardHeader title={t('twoFactorTitle')} description={t('recoveryCodesHint')} />
        <div className="space-y-4 p-5">
          <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-4 font-mono text-sm" aria-label={t('recoveryCodesTitle')}>
            {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={download}>{t('recoveryCodesDownload')}</Button>
            <Button onClick={async () => { setRecoveryCodes(null); await refreshUser(); toast.success(t('twoFactorEnabled')); if (wasForced) router.replace('/dashboard'); }}>{t('recoveryCodesDone')}</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (user?.twoFactorEnabled) {
    return (
      <Card>
        <CardHeader title={t('twoFactorTitle')} description={required ? t('twoFactorRequiredHint') : t('twoFactorOnHint')} />
        <div className="space-y-4 p-5">
          <Badge tone="success"><ShieldCheck className="me-1 inline h-3.5 w-3.5" aria-hidden />{t('twoFactorOn')}</Badge>
          {!required && (
            <form onSubmit={disableForm.handleSubmit((v) => disable.mutate(v))} noValidate className="grid gap-3 sm:grid-cols-2">
              <Field label={t('currentPassword')} htmlFor="tf-password">
                <Input id="tf-password" type="password" dir="ltr" autoComplete="current-password" {...disableForm.register('password', { required: true })} />
              </Field>
              <Field label={t('twoFactorCode')} htmlFor="tf-disable-code">
                <Input id="tf-disable-code" dir="ltr" autoComplete="one-time-code" maxLength={20} {...disableForm.register('code', { required: true, minLength: 6 })} />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" variant="secondary" loading={disable.isPending}>{t('twoFactorDisable')}</Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t('twoFactorTitle')} description={t('twoFactorOffHint')} />
      <div className="space-y-4 p-5">
        {!setup ? (
          <Button onClick={() => start.mutate()} loading={start.isPending}>{t('twoFactorStart')}</Button>
        ) : (
          <form onSubmit={enableForm.handleSubmit(({ code }) => enable.mutate(code))} noValidate className="space-y-4">
            <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
              <li>{t('twoFactorStep1')}</li>
              <li>{t('twoFactorStep2')}</li>
            </ol>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- image générée (data URL), pas d'optimisation possible */}
              <img src={setup.qrDataUrl} alt={t('twoFactorQrAlt')} width={180} height={180} className="rounded-xl border border-border bg-white p-2" />
              <div className="min-w-0 text-sm">
                <p className="text-muted-foreground">{t('twoFactorManual')}</p>
                <code dir="ltr" className="mt-1 block break-all rounded-md bg-muted/50 px-2 py-1 font-mono text-xs">{setup.secret}</code>
              </div>
            </div>
            <Field label={t('twoFactorCode')} htmlFor="tf-code" error={enableForm.formState.errors.code?.message}>
              <Input id="tf-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-[10rem] text-center font-mono tracking-[0.3em]"
                {...enableForm.register('code', { required: tc('required'), pattern: { value: /^\d{6}$/, message: t('twoFactorCodeSix') } })} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={enable.isPending}>{t('twoFactorConfirm')}</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
