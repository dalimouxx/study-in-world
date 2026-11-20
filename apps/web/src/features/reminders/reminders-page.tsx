'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, FileWarning, MessageCircle, Plane, Receipt, UserPlus, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { buildWhatsappUrl } from '@/lib/reminder-text';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';
import { NextFollowUpDialog } from './next-follow-up-dialog';
import type { ReminderKind, TodayReminder, TodayResponse } from './types';

const ICON: Record<ReminderKind, LucideIcon> = {
  APPOINTMENT_TOMORROW: CalendarClock,
  VISA_APPOINTMENT_TOMORROW: Plane,
  PROSPECT_FOLLOW_UP: UserPlus,
  INVOICE_OVERDUE: Receipt,
  DOCUMENT_REJECTED: FileWarning,
};

const fileHref = (r: TodayReminder) => (r.target.type === 'CANDIDATE' ? (`/candidates/${r.target.id}` as const) : ('/prospects' as const));

export function RemindersPage() {
  const t = useTranslations('reminders');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [followUpFor, setFollowUpFor] = useState<TodayReminder | null>(null);

  const query = useQuery({ queryKey: ['reminders', 'today', scope], queryFn: () => api<TodayResponse>('/reminders/today', { query: { scope } }) });

  const done = useMutation({
    mutationFn: (body: { key: string; nextFollowUpAt?: string | null }) => api('/reminders/done', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['reminders'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const sendWhatsapp = (r: TodayReminder) => {
    const url = buildWhatsappUrl(r.target.phone, r.whatsappText);
    if (!url) return;
    // Ouvert immédiatement dans le geste de l'utilisateur (sinon le navigateur bloque la fenêtre).
    window.open(url, '_blank', 'noopener');
    if (r.kind === 'PROSPECT_FOLLOW_UP') setFollowUpFor(r);
    else done.mutate({ key: r.key });
  };

  const data = query.data;
  const mineToDo = data?.items.filter((r) => !r.unassigned) ?? [];
  const unassigned = data?.items.filter((r) => r.unassigned) ?? [];
  const todo = (data?.items.length ?? 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant={scope === 'mine' ? 'primary' : 'secondary'} onClick={() => setScope('mine')}>{t('mine')}</Button>
            <Button size="sm" variant={scope === 'all' ? 'primary' : 'secondary'} onClick={() => setScope('all')}>{t('all')}</Button>
          </div>
        }
      />

      {query.isLoading ? (
        <ListSkeleton count={4} />
      ) : query.isError ? (
        <Card className="p-6 text-sm text-destructive" role="alert">{errorMessage(query.error)}</Card>
      ) : !todo && !data?.doneToday.length ? (
        <Card><EmptyState icon={BellRing} title={t('empty')} hint={t('emptyHint')} /></Card>
      ) : (
        <div className="space-y-8">
          <p className="font-display text-lg font-extrabold text-ink" aria-live="polite">{t('counts', { todo, done: data?.doneToday.length ?? 0 })}</p>
          {!!mineToDo.length && <Section title={t('toDo')} items={mineToDo} onWhatsapp={sendWhatsapp} pendingKey={done.isPending ? done.variables?.key : undefined} />}
          {!!unassigned.length && <Section title={t('unassigned')} items={unassigned} onWhatsapp={sendWhatsapp} pendingKey={done.isPending ? done.variables?.key : undefined} />}
          {!!data?.doneToday.length && <Section title={t('doneToday')} items={data.doneToday} done />}
        </div>
      )}

      <NextFollowUpDialog
        open={!!followUpFor}
        loading={done.isPending}
        onOpenChange={(o) => {
          // Fenêtre fermée sans choix : la relance est faite pour aujourd'hui et reviendra demain.
          if (!o && followUpFor) done.mutate({ key: followUpFor.key });
          if (!o) setFollowUpFor(null);
        }}
        onChoose={(date) => {
          if (followUpFor) done.mutate({ key: followUpFor.key, nextFollowUpAt: date });
          setFollowUpFor(null);
        }}
      />
    </>
  );
}

function Section({
  title, items, onWhatsapp, pendingKey, done = false,
}: { title: string; items: TodayReminder[]; onWhatsapp?: (r: TodayReminder) => void; pendingKey?: string; done?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight text-ink">{title}</h2>
      <StaggerGroup className="space-y-3">
        {items.map((r) => (
          <StaggerItem key={r.key}>
            <ReminderRow r={r} onWhatsapp={onWhatsapp} pending={pendingKey === r.key} done={done} />
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

function ReminderRow({ r, onWhatsapp, pending, done }: { r: TodayReminder; onWhatsapp?: (r: TodayReminder) => void; pending: boolean; done: boolean }) {
  const t = useTranslations('reminders');
  const Icon = ICON[r.kind];
  const canSend = !!buildWhatsappUrl(r.target.phone, 'x');
  const auto = r.autoChannel;
  const autoLabel = !auto
    ? null
    : auto.status === 'SENT'
      ? t(auto.channel === 'EMAIL' ? 'auto.EMAIL_SENT' : 'auto.NOTIFICATION_SENT')
      : auto.status === 'FAILED'
        ? t('auto.EMAIL_FAILED')
        : t(auto.error?.includes('SMTP') ? 'auto.EMAIL_SKIPPED_NO_SMTP' : 'auto.EMAIL_SKIPPED_NO_EMAIL');

  return (
    <Card className={cn('flex flex-wrap items-center gap-4 p-4', done && 'opacity-70')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink', done ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary')}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={fileHref(r)} className="font-display text-base font-extrabold text-ink underline-offset-4 hover:underline">{r.target.name}</Link>
          <Badge tone={r.kind === 'INVOICE_OVERDUE' || r.kind === 'DOCUMENT_REJECTED' ? 'danger' : 'primary'}>{t(`kinds.${r.kind}`)}</Badge>
        </div>
        <p className="mt-0.5 break-words text-sm text-muted-foreground">{t(`summary.${r.kind}`, r.summary)}</p>
        {autoLabel && <p className={cn('mt-1 text-xs font-semibold', auto?.status === 'SENT' ? 'text-success' : 'text-muted-foreground')}>{autoLabel}</p>}
      </div>
      {done ? (
        <Badge tone="success">{t('done')}</Badge>
      ) : (
        <Button
          size="sm"
          onClick={() => onWhatsapp?.(r)}
          disabled={!canSend}
          loading={pending}
          title={canSend ? undefined : t('noPhone')}
          aria-label={canSend ? `${t('whatsapp')} — ${r.target.name}` : t('noPhone')}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('whatsapp')}
        </Button>
      )}
    </Card>
  );
}
