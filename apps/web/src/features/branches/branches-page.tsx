'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Branch } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

export function BranchesPage() {
  return (
    <RequirePermission permission="branch.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('branches');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('branch.manage');
  const [editing, setEditing] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/branches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(t('deleted'));
      setDeleting(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleting(null);
    },
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={canManage && (
          <Button className="!rounded-full" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('new')}
          </Button>
        )}
      />
      <FadeIn>
      <Card>
        {branches.isLoading ? (
          <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : branches.isError ? (
          <EmptyState title={errorMessage(branches.error)} action={<Button variant="secondary" onClick={() => void branches.refetch()}>{tc('retry')}</Button>} />
        ) : (branches.data ?? []).length === 0 ? (
          <EmptyState title={t('empty')} hint={t('emptyHint')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('name')}</Th>
                <Th>{t('code')}</Th>
                <Th>{t('city')}</Th>
                <Th>{t('employees')}</Th>
                <Th>{t('status')}</Th>
                <Th><span className="sr-only">{tc('actions')}</span></Th>
              </tr>
            </thead>
            <tbody>
              {branches.data!.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td dir="ltr" className="text-start font-mono text-xs">{b.code}</Td>
                  <Td>{b.city ?? '–'}</Td>
                  <Td className="tabular-nums">{b.employeeCount}</Td>
                  <Td><Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? t('active') : t('inactive')}</Badge></Td>
                  <Td>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`${tc('edit')} ${b.name}`} onClick={() => { setEditing(b); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${tc('delete')} ${b.name}`} onClick={() => setDeleting(b)}>
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      </FadeIn>

      <BranchFormDialog open={formOpen} onOpenChange={setFormOpen} branch={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: deleting?.name ?? '' })}
        confirmLabel={tc('delete')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

interface Values {
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

function BranchFormDialog({ open, onOpenChange, branch }: { open: boolean; onOpenChange: (o: boolean) => void; branch: Branch | null }) {
  const t = useTranslations('branches');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const schema = z.object({
    name: z.string().trim().min(2, tc('required')),
    code: z.string().regex(/^[A-Z0-9]{2,10}$/, t('codeRule')),
    city: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string().refine((v) => v === '' || z.string().email().safeParse(v).success, ta('emailInvalid')),
    isActive: z.boolean(),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: branch?.name ?? '',
        code: branch?.code ?? '',
        city: branch?.city ?? '',
        address: branch?.address ?? '',
        phone: branch?.phone ?? '',
        email: branch?.email ?? '',
        isActive: branch?.isActive ?? true,
      });
    }
  }, [open, branch, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, code: v.code.toUpperCase() };
      // Champs texte vides : omis à la création ; envoyés vides à la modification pour permettre l'effacement.
      const cleaned = branch ? body : Object.fromEntries(Object.entries(body).filter(([, x]) => x !== ''));
      return api(branch ? `/branches/${branch.id}` : '/branches', { method: branch ? 'PATCH' : 'POST', body: cleaned });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(branch ? t('updated') : t('created'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={branch ? t('editTitle') : t('newTitle')}>
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field label={t('name')} htmlFor="b-name" error={errors.name?.message}>
            <Input id="b-name" aria-invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label={t('code')} htmlFor="b-code" error={errors.code?.message}>
            <Input id="b-code" dir="ltr" className="uppercase" aria-invalid={!!errors.code} {...register('code')} />
          </Field>
        </div>
        <Field label={t('city')} htmlFor="b-city">
          <Input id="b-city" {...register('city')} />
        </Field>
        <Field label={t('address')} htmlFor="b-address">
          <Input id="b-address" {...register('address')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} htmlFor="b-phone">
            <Input id="b-phone" type="tel" dir="ltr" {...register('phone')} />
          </Field>
          <Field label={t('email')} htmlFor="b-email" error={errors.email?.message}>
            <Input id="b-email" type="email" dir="ltr" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" {...register('isActive')} />
          {t('active')}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
