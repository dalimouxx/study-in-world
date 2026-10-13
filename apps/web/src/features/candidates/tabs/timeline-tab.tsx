'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Paginated, TimelineEntry } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

const ICON_BY_TYPE: Record<string, string> = {
  NOTE: '📝', CALL: '📞', MEETING: '🤝', EMAIL: '✉️', STATUS_CHANGE: '🔄', DOCUMENT: '📎', SYSTEM: '•',
};

export function TimelineTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [note, setNote] = useState('');

  const query = useQuery({
    queryKey: ['candidates', candidateId, 'timeline'],
    queryFn: () => api<Paginated<TimelineEntry>>(`/candidates/${candidateId}/timeline`, { query: { pageSize: 50 } }),
  });

  const addNote = useMutation({
    mutationFn: () => api(`/candidates/${candidateId}/notes`, { method: 'POST', body: { content: note } }),
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'timeline'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="space-y-4">
      {can('candidate.manage') && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea rows={2} placeholder={t('addNotePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
          <Button disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>{t('addNote')}</Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : !query.data?.items.length ? (
        <p className="text-sm text-muted-foreground">{t('emptyTimeline')}</p>
      ) : (
        <ol className="space-y-3 border-s border-border ps-4">
          {query.data.items.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -start-[21px] top-0.5 flex h-4 w-4 items-center justify-center text-xs">{ICON_BY_TYPE[e.type] ?? '•'}</span>
              <p className="text-sm">{e.content}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.createdAt, locale)}{e.createdByName ? ` · ${e.createdByName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
