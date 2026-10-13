'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import type { ChecklistItem, ChecklistItemStatus, VisaFile, VisaStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

const STATUSES: VisaStatus[] = ['NOT_STARTED', 'PREPARING', 'SUBMITTED', 'APPROVED', 'REFUSED'];
const TONE: Record<VisaStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { NOT_STARTED: 'neutral', PREPARING: 'primary', SUBMITTED: 'primary', APPROVED: 'success', REFUSED: 'danger' };
const NEXT_STATUS: Record<ChecklistItemStatus, ChecklistItemStatus> = { PENDING: 'DONE', DONE: 'NOT_APPLICABLE', NOT_APPLICABLE: 'PENDING' };

interface DetailsForm { visaCenter: string; referenceNumber: string; submissionDate: string; appointmentDate: string }

function VisaChecklist({ visaFileId }: { visaFileId: string }) {
  const t = useTranslations('candidates');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [label, setLabel] = useState('');

  const query = useQuery({ queryKey: ['visa-files', visaFileId, 'checklist'], queryFn: () => api<ChecklistItem[]>(`/visa-files/${visaFileId}/checklist`) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['visa-files', visaFileId, 'checklist'] });

  const create = useMutation({
    mutationFn: () => api(`/visa-files/${visaFileId}/checklist`, { method: 'POST', body: { label } }),
    onSuccess: () => { setLabel(''); void invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const cycle = useMutation({
    mutationFn: (item: ChecklistItem) => api(`/checklist/${item.id}`, { method: 'PATCH', body: { status: NEXT_STATUS[item.status] } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/checklist/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];
  const done = items.filter((i) => i.status === 'DONE').length;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('visaChecklist')} ({done}/{items.length})</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => can('visa.manage') && cycle.mutate(item)}
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                item.status === 'DONE' && 'border-success bg-success text-white',
                item.status === 'PENDING' && 'border-border',
                item.status === 'NOT_APPLICABLE' && 'border-border bg-muted text-muted-foreground',
              )}
              aria-label={t(`checklistStatuses.${item.status}`)}
            >
              {item.status === 'DONE' ? '✓' : item.status === 'NOT_APPLICABLE' ? '–' : ''}
            </button>
            <span className={cn('flex-1 text-sm', item.status === 'NOT_APPLICABLE' && 'text-muted-foreground line-through')}>{item.label}</span>
            {can('visa.manage') && (
              <Button variant="ghost" size="icon" aria-label={t('deleteItem')} onClick={() => remove.mutate(item.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {can('visa.manage') && (
        <div className="mt-2 flex gap-2">
          <Input className="h-8 text-sm" placeholder={t('checklistPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button size="sm" disabled={!label.trim()} loading={create.isPending} onClick={() => create.mutate()}>{t('addAction')}</Button>
        </div>
      )}
    </div>
  );
}

export function VisaTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisaFile | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ country: string }>();
  const detailsForm = useForm<DetailsForm>();

  const query = useQuery({ queryKey: ['candidates', candidateId, 'visa'], queryFn: () => api<VisaFile[]>(`/candidates/${candidateId}/visa-files`) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'visa'] });

  const create = useMutation({
    mutationFn: (v: { country: string }) => api(`/candidates/${candidateId}/visa-files`, { method: 'POST', body: v }),
    onSuccess: () => { void invalidate(); setOpen(false); toast.success(t('visaFileCreatedWithChecklist')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VisaStatus }) => api(`/visa-files/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const saveDetails = useMutation({
    mutationFn: (v: DetailsForm) =>
      api(`/visa-files/${editing!.id}`, {
        method: 'PATCH',
        body: { visaCenter: v.visaCenter || undefined, referenceNumber: v.referenceNumber || undefined, submissionDate: v.submissionDate || undefined, appointmentDate: v.appointmentDate || undefined },
      }),
    onSuccess: () => { void invalidate(); setEditing(null); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      {can('visa.manage') && (
        <div className="flex justify-end">
          <Button onClick={() => { reset({ country: '' }); setOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('newVisaFile')}</Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyVisa')} />
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{v.country}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    {v.visaCenter && <span>{t('visaCenter')} : {v.visaCenter}</span>}
                    {v.referenceNumber && <span dir="ltr">{t('referenceNumber')} : {v.referenceNumber}</span>}
                    {v.submissionDate && <span>{t('submissionDate')} : {formatDateTime(v.submissionDate, locale)}</span>}
                    {v.appointmentDate && <span>{t('appointment')} : {formatDateTime(v.appointmentDate, locale)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {can('visa.manage') ? (
                    <Select className="w-auto" aria-label={t('status')} value={v.status} onChange={(e) => setStatus.mutate({ id: v.id, status: e.target.value as VisaStatus })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{t(`visaStatuses.${s}`)}</option>)}
                    </Select>
                  ) : (
                    <Badge tone={TONE[v.status]}>{t(`visaStatuses.${v.status}`)}</Badge>
                  )}
                  {can('visa.manage') && (
                    <Button
                      variant="ghost" size="icon" aria-label={tc('edit')}
                      onClick={() => {
                        setEditing(v);
                        detailsForm.reset({
                          visaCenter: v.visaCenter ?? '', referenceNumber: v.referenceNumber ?? '',
                          submissionDate: v.submissionDate?.slice(0, 10) ?? '', appointmentDate: v.appointmentDate?.slice(0, 16) ?? '',
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
              <VisaChecklist visaFileId={v.id} />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={t('newVisaFile')} description={t('newVisaFileHint')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('country')} htmlFor="v-country" error={errors.country?.message}>
            <Input id="v-country" aria-invalid={!!errors.country} {...register('country', { required: tc('required') })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={t('visaDetails')}>
        <form onSubmit={detailsForm.handleSubmit((v) => saveDetails.mutate(v))} noValidate className="space-y-4">
          <Field label={t('visaCenter')} htmlFor="v-center"><Input id="v-center" {...detailsForm.register('visaCenter')} /></Field>
          <Field label={t('referenceNumber')} htmlFor="v-ref"><Input id="v-ref" dir="ltr" {...detailsForm.register('referenceNumber')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('submissionDate')} htmlFor="v-submission"><Input id="v-submission" type="date" dir="ltr" {...detailsForm.register('submissionDate')} /></Field>
            <Field label={t('appointment')} htmlFor="v-appt"><Input id="v-appt" type="datetime-local" dir="ltr" {...detailsForm.register('appointmentDate')} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>{tc('cancel')}</Button>
            <Button type="submit" loading={saveDetails.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
