'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Candidate, Commission, CommissionType, Partner, PartnerPortalUser, PartnerType } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

const TYPES: PartnerType[] = ['UNIVERSITY', 'SCHOOL', 'TRAINING_CENTER', 'LANGUAGE_ORGANIZATION', 'AGENT', 'OTHER'];
const COMMISSION_TONE = { TO_CONFIRM: 'neutral', EXPECTED: 'primary', INVOICED: 'primary', PARTIALLY_RECEIVED: 'primary', RECEIVED: 'success', CANCELLED: 'danger' } as const;

interface FormValues {
  type: PartnerType; companyName: string; contactName: string; email: string; phone: string; country: string; notes: string;
  commissionType: CommissionType; commissionValue: number; isActive: boolean;
}

export function PartnerDetailPage({ partnerId }: { partnerId: string }) {
  return (
    <RequirePermission permission="partner.view">
      <Content partnerId={partnerId} />
    </RequirePermission>
  );
}

function Content({ partnerId }: { partnerId: string }) {
  const t = useTranslations('partners');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [deactivating, setDeactivating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const inviteForm = useForm<{ email: string; firstName: string; lastName: string }>();

  const partner = useQuery({ queryKey: ['partners', partnerId], queryFn: () => api<Partner>(`/partners/${partnerId}`) });
  const candidates = useQuery({ queryKey: ['partners', partnerId, 'candidates'], queryFn: () => api<Candidate[]>(`/partners/${partnerId}/candidates`) });
  const users = useQuery({ queryKey: ['partners', partnerId, 'users'], queryFn: () => api<PartnerPortalUser[]>(`/partners/${partnerId}/users`) });
  const commissions = useQuery({ queryKey: ['partners', partnerId, 'commissions'], queryFn: () => api<Commission[]>(`/partners/${partnerId}/commissions`) });

  useEffect(() => {
    if (partner.data) {
      reset({
        type: partner.data.type, companyName: partner.data.companyName, contactName: partner.data.contactName ?? '',
        email: partner.data.email ?? '', phone: partner.data.phone ?? '', country: partner.data.country ?? '',
        notes: partner.data.notes ?? '', commissionType: partner.data.commissionType, commissionValue: partner.data.commissionValue,
        isActive: partner.data.isActive,
      });
    }
  }, [partner.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => api(`/partners/${partnerId}`, { method: 'PATCH', body: v }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['partners', partnerId] }); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const deactivate = useMutation({
    mutationFn: () => api(`/partners/${partnerId}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['partners'] }); setDeactivating(false); toast.success(t('deactivated')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const invite = useMutation({
    mutationFn: (v: { email: string; firstName: string; lastName: string }) => api(`/partners/${partnerId}/users`, { method: 'POST', body: v }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['partners', partnerId, 'users'] });
      setInviteOpen(false);
      toast.success(t('inviteSent'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (partner.isLoading || !partner.data) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  const p = partner.data;

  return (
    <>
      <PageHeader
        title={p.companyName}
        description={t(`types.${p.type}`)}
        action={can('partner.manage') && p.isActive && <Button variant="secondary" onClick={() => setDeactivating(true)}>{t('deactivate')}</Button>}
      />

      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label={t('companyName')} htmlFor="e-name"><Input id="e-name" disabled={!can('partner.manage')} {...register('companyName')} /></Field>
          <Field label={t('type')} htmlFor="e-type">
            <Select id="e-type" disabled={!can('partner.manage')} {...register('type')}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('contactName')} htmlFor="e-contact"><Input id="e-contact" disabled={!can('partner.manage')} {...register('contactName')} /></Field>
          <Field label={t('country')} htmlFor="e-country"><Input id="e-country" disabled={!can('partner.manage')} {...register('country')} /></Field>
          <Field label={t('email')} htmlFor="e-email"><Input id="e-email" type="email" dir="ltr" disabled={!can('partner.manage')} {...register('email')} /></Field>
          <Field label={t('phone')} htmlFor="e-phone"><Input id="e-phone" dir="ltr" disabled={!can('partner.manage')} {...register('phone')} /></Field>
          <Field label={t('commissionType')} htmlFor="e-ctype">
            <Select id="e-ctype" disabled={!can('partner.manage')} {...register('commissionType')}>
              <option value="PERCENTAGE">{t('commissionTypes.PERCENTAGE')}</option>
              <option value="FIXED">{t('commissionTypes.FIXED')}</option>
            </Select>
          </Field>
          <Field label={t('commissionValue')} htmlFor="e-cvalue">
            <Input id="e-cvalue" type="number" step={0.01} dir="ltr" disabled={!can('partner.manage')} {...register('commissionValue', { valueAsNumber: true })} />
          </Field>
          <Field label={t('notes')} htmlFor="e-notes" className="sm:col-span-2"><Textarea id="e-notes" rows={3} disabled={!can('partner.manage')} {...register('notes')} /></Field>
        </Card>
        {can('partner.manage') && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        )}
      </form>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader title={t('linkedCandidates')} />
            {!candidates.data?.length ? (
              <EmptyState title={t('noLinkedCandidates')} />
            ) : (
              <ul className="divide-y divide-border">
                {candidates.data.map((c) => (
                  <li key={c.id}>
                    <Link href={`/candidates/${c.id}`} className="block px-5 py-3 text-sm hover:bg-muted/40">{c.firstName} {c.lastName}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-4">
            <CardHeader title={t('commissions')} />
            {!commissions.data?.length ? (
              <EmptyState title={t('noCommissions')} />
            ) : (
              <ul className="divide-y divide-border">
                {commissions.data.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{c.candidate ? `${c.candidate.firstName} ${c.candidate.lastName}` : '–'} — {c.amount.toFixed(3)} {c.currency}</span>
                    <Badge tone={COMMISSION_TONE[c.status]}>{t(`commissionStatuses.${c.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <Card>
            <div className="flex items-center justify-between px-5 pt-5">
              <CardHeader title={t('portalUsers')} />
              {can('partner.manage') && <Button size="sm" onClick={() => { inviteForm.reset({ email: '', firstName: '', lastName: '' }); setInviteOpen(true); }}><Send className="h-3.5 w-3.5" aria-hidden />{t('invite')}</Button>}
            </div>
            {!users.data?.length ? (
              <EmptyState title={t('noPortalUsers')} />
            ) : (
              <ul className="divide-y divide-border">
                {users.data.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{u.firstName} {u.lastName} <span className="text-muted-foreground" dir="ltr">({u.email})</span></span>
                    <Badge tone={u.portalActivatedAt ? 'success' : 'neutral'}>{u.portalActivatedAt ? t('active') : t('notActivated')}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={t('deactivateTitle')}
        description={t('deactivateDescription', { name: p.companyName })}
        confirmLabel={t('deactivate')}
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen} title={t('invitePartnerUser')} description={t('invitePartnerUserHint')}>
        <form onSubmit={inviteForm.handleSubmit((v) => invite.mutate(v))} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('firstName')} htmlFor="pu-first"><Input id="pu-first" {...inviteForm.register('firstName', { required: true })} /></Field>
            <Field label={t('lastName')} htmlFor="pu-last"><Input id="pu-last" {...inviteForm.register('lastName', { required: true })} /></Field>
          </div>
          <Field label={t('email')} htmlFor="pu-email"><Input id="pu-email" type="email" dir="ltr" {...inviteForm.register('email', { required: true })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={invite.isPending}>{t('invite')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
