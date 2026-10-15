'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
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
  name: string; flagEmoji: string; imageUrl: string; description: string; languages: string;
  advantages: string; costOfLiving: string; tuitionFeesInfo: string; universitySystem: string;
  admissionConditions: string; languageLevel: string; applicationProcess: string; documentsInfo: string;
  calendarInfo: string; visaInfo: string; housingInfo: string; insuranceInfo: string;
  studentWorkInfo: string; transportInfo: string; faq: string;
}

const EMPTY: FormValues = {
  name: '', flagEmoji: '', imageUrl: '', description: '', languages: '', advantages: '', costOfLiving: '',
  tuitionFeesInfo: '', universitySystem: '', admissionConditions: '', languageLevel: '', applicationProcess: '',
  documentsInfo: '', calendarInfo: '', visaInfo: '', housingInfo: '', insuranceInfo: '', studentWorkInfo: '',
  transportInfo: '', faq: '',
};

/** Champs texte que le brouillon IA peut remplir (voir /countries/ai-draft côté API). */
const AI_FIELDS = [
  'description', 'universitySystem', 'advantages', 'costOfLiving', 'tuitionFeesInfo', 'languages',
  'admissionConditions', 'languageLevel', 'applicationProcess', 'visaInfo', 'housingInfo',
  'insuranceInfo', 'studentWorkInfo', 'transportInfo', 'calendarInfo', 'documentsInfo', 'faq',
] as const satisfies readonly (keyof FormValues)[];

export function CountriesTab() {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState<Country | null>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({ defaultValues: EMPTY });

  const list = useQuery({ queryKey: ['catalog', 'countries'], queryFn: () => api<Paginated<Country>>('/countries', { query: { pageSize: 100, includeInactive: true } }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog', 'countries'] });

  useEffect(() => {
    if (formOpen) {
      reset(editing ? {
        ...EMPTY,
        name: editing.name, flagEmoji: editing.flagEmoji ?? '', imageUrl: editing.imageUrl ?? '',
        description: editing.description ?? '', languages: editing.languages ?? '', advantages: editing.advantages ?? '',
        costOfLiving: editing.costOfLiving ?? '', tuitionFeesInfo: editing.tuitionFeesInfo ?? '',
        universitySystem: editing.universitySystem ?? '', admissionConditions: editing.admissionConditions ?? '',
        languageLevel: editing.languageLevel ?? '', applicationProcess: editing.applicationProcess ?? '',
        documentsInfo: editing.documentsInfo ?? '', calendarInfo: editing.calendarInfo ?? '',
        visaInfo: editing.visaInfo ?? '', housingInfo: editing.housingInfo ?? '', insuranceInfo: editing.insuranceInfo ?? '',
        studentWorkInfo: editing.studentWorkInfo ?? '', transportInfo: editing.transportInfo ?? '', faq: editing.faq ?? '',
      } : EMPTY);
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
  const aiDraft = useMutation({
    mutationFn: (name: string) => api<Record<string, string>>('/countries/ai-draft', { method: 'POST', body: { name } }),
    onSuccess: (data) => {
      for (const field of AI_FIELDS) {
        const value = data[field];
        if (value) setValue(field, value);
      }
      toast.success(t('aiGenerateSuccess'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = list.data?.items ?? [];
  const name = watch('name');

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

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editCountry') : t('newCountry')} className="max-w-2xl">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-5">
          <div className="flex items-end justify-between gap-4 rounded-md border border-dashed border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('aiGenerateHint')}</p>
            <Button
              type="button" variant="secondary" size="sm" loading={aiDraft.isPending}
              disabled={!name?.trim()}
              title={!name?.trim() ? t('aiGenerateNameRequired') : undefined}
              onClick={() => aiDraft.mutate(name.trim())}
            >
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />{t('aiGenerate')}
            </Button>
          </div>

          <h3 className="text-sm font-semibold text-muted-foreground">{t('sectionGeneral')}</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
            <Field label={t('countryName')} htmlFor="ctry-name"><Input id="ctry-name" {...register('name', { required: true })} /></Field>
            <Field label={t('flag')} htmlFor="ctry-flag" hint="🇮🇹"><Input id="ctry-flag" {...register('flagEmoji')} /></Field>
          </div>
          <Field label={t('imageUrl')} htmlFor="ctry-image"><Input id="ctry-image" dir="ltr" {...register('imageUrl')} /></Field>
          <Field label={t('description')} htmlFor="ctry-desc"><Textarea id="ctry-desc" rows={2} {...register('description')} /></Field>
          <Field label={t('languages')} htmlFor="ctry-lang"><Input id="ctry-lang" {...register('languages')} /></Field>
          <Field label={t('advantages')} htmlFor="ctry-adv"><Textarea id="ctry-adv" rows={2} {...register('advantages')} /></Field>

          <h3 className="text-sm font-semibold text-muted-foreground">{t('sectionStudies')}</h3>
          <Field label={t('universitySystem')} htmlFor="ctry-sys"><Textarea id="ctry-sys" rows={2} {...register('universitySystem')} /></Field>
          <Field label={t('admissionConditions')} htmlFor="ctry-adm"><Textarea id="ctry-adm" rows={2} {...register('admissionConditions')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('languageLevel')} htmlFor="ctry-lvl"><Input id="ctry-lvl" {...register('languageLevel')} /></Field>
            <Field label={t('tuitionFeesInfo')} htmlFor="ctry-tuition"><Input id="ctry-tuition" {...register('tuitionFeesInfo')} /></Field>
          </div>
          <Field label={t('applicationProcess')} htmlFor="ctry-proc"><Textarea id="ctry-proc" rows={2} {...register('applicationProcess')} /></Field>
          <Field label={t('documentsInfo')} htmlFor="ctry-docs"><Textarea id="ctry-docs" rows={2} {...register('documentsInfo')} /></Field>
          <Field label={t('calendarInfo')} htmlFor="ctry-cal"><Textarea id="ctry-cal" rows={2} {...register('calendarInfo')} /></Field>

          <h3 className="text-sm font-semibold text-muted-foreground">{t('sectionPracticalLife')}</h3>
          <Field label={t('costOfLiving')} htmlFor="ctry-cost"><Textarea id="ctry-cost" rows={2} {...register('costOfLiving')} /></Field>
          <Field label={t('housingInfo')} htmlFor="ctry-housing"><Textarea id="ctry-housing" rows={2} {...register('housingInfo')} /></Field>
          <Field label={t('insuranceInfo')} htmlFor="ctry-ins"><Textarea id="ctry-ins" rows={2} {...register('insuranceInfo')} /></Field>
          <Field label={t('studentWorkInfo')} htmlFor="ctry-work"><Textarea id="ctry-work" rows={2} {...register('studentWorkInfo')} /></Field>
          <Field label={t('transportInfo')} htmlFor="ctry-transport"><Textarea id="ctry-transport" rows={2} {...register('transportInfo')} /></Field>

          <h3 className="text-sm font-semibold text-muted-foreground">{t('sectionVisa')}</h3>
          <Field label={t('visaInfo')} htmlFor="ctry-visa"><Textarea id="ctry-visa" rows={2} {...register('visaInfo')} /></Field>

          <h3 className="text-sm font-semibold text-muted-foreground">{t('sectionFaq')}</h3>
          <Field label={t('faq')} htmlFor="ctry-faq"><Textarea id="ctry-faq" rows={3} {...register('faq')} /></Field>

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
