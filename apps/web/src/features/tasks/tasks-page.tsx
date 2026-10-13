'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Paginated, Task, TaskPriority } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'primary' | 'danger'> = { LOW: 'neutral', MEDIUM: 'primary', HIGH: 'danger' };

export function TasksPage() {
  return (
    <RequirePermission permission="task.view">
      <Content />
    </RequirePermission>
  );
}

interface FormValues { title: string; description: string; dueDate: string; priority: TaskPriority }

function Content() {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [mineOnly, setMineOnly] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const list = useQuery({
    queryKey: ['tasks', { mineOnly }],
    queryFn: () => api<Paginated<Task>>('/tasks', { query: { pageSize: 100, mine: mineOnly ? 'true' : undefined } }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const create = useMutation({
    mutationFn: (v: FormValues) => api('/tasks', { method: 'POST', body: { ...v, description: v.description || undefined, dueDate: v.dueDate || undefined } }),
    onSuccess: () => { void invalidate(); setFormOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const toggleDone = useMutation({
    mutationFn: (task: Task) => api(`/tasks/${task.id}`, { method: 'PATCH', body: { status: task.status === 'DONE' ? 'TODO' : 'DONE' } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={can('task.manage') && <Button className="!rounded-full" onClick={() => { reset({ title: '', description: '', dueDate: '', priority: 'MEDIUM' }); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
      />
      <div className="mb-4 flex gap-2">
        <Button variant={mineOnly ? 'primary' : 'secondary'} size="sm" onClick={() => setMineOnly(true)}>{t('mine')}</Button>
        <Button variant={!mineOnly ? 'primary' : 'secondary'} size="sm" onClick={() => setMineOnly(false)}>{t('all')}</Button>
      </div>

      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <StaggerGroup className="space-y-2">
          {items.map((task) => (
            <StaggerItem key={task.id}>
            <Card hoverable className="flex items-start gap-3 p-4">
              <button
                type="button"
                onClick={() => toggleDone.mutate(task)}
                className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors', task.status === 'DONE' ? 'border-success bg-success text-white' : 'border-border hover:border-primary')}
                aria-label={t('toggleDone')}
              >
                {task.status === 'DONE' ? '✓' : ''}
              </button>
              <div className="flex-1">
                <p className={cn('font-medium text-navy', task.status === 'DONE' && 'text-muted-foreground line-through')}>{task.title}</p>
                {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {task.dueDate && <span>{formatDateTime(task.dueDate, locale)}</span>}
                  {task.assignedTo && <span>{task.assignedTo.firstName} {task.assignedTo.lastName}</span>}
                  <Badge tone={PRIORITY_TONE[task.priority]}>{t(`priorities.${task.priority}`)}</Badge>
                </div>
              </div>
              {can('task.manage') && (
                <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => remove.mutate(task.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              )}
            </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={t('newTitle')}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <Field label={t('taskTitle')} htmlFor="task-title" error={errors.title?.message}>
            <Input id="task-title" aria-invalid={!!errors.title} {...register('title', { required: tc('required') })} />
          </Field>
          <Field label={t('description')} htmlFor="task-desc">
            <Textarea id="task-desc" rows={2} {...register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('dueDate')} htmlFor="task-due">
              <Input id="task-due" type="date" dir="ltr" {...register('dueDate')} />
            </Field>
            <Field label={t('priority')} htmlFor="task-priority">
              <Select id="task-priority" {...register('priority')}>
                <option value="LOW">{t('priorities.LOW')}</option>
                <option value="MEDIUM">{t('priorities.MEDIUM')}</option>
                <option value="HIGH">{t('priorities.HIGH')}</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
