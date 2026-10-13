'use client';

import * as D from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

/** Notifications via interrogation régulière (toutes les 30s) plutôt que WebSocket — voir le README. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api<number>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<AppNotification[]>('/notifications'),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const count = unread.data ?? 0;
  const items = list.data ?? [];

  return (
    <D.Root>
      <D.Trigger className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={t('title')}>
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40" />
        <D.Content className="fixed end-4 top-16 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <D.Title className="sr-only">{t('title')}</D.Title>
          <D.Description className="sr-only">{t('title')}</D.Description>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">{t('title')}</span>
            {count > 0 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => markAllRead.mutate()}>
                {t('markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? '/dashboard'}
                  onClick={() => !n.readAt && markRead.mutate(n.id)}
                  className={cn('block border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted', !n.readAt && 'bg-primary-soft/40')}
                >
                  <p className="font-medium text-navy">{n.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt, locale)}</p>
                </Link>
              ))
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
