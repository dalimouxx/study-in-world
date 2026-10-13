'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Application, ApplicationStatus, Paginated, Program } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

const STATUSES: ApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'];
const TONE: Record<ApplicationStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  DRAFT: 'neutral', SUBMITTED: 'primary', UNDER_REVIEW: 'primary', ACCEPTED: 'success', REJECTED: 'danger', WAITLISTED: 'primary', WITHDRAWN: 'neutral',
};

interface FormValues { programId: string; country: string; university: string; program: string; intake: string }

export function ApplicationsTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>();

  const query = useQuery({ queryKey: ['candidates', candidateId, 'applications'], queryFn: () => api<Application[]>(`/candidates/${candidateId}/applications`) });
  const catalog = useQuery({ queryKey: ['catalog', 'programs', 'picker'], queryFn: () => api<Paginated<Program>>('/programs', { query: { pageSize: 200 } }), enabled: mode === 'catalog' });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'applications'] });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api(`/candidates/${candidateId}/applications`, {
        method: 'POST',
        body: mode === 'catalog' ? { programId: v.programId, intake: v.intake } : { country: v.country, university: v.university, program: v.program, intake: v.intake },
      }),
    onSuccess: () => { void invalidate(); setOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) => api(`/applications/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];
  const hasCatalog = (catalog.data?.items.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {can('application.manage') && (
        <div className="flex justify-end">
          <Button onClick={() => { reset({ programId: '', country: '', university: '', program: '', intake: '' }); setMode('catalog'); setOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />{t('newApplication')}
          </Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyApplications')} />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.university}</p>
                  <p className="text-sm text-muted-foreground">{a.program} · {a.country} · {a.intake}</p>
                </div>
                {can('application.manage') ? (
                  <Select className="w-auto" aria-label={t('status')} value={a.status} onChange={(e) => setStatus.mutate({ id: a.id, status: e.target.value as ApplicationStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`applicationStatuses.${s}`)}</option>)}
                  </Select>
                ) : (
                  <Badge tone={TONE[a.status]}>{t(`applicationStatuses.${a.status}`)}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={t('newApplication')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          {hasCatalog && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === 'catalog' ? 'primary' : 'secondary'} onClick={() => setMode('catalog')}>{t('fromCatalog')}</Button>
              <Button type="button" size="sm" variant={mode === 'manual' ? 'primary' : 'secondary'} onClick={() => setMode('manual')}>{t('manualEntry')}</Button>
            </div>
          )}
          {mode === 'catalog' && hasCatalog ? (
            <Field label={t('program')} htmlFor="a-catalog-program" hint={t('fromCatalogHint')}>
              <Select id="a-catalog-program" {...register('programId', { required: mode === 'catalog' })}>
                <option value="">—</option>
                {(catalog.data?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.university?.country?.flagEmoji} {p.name} — {p.university?.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label={t('university')} htmlFor="a-uni" error={errors.university?.message}>
                <Input id="a-uni" aria-invalid={!!errors.university} {...register('university', { required: mode === 'manual' && tc('required') })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('program')} htmlFor="a-program" error={errors.program?.message}>
                  <Input id="a-program" aria-invalid={!!errors.program} {...register('program', { required: mode === 'manual' && tc('required') })} />
                </Field>
                <Field label={t('country')} htmlFor="a-country" error={errors.country?.message}>
                  <Input id="a-country" aria-invalid={!!errors.country} {...register('country', { required: mode === 'manual' && tc('required') })} />
                </Field>
              </div>
            </>
          )}
          <Field label={t('intake')} htmlFor="a-intake" hint={t('intakeHint')} error={errors.intake?.message}>
            <Input id="a-intake" aria-invalid={!!errors.intake} {...register('intake', { required: tc('required') })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending} disabled={mode === 'catalog' && !watch('programId') && hasCatalog}>{tc('create')}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
