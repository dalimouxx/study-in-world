'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { PermissionDef, Role } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

export function RolesPage() {
  return (
    <RequirePermission permission="role.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('roles');
  const tp = useTranslations('permissions');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const canManage = can('role.manage');
  const isSuper = user?.roleCode === 'SUPER_ADMIN';

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<Role[]>('/roles') });
  const catalog = useQuery({ queryKey: ['permissions'], queryFn: () => api<PermissionDef[]>('/roles/permissions'), staleTime: 5 * 60_000 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selected = roles.data?.find((r) => r.id === selectedId) ?? roles.data?.[0] ?? null;

  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected?.id, selected?.permissions.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of catalog.data ?? []) map.set(p.module, [...(map.get(p.module) ?? []), p]);
    return [...map.entries()];
  }, [catalog.data]);

  const readOnly = !canManage || selected?.code === 'SUPER_ADMIN';
  const dirty = !!selected && (draft.size !== selected.permissions.length || selected.permissions.some((p) => !draft.has(p)));
  const label = (ns: 'modules' | 'actions', key: string) => (tp.has(`${ns}.${key}`) ? tp(`${ns}.${key}`) : key);

  const save = useMutation({
    mutationFn: () => api(`/roles/${selected!.id}/permissions`, { method: 'PUT', body: { permissions: [...draft] } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(t('saved'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/roles/${selected!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(t('deleted'));
      setDeleting(false);
      setSelectedId(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleting(false);
    },
  });

  const toggle = (code: string) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={canManage && (
          <Button className="!rounded-full" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('new')}
          </Button>
        )}
      />

      <FadeIn>
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="self-start p-2">
          <ul aria-label={t('title')}>
            {(roles.data ?? []).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  aria-current={selected?.id === r.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-full px-3.5 py-2.5 text-start text-sm transition-all duration-200',
                    selected?.id === r.id ? 'bg-primary font-medium text-white shadow-sm shadow-primary/25' : 'text-foreground/75 hover:bg-primary-soft hover:text-primary',
                  )}
                >
                  <span className="truncate">{r.name}</span>
                  <span className={cn('shrink-0 text-xs', selected?.id === r.id ? 'text-white/80' : 'text-muted-foreground')}>{t('users', { count: r.userCount })}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {selected && (
          <Card>
            <CardHeader
              title={selected.name}
              description={selected.description ?? undefined}
              action={
                <div className="flex items-center gap-2">
                  {selected.isSystem && <Badge tone="primary">{t('system')}</Badge>}
                  {canManage && !selected.isSystem && (
                    <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(true)}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  )}
                </div>
              }
            />
            {selected.code === 'SUPER_ADMIN' && <p className="border-b border-border bg-muted/50 px-5 py-3 text-sm text-muted-foreground">{t('superAdminNote')}</p>}
            <div className="divide-y divide-border">
              {grouped.map(([module, perms]) => (
                <fieldset key={module} className="grid gap-3 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <legend className="sr-only">{label('modules', module)}</legend>
                  <p className="text-sm font-medium" aria-hidden>{label('modules', module)}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {perms.map((p) => {
                      const cannotGrant = !isSuper && !user?.permissions.includes(p.code);
                      const id = `perm-${p.code}`;
                      return (
                        <label key={p.code} htmlFor={id} className={cn('flex items-center gap-2 text-sm', (readOnly || cannotGrant) && 'opacity-60')}>
                          <input
                            id={id}
                            type="checkbox"
                            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                            checked={selected.code === 'SUPER_ADMIN' || draft.has(p.code)}
                            disabled={readOnly || cannotGrant}
                            onChange={() => toggle(p.code)}
                          />
                          {label('actions', p.action)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            {!readOnly && (
              <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(new Set(selected.permissions))}>{tc('cancel')}</Button>
                <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>{tc('save')}</Button>
              </div>
            )}
          </Card>
        )}
      </div>
      </FadeIn>

      <NewRoleDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setSelectedId(id);
          void queryClient.invalidateQueries({ queryKey: ['roles'] });
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: selected?.name ?? '' })}
        confirmLabel={tc('delete')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function NewRoleDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const t = useTranslations('roles');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; description: string }>();

  useEffect(() => {
    if (open) reset({ name: '', description: '' });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: { name: string; description: string }) =>
      api<{ id: string }>('/roles', { method: 'POST', body: { name: v.name, ...(v.description ? { description: v.description } : {}) } }),
    onSuccess: ({ id }) => {
      toast.success(t('created'));
      onCreated(id);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('newTitle')} description={t('newHint')}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
        <Field label={t('name')} htmlFor="role-name" error={errors.name?.message}>
          <Input id="role-name" aria-invalid={!!errors.name} {...register('name', { required: tc('required'), minLength: { value: 2, message: tc('required') } })} />
        </Field>
        <Field label={t('description')} htmlFor="role-desc">
          <Textarea id="role-desc" rows={3} {...register('description')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={create.isPending}>{tc('create')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
