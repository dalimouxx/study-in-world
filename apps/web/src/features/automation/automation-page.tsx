'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { AutomationActionType, AutomationRule, AutomationTrigger } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

const TRIGGERS: AutomationTrigger[] = ['APPLICATION_STATUS_CHANGED', 'VISA_STATUS_CHANGED', 'DOCUMENT_REJECTED', 'CANDIDATE_STATUS_CHANGED'];
const ACTION_TYPES: AutomationActionType[] = ['CREATE_TASK', 'ADD_CHECKLIST_ITEM', 'TIMELINE_NOTE'];

const VALUE_OPTIONS: Record<AutomationTrigger, string[] | null> = {
  APPLICATION_STATUS_CHANGED: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'],
  VISA_STATUS_CHANGED: ['NOT_STARTED', 'PREPARING', 'SUBMITTED', 'APPROVED', 'REFUSED'],
  CANDIDATE_STATUS_CHANGED: ['ACTIVE', 'ON_HOLD', 'ARCHIVED'],
  DOCUMENT_REJECTED: null,
};

interface ActionForm { type: AutomationActionType; title: string; daysOffset: string; label: string; content: string }
interface FormValues { name: string; trigger: AutomationTrigger; triggerValue: string; actions: ActionForm[] }

export function AutomationPage() {
  return (
    <RequirePermission permission="automation.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('automation');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  const { register, control, handleSubmit, reset, watch } = useForm<FormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'actions' });
  const trigger = watch('trigger');
  const valueOptions = VALUE_OPTIONS[trigger];

  const list = useQuery({ queryKey: ['automation-rules'], queryFn: () => api<AutomationRule[]>('/automation-rules') });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] });

  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      reset({
        name: editing.name,
        trigger: editing.trigger,
        triggerValue: editing.triggerValue ?? '',
        actions: editing.actions.map((a) => ({
          type: a.type,
          title: (a.config.title as string) ?? '',
          daysOffset: a.config.daysOffset != null ? String(a.config.daysOffset) : '',
          label: (a.config.label as string) ?? '',
          content: (a.config.content as string) ?? '',
        })),
      });
    } else {
      reset({ name: '', trigger: 'APPLICATION_STATUS_CHANGED', triggerValue: '', actions: [{ type: 'CREATE_TASK', title: '', daysOffset: '', label: '', content: '' }] });
    }
  }, [formOpen, editing, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        name: v.name,
        trigger: v.trigger,
        triggerValue: v.triggerValue || undefined,
        actions: v.actions.map((a) => ({
          type: a.type,
          config:
            a.type === 'CREATE_TASK' ? { title: a.title, daysOffset: a.daysOffset ? Number(a.daysOffset) : undefined }
            : a.type === 'ADD_CHECKLIST_ITEM' ? { label: a.label }
            : { content: a.content },
        })),
      };
      return editing ? api(`/automation-rules/${editing.id}`, { method: 'PATCH', body }) : api('/automation-rules', { method: 'POST', body });
    },
    onSuccess: () => { void invalidate(); setFormOpen(false); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const toggleActive = useMutation({
    mutationFn: (rule: AutomationRule) => api(`/automation-rules/${rule.id}`, { method: 'PATCH', body: { isActive: !rule.isActive } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove_ = useMutation({
    mutationFn: (id: string) => api(`/automation-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void invalidate(); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const items = list.data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={can('automation.manage') && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('newRule')}</Button>}
      />

      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} hint={t('emptyHint')} />
      ) : (
        <div className="space-y-3">
          {items.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    <Badge tone={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? t('active') : t('inactive')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('when')} {t(`triggers.${rule.trigger}`)}
                    {rule.triggerValue && <> = <strong>{rule.triggerValue}</strong></>}
                    {' → '}
                    {rule.actions.map((a) => t(`actionTypes.${a.type}`)).join(', ')}
                  </p>
                </div>
                {can('automation.manage') && (
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => toggleActive.mutate(rule)}>{rule.isActive ? t('deactivate') : t('activate')}</Button>
                    <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => { setEditing(rule); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(rule)}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editRule') : t('newRule')} className="max-w-2xl">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('ruleName')} htmlFor="rule-name"><Input id="rule-name" {...register('name', { required: true })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('trigger')} htmlFor="rule-trigger">
              <Select id="rule-trigger" {...register('trigger')}>
                {TRIGGERS.map((tr) => <option key={tr} value={tr}>{t(`triggers.${tr}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('triggerValue')} htmlFor="rule-value" hint={t('triggerValueHint')}>
              {valueOptions ? (
                <Select id="rule-value" {...register('triggerValue')}>
                  <option value="">{t('anyValue')}</option>
                  {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              ) : (
                <Input id="rule-value" disabled placeholder={t('noValueNeeded')} />
              )}
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('actions')}</p>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <Card key={f.id} className="space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <Select className="flex-1" aria-label={t('actionType')} {...register(`actions.${i}.type`)}>
                      {ACTION_TYPES.map((at) => <option key={at} value={at}>{t(`actionTypes.${at}`)}</option>)}
                    </Select>
                    <Button type="button" variant="ghost" size="icon" aria-label={tc('delete')} disabled={fields.length <= 1} onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                  {watch(`actions.${i}.type`) === 'CREATE_TASK' && (
                    <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                      <Input placeholder={t('taskTitlePlaceholder')} {...register(`actions.${i}.title`)} />
                      <Input type="number" dir="ltr" placeholder={t('daysOffsetPlaceholder')} {...register(`actions.${i}.daysOffset`)} />
                    </div>
                  )}
                  {watch(`actions.${i}.type`) === 'ADD_CHECKLIST_ITEM' && (
                    <Input placeholder={t('checklistLabelPlaceholder')} {...register(`actions.${i}.label`)} />
                  )}
                  {watch(`actions.${i}.type`) === 'TIMELINE_NOTE' && (
                    <Input placeholder={t('noteContentPlaceholder')} {...register(`actions.${i}.content`)} />
                  )}
                </Card>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => append({ type: 'CREATE_TASK', title: '', daysOffset: '', label: '', content: '' })}>
              {t('addAction')}
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteRuleTitle')} description={t('deleteRuleDescription', { name: deleting?.name ?? '' })}
        confirmLabel={tc('delete')} loading={remove_.isPending}
        onConfirm={() => deleting && remove_.mutate(deleting.id)}
      />
    </>
  );
}
