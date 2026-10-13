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
import { Field, Input, Textarea } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Country, Paginated } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

interface FormValues {
  name: string; flagEmoji: string; description: string; advantages: string; costOfLiving: string;
  admissionConditions: string; visaInfo: string; housingInfo: string; languages: string;
}

export function CountriesTab() {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState<Country | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const list = useQuery({ queryKey: ['catalog', 'countries'], queryFn: () => api<Paginated<Country>>('/countries', { query: { pageSize: 100, includeInactive: true } }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog', 'countries'] });

  useEffect(() => {
    if (formOpen) {
      reset(editing ? {
        name: editing.name, flagEmoji: editing.flagEmoji ?? '', description: editing.description ?? '',
        advantages: editing.advantages ?? '', costOfLiving: editing.costOfLiving ?? '', admissionConditions: editing.admissionConditions ?? '',
        visaInfo: editing.visaInfo ?? '', housingInfo: editing.housingInfo ?? '', languages: editing.languages ?? '',
      } : { name: '', flagEmoji: '', description: '', advantages: '', costOfLiving: '', admissionConditions: '', visaInfo: '', housingInfo: '', languages: '' });
    }
  }, [formOpen, editing, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => editing ? api(`/countries/${editing.id}`, { method: 'PATCH', body: v }) : api('/countries', { method: 'POST', body: v }),
    onSuccess: () => { void invalidate(); setFormOpen(false); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/countries/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void invalidate(); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      {can('catalog.manage') && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />{t('newCountry')}</Button>
        </div>
      )}
      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyCountries')} />
      ) : (
        <Table>
          <thead><tr><Th>{t('country')}</Th><Th>{t('universitiesCount')}</Th><Th>{tc('actions')}</Th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <span className="me-2">{c.flagEmoji}</span>{c.name}
                  {!c.isActive && <Badge tone="neutral" className="ms-2">{t('inactive')}</Badge>}
                </Td>
                <Td className="tabular-nums">{c.universities?.length ?? '–'}</Td>
                <Td>
                  {can('catalog.manage') && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => { setEditing(c); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(c)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editCountry') : t('newCountry')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
            <Field label={t('countryName')} htmlFor="ctry-name"><Input id="ctry-name" {...register('name', { required: true })} /></Field>
            <Field label={t('flag')} htmlFor="ctry-flag" hint="🇮🇹"><Input id="ctry-flag" {...register('flagEmoji')} /></Field>
          </div>
          <Field label={t('description')} htmlFor="ctry-desc"><Textarea id="ctry-desc" rows={2} {...register('description')} /></Field>
          <Field label={t('languages')} htmlFor="ctry-lang"><Input id="ctry-lang" {...register('languages')} /></Field>
          <Field label={t('advantages')} htmlFor="ctry-adv"><Textarea id="ctry-adv" rows={2} {...register('advantages')} /></Field>
          <Field label={t('costOfLiving')} htmlFor="ctry-cost"><Textarea id="ctry-cost" rows={2} {...register('costOfLiving')} /></Field>
          <Field label={t('admissionConditions')} htmlFor="ctry-adm"><Textarea id="ctry-adm" rows={2} {...register('admissionConditions')} /></Field>
          <Field label={t('visaInfo')} htmlFor="ctry-visa"><Textarea id="ctry-visa" rows={2} {...register('visaInfo')} /></Field>
          <Field label={t('housingInfo')} htmlFor="ctry-housing"><Textarea id="ctry-housing" rows={2} {...register('housingInfo')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteCountryTitle')} description={t('deleteCountryDescription', { name: deleting?.name ?? '' })}
        confirmLabel={tc('delete')} loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
