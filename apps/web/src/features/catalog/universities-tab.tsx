'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Country, Paginated, University } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

interface FormValues {
  countryId: string; name: string; city: string; website: string; email: string; phone: string;
  isPublic: string; description: string; feesInfo: string; applicationsOpen: string;
}

export function UniversitiesTab() {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<University | null>(null);
  const [deleting, setDeleting] = useState<University | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const countries = useQuery({ queryKey: ['catalog', 'countries'], queryFn: () => api<Paginated<Country>>('/countries', { query: { pageSize: 100, includeInactive: true } }) });
  const list = useQuery({ queryKey: ['catalog', 'universities'], queryFn: () => api<Paginated<University>>('/universities', { query: { pageSize: 100, includeInactive: true } }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog', 'universities'] });

  useEffect(() => {
    if (formOpen) {
      reset(editing ? {
        countryId: editing.countryId, name: editing.name, city: editing.city, website: editing.website ?? '',
        email: editing.email ?? '', phone: editing.phone ?? '', isPublic: String(editing.isPublic), description: editing.description ?? '',
        feesInfo: editing.feesInfo ?? '', applicationsOpen: String(editing.applicationsOpen),
      } : { countryId: countries.data?.items[0]?.id ?? '', name: '', city: '', website: '', email: '', phone: '', isPublic: 'true', description: '', feesInfo: '', applicationsOpen: 'true' });
    }
  }, [formOpen, editing, reset, countries.data]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = { ...v, isPublic: v.isPublic === 'true', applicationsOpen: v.applicationsOpen === 'true' };
      return editing ? api(`/universities/${editing.id}`, { method: 'PATCH', body }) : api('/universities', { method: 'POST', body });
    },
    onSuccess: () => { void invalidate(); setFormOpen(false); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/universities/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void invalidate(); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      {can('catalog.manage') && (
        <div className="flex justify-end">
          <Button disabled={!countries.data?.items.length} onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />{t('newUniversity')}
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyUniversities')} hint={!countries.data?.items.length ? t('needCountryFirst') : undefined} />
      ) : (
        <Table>
          <thead><tr><Th>{t('university')}</Th><Th>{t('country')}</Th><Th>{t('city')}</Th><Th>{tc('actions')}</Th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <Td>{u.name}{!u.isActive && <Badge tone="neutral" className="ms-2">{t('inactive')}</Badge>}</Td>
                <Td>{u.country ? `${u.country.flagEmoji ?? ''} ${u.country.name}` : '–'}</Td>
                <Td>{u.city}</Td>
                <Td>
                  {can('catalog.manage') && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => { setEditing(u); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(u)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editUniversity') : t('newUniversity')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('country')} htmlFor="uni-country">
            <Select id="uni-country" {...register('countryId', { required: true })}>
              {(countries.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.flagEmoji} {c.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('universityName')} htmlFor="uni-name"><Input id="uni-name" {...register('name', { required: true })} /></Field>
            <Field label={t('city')} htmlFor="uni-city"><Input id="uni-city" {...register('city', { required: true })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('publicOrPrivate')} htmlFor="uni-public">
              <Select id="uni-public" {...register('isPublic')}>
                <option value="true">{t('public')}</option>
                <option value="false">{t('private')}</option>
              </Select>
            </Field>
            <Field label={t('applicationsOpen')} htmlFor="uni-open">
              <Select id="uni-open" {...register('applicationsOpen')}>
                <option value="true">{tc('yes')}</option>
                <option value="false">{tc('no')}</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('website')} htmlFor="uni-web"><Input id="uni-web" dir="ltr" {...register('website')} /></Field>
            <Field label={t('email')} htmlFor="uni-email"><Input id="uni-email" dir="ltr" {...register('email')} /></Field>
          </div>
          <Field label={t('description')} htmlFor="uni-desc"><Textarea id="uni-desc" rows={2} {...register('description')} /></Field>
          <Field label={t('feesInfo')} htmlFor="uni-fees"><Textarea id="uni-fees" rows={2} {...register('feesInfo')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteUniversityTitle')} description={t('deleteUniversityDescription', { name: deleting?.name ?? '' })}
        confirmLabel={tc('delete')} loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
