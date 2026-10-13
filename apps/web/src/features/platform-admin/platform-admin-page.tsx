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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { OrganizationPlan, PlatformOrganization, SubscriptionStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { PlatformInvoicesDialog } from './platform-invoices-dialog';

const STATUS_TONE: Record<SubscriptionStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  TRIALING: 'primary', ACTIVE: 'success', PAST_DUE: 'danger', SUSPENDED: 'danger', CANCELLED: 'neutral',
};
const PLANS: OrganizationPlan[] = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'];

interface FormValues { name: string; adminFirstName: string; adminLastName: string; adminEmail: string; adminPassword: string; plan: OrganizationPlan }

/**
 * Gestion des agences clientes de la plateforme (SaaS multi-agences, section 12) — jamais leurs données
 * métier, toujours déjà isolées par organizationId. Réservé aux utilisateurs isPlatformAdmin ; le lien
 * n'apparaît même pas dans le menu pour les autres (voir components/nav.ts et admin-shell.tsx).
 */
export function PlatformAdminPage() {
  const t = useTranslations('platformAdmin');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [invoicesFor, setInvoicesFor] = useState<PlatformOrganization | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: { plan: 'TRIAL' } });

  const list = useQuery({ queryKey: ['platform-admin', 'organizations'], queryFn: () => api<PlatformOrganization[]>('/platform-admin/organizations') });
  const items = list.data ?? [];

  const create = useMutation({
    mutationFn: (v: FormValues) => api('/platform-admin/organizations', { method: 'POST', body: v }),
    onSuccess: () => { toast.success(t('created')); setFormOpen(false); void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'organizations'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, subscriptionStatus }: { id: string; subscriptionStatus: SubscriptionStatus }) =>
      api(`/platform-admin/organizations/${id}`, { method: 'PATCH', body: { subscriptionStatus, isActive: subscriptionStatus !== 'SUSPENDED' } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'organizations'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={<Button className="!rounded-full" onClick={() => { reset({ name: '', adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '', plan: 'TRIAL' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('newOrganization')}</Button>}
      />
      <FadeIn>
      <Card>
        {list.isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <Table>
            <thead><tr><Th>{t('organization')}</Th><Th>{t('plan')}</Th><Th>{t('status')}</Th><Th>{t('usage')}</Th><Th>{t('createdAt')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr></thead>
            <tbody>
              {items.map((org) => (
                <tr key={org.id}>
                  <Td><p className="font-medium text-navy">{org.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{org.slug}</p></Td>
                  <Td>{t(`plans.${org.plan}`)}</Td>
                  <Td>
                    <Select
                      aria-label={t('status')}
                      className="!h-8 !py-0 text-xs"
                      value={org.subscriptionStatus}
                      onChange={(e) => updateStatus.mutate({ id: org.id, subscriptionStatus: e.target.value as SubscriptionStatus })}
                    >
                      {(['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const).map((s) => <option key={s} value={s}>{t(`subscriptionStatuses.${s}`)}</option>)}
                    </Select>
                    <Badge tone={STATUS_TONE[org.subscriptionStatus]} className="mt-1">{t(`subscriptionStatuses.${org.subscriptionStatus}`)}</Badge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{t('usageSummary', { users: org._count.users, candidates: org._count.candidates, prospects: org._count.prospects })}</Td>
                  <Td>{formatDateTime(org.createdAt, locale)}</Td>
                  <Td>
                    <Button variant="secondary" size="sm" onClick={() => setInvoicesFor(org)}>{t('billing')}</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      </FadeIn>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('newOrganization')} description={t('newOrganizationHint')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('organizationName')} htmlFor="org-name" error={errors.name?.message}>
            <Input id="org-name" {...register('name', { required: tc('required') })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adminFirstName')} htmlFor="org-admin-first" error={errors.adminFirstName?.message}>
              <Input id="org-admin-first" {...register('adminFirstName', { required: tc('required') })} />
            </Field>
            <Field label={t('adminLastName')} htmlFor="org-admin-last" error={errors.adminLastName?.message}>
              <Input id="org-admin-last" {...register('adminLastName', { required: tc('required') })} />
            </Field>
          </div>
          <Field label={t('adminEmail')} htmlFor="org-admin-email" error={errors.adminEmail?.message}>
            <Input id="org-admin-email" type="email" dir="ltr" {...register('adminEmail', { required: tc('required') })} />
          </Field>
          <Field label={t('adminPassword')} htmlFor="org-admin-password" hint={t('adminPasswordHint')} error={errors.adminPassword?.message}>
            <Input id="org-admin-password" type="password" dir="ltr" {...register('adminPassword', { required: tc('required') })} />
          </Field>
          <Field label={t('plan')} htmlFor="org-plan">
            <Select id="org-plan" {...register('plan')}>
              {PLANS.map((p) => <option key={p} value={p}>{t(`plans.${p}`)}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <PlatformInvoicesDialog
        organizationId={invoicesFor?.id ?? null}
        organizationName={invoicesFor?.name ?? ''}
        open={!!invoicesFor}
        onOpenChange={(o) => !o && setInvoicesFor(null)}
      />
    </>
  );
}
