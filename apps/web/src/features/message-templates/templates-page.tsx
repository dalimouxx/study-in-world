'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { renderTemplate, TEMPLATE_VARIABLES } from '@/lib/render-template';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

export interface MessageTemplate {
  id: string;
  key: string;
  channel: 'WHATSAPP' | 'EMAIL';
  nameFr: string;
  nameAr: string;
  subjectFr: string | null;
  subjectAr: string | null;
  bodyFr: string;
  bodyAr: string;
  isSystem: boolean;
}

const SAMPLE = {
  prenom: 'Yasmine', nom: 'Ben Ali', date: '17/11/2026', heure: '10:00', lieu: 'Agence de Gabès', pays: 'Malte', montant: '1 200',
  devise: 'TND', facture: 'FAC-2026-0012', document: 'Passeport', raison: 'Photo illisible', agence: 'Study in World', telephone_agence: '+216 75 000 000',
};

export function TemplatesPage() {
  return (
    <RequirePermission permission="settings.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('messageTemplates');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['message-templates'], queryFn: () => api<MessageTemplate[]>('/message-templates') });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = query.data ?? [];
  const selected = list.find((x) => x.id === selectedId) ?? list[0];
  const name = (x: MessageTemplate) => (locale === 'ar' ? x.nameAr : x.nameFr);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      {query.isLoading ? (
        <ListSkeleton count={5} />
      ) : query.isError ? (
        <Card className="p-6 text-sm text-destructive" role="alert">{errorMessage(query.error)}</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <nav aria-label={t('title')} className="space-y-4">
            {([true, false] as const).map((system) => (
              <div key={String(system)}>
                <h2 className="mb-2 font-display text-base font-extrabold text-ink">{system ? t('automatic') : t('free')}</h2>
                <ul className="space-y-2">
                  {list.filter((x) => x.isSystem === system).map((x) => {
                    const active = selected?.id === x.id;
                    const Icon = x.channel === 'EMAIL' ? Mail : MessageCircle;
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(x.id)}
                          aria-current={active ? 'true' : undefined}
                          className={cn('flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-start text-sm font-semibold transition-all', active ? 'border-ink bg-primary text-white shadow-pop-sm' : 'border-border bg-card text-ink hover:border-primary/40 hover:bg-primary-soft')}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{name(x)}</span>
                          <Badge tone={active ? 'neutral' : 'primary'}>{t(`channel${x.channel}`)}</Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          {selected && <Editor key={selected.id} tpl={selected} />}
        </div>
      )}
    </>
  );
}

function Editor({ tpl }: { tpl: MessageTemplate }) {
  const t = useTranslations('messageTemplates');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const readOnly = !can('settings.manage');
  const [v, setV] = useState(tpl);
  const [confirmReset, setConfirmReset] = useState(false);
  const [focused, setFocused] = useState<'bodyFr' | 'bodyAr'>('bodyFr');
  const refs = { bodyFr: useRef<HTMLTextAreaElement>(null), bodyAr: useRef<HTMLTextAreaElement>(null) };
  useEffect(() => setV(tpl), [tpl]);

  const save = useMutation({
    mutationFn: () => api(`/message-templates/${tpl.id}`, {
      method: 'PATCH',
      body: { nameFr: v.nameFr, nameAr: v.nameAr, subjectFr: v.subjectFr || undefined, subjectAr: v.subjectAr || undefined, bodyFr: v.bodyFr, bodyAr: v.bodyAr },
    }),
    onSuccess: () => { toast.success(t('saved')); void queryClient.invalidateQueries({ queryKey: ['message-templates'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reset = useMutation({
    mutationFn: () => api<MessageTemplate>(`/message-templates/${tpl.id}/reset`, { method: 'POST' }),
    onSuccess: () => { toast.success(t('resetDone')); setConfirmReset(false); void queryClient.invalidateQueries({ queryKey: ['message-templates'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  /** Insère `{variable}` à la position du curseur dans le dernier message (FR ou AR) sélectionné. */
  const insert = (name: string) => {
    const el = refs[focused].current;
    const token = `{${name}}`;
    const text = v[focused];
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setV({ ...v, [focused]: text.slice(0, start) + token + text.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  const email = tpl.channel === 'EMAIL';
  return (
    <Card className="space-y-5 p-5">
      {readOnly && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{t('readOnly')}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('nameFr')} htmlFor="tpl-name-fr"><Input id="tpl-name-fr" value={v.nameFr} disabled={readOnly} onChange={(e) => setV({ ...v, nameFr: e.target.value })} /></Field>
        <Field label={t('nameAr')} htmlFor="tpl-name-ar"><Input id="tpl-name-ar" dir="rtl" value={v.nameAr} disabled={readOnly} onChange={(e) => setV({ ...v, nameAr: e.target.value })} /></Field>
        {email && (
          <>
            <Field label={t('subjectFr')} htmlFor="tpl-subject-fr"><Input id="tpl-subject-fr" value={v.subjectFr ?? ''} disabled={readOnly} onChange={(e) => setV({ ...v, subjectFr: e.target.value })} /></Field>
            <Field label={t('subjectAr')} htmlFor="tpl-subject-ar"><Input id="tpl-subject-ar" dir="rtl" value={v.subjectAr ?? ''} disabled={readOnly} onChange={(e) => setV({ ...v, subjectAr: e.target.value })} /></Field>
          </>
        )}
        <Field label={t('bodyFr')} htmlFor="tpl-body-fr">
          <Textarea id="tpl-body-fr" ref={refs.bodyFr} dir="ltr" rows={8} value={v.bodyFr} disabled={readOnly} onFocus={() => setFocused('bodyFr')} onChange={(e) => setV({ ...v, bodyFr: e.target.value })} />
        </Field>
        <Field label={t('bodyAr')} htmlFor="tpl-body-ar">
          <Textarea id="tpl-body-ar" ref={refs.bodyAr} dir="rtl" rows={8} value={v.bodyAr} disabled={readOnly} onFocus={() => setFocused('bodyAr')} onChange={(e) => setV({ ...v, bodyAr: e.target.value })} />
        </Field>
      </div>

      {!readOnly && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{t('variables')}</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((name) => (
              <button key={name} type="button" onClick={() => insert(name)} className="rounded-full border-[1.5px] border-ink/20 bg-primary-soft px-2.5 py-0.5 font-mono text-xs font-semibold text-primary transition-colors hover:border-primary" dir="ltr">
                {`{${name}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="font-display text-base font-extrabold text-ink">{t('preview')}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t('previewHint')}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(['bodyFr', 'bodyAr'] as const).map((k) => (
            <div key={k} dir={k === 'bodyAr' ? 'rtl' : 'ltr'} className="whitespace-pre-wrap break-words rounded-xl border-2 border-success/30 bg-success-soft p-3 text-sm text-ink">
              {renderTemplate(v[k], SAMPLE)}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" aria-hidden />{t('reset')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!v.nameFr.trim() || !v.nameAr.trim() || !v.bodyFr.trim() || !v.bodyAr.trim()}>{t('save')}</Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('resetTitle')}
        description={t('resetDescription')}
        confirmLabel={t('reset')}
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </Card>
  );
}
