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
import type { Paginated, Program, ProgramLevel, University } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

const LEVELS: ProgramLevel[] = ['LICENCE', 'MASTER', 'DOCTORAT', 'FOUNDATION', 'PREPA', 'FORMATION_PRO', 'FORMATION_PRIVEE', 'FORMATION_PUBLIQUE', 'SEJOUR_LINGUISTIQUE', 'COURS_DE_LANGUE', 'CERTIFICAT'];

interface FormValues {
  universityId: string; name: string; level: ProgramLevel; domain: string; language: string;
  durationMonths: string; tuitionFees: string; currency: string; intake: string; deadline: string;
  minIelts: string; description: string;
}

export function ProgramsTab() {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const universities = useQuery({ queryKey: ['catalog', 'universities'], queryFn: () => api<Paginated<University>>('/universities', { query: { pageSize: 100, includeInactive: true } }) });
  const list = useQuery({ queryKey: ['catalog', 'programs'], queryFn: () => api<Paginated<Program>>('/programs', { query: { pageSize: 100, includeInactive: true } }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog', 'programs'] });

  useEffect(() => {
    if (formOpen) {
      reset(editing ? {
        universityId: editing.universityId, name: editing.name, level: editing.level, domain: editing.domain ?? '',
        language: editing.language ?? '', durationMonths: editing.durationMonths?.toString() ?? '', tuitionFees: editing.tuitionFees?.toString() ?? '',
        currency: editing.currency, intake: editing.intake ?? '', deadline: editing.deadline?.slice(0, 10) ?? '',
        minIelts: editing.minIelts?.toString() ?? '', description: editing.description ?? '',
      } : { universityId: universities.data?.items[0]?.id ?? '', name: '', level: 'MASTER', domain: '', language: '', durationMonths: '', tuitionFees: '', currency: 'EUR', intake: '', deadline: '', minIelts: '', description: '' });
    }
  }, [formOpen, editing, reset, universities.data]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        ...v,
        durationMonths: v.durationMonths ? Number(v.durationMonths) : undefined,
        tuitionFees: v.tuitionFees ? Number(v.tuitionFees) : undefined,
        minIelts: v.minIelts ? Number(v.minIelts) : undefined,
        deadline: v.deadline || undefined,
      };
      return editing ? api(`/programs/${editing.id}`, { method: 'PATCH', body }) : api('/programs', { method: 'POST', body });
    },
    onSuccess: () => { void invalidate(); setFormOpen(false); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/programs/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void invalidate(); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      {can('catalog.manage') && (
        <div className="flex justify-end">
          <Button disabled={!universities.data?.items.length} onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />{t('newProgram')}
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyPrograms')} hint={!universities.data?.items.length ? t('needUniversityFirst') : undefined} />
      ) : (
        <Table>
          <thead><tr><Th>{t('program')}</Th><Th>{t('university')}</Th><Th>{t('level')}</Th><Th>{t('fees')}</Th><Th>{tc('actions')}</Th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <Td>{p.name}{!p.isActive && <Badge tone="neutral" className="ms-2">{t('inactive')}</Badge>}</Td>
                <Td>{p.university?.name ?? '–'}</Td>
                <Td>{t(`levels.${p.level}`)}</Td>
                <Td className="tabular-nums">{p.tuitionFees ? `${p.tuitionFees} ${p.currency}` : '–'}</Td>
                <Td>
                  {can('catalog.manage') && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => { setEditing(p); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(p)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editProgram') : t('newProgram')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('university')} htmlFor="prog-uni">
            <Select id="prog-uni" {...register('universityId', { required: true })}>
              {(universities.data?.items ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.city}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('programName')} htmlFor="prog-name"><Input id="prog-name" {...register('name', { required: true })} /></Field>
            <Field label={t('level')} htmlFor="prog-level">
              <Select id="prog-level" {...register('level')}>
                {LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('domain')} htmlFor="prog-domain"><Input id="prog-domain" {...register('domain')} /></Field>
            <Field label={t('language')} htmlFor="prog-lang"><Input id="prog-lang" {...register('language')} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('durationMonths')} htmlFor="prog-duration"><Input id="prog-duration" type="number" dir="ltr" {...register('durationMonths')} /></Field>
            <Field label={t('fees')} htmlFor="prog-fees"><Input id="prog-fees" type="number" dir="ltr" {...register('tuitionFees')} /></Field>
            <Field label={t('currency')} htmlFor="prog-currency"><Input id="prog-currency" dir="ltr" {...register('currency')} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('intake')} htmlFor="prog-intake"><Input id="prog-intake" {...register('intake')} /></Field>
            <Field label={t('deadline')} htmlFor="prog-deadline"><Input id="prog-deadline" type="date" dir="ltr" {...register('deadline')} /></Field>
            <Field label={t('minIelts')} htmlFor="prog-ielts"><Input id="prog-ielts" type="number" step={0.5} dir="ltr" {...register('minIelts')} /></Field>
          </div>
          <Field label={t('description')} htmlFor="prog-desc"><Textarea id="prog-desc" rows={3} {...register('description')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteProgramTitle')} description={t('deleteProgramDescription', { name: deleting?.name ?? '' })}
        confirmLabel={tc('delete')} loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
