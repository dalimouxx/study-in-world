'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { ChecklistItem, ChecklistItemStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

const NEXT_STATUS: Record<ChecklistItemStatus, ChecklistItemStatus> = { PENDING: 'DONE', DONE: 'NOT_APPLICABLE', NOT_APPLICABLE: 'PENDING' };

export function ChecklistTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [label, setLabel] = useState('');

  const query = useQuery({ queryKey: ['candidates', candidateId, 'checklist'], queryFn: () => api<ChecklistItem[]>(`/candidates/${candidateId}/checklist`) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'checklist'] });

  const create = useMutation({
    mutationFn: () => api(`/candidates/${candidateId}/checklist`, { method: 'POST', body: { label } }),
    onSuccess: () => { setLabel(''); void invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const cycle = useMutation({
    mutationFn: (item: ChecklistItem) => api(`/checklist/${item.id}`, { method: 'PATCH', body: { status: NEXT_STATUS[item.status] } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/checklist/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      {can('checklist.manage') && (
        <div className="flex gap-2">
          <Input placeholder={t('checklistPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
          <Button disabled={!label.trim()} loading={create.isPending} onClick={() => create.mutate()}>{tc('create')}</Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t('emptyChecklist')} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => can('checklist.manage') && cycle.mutate(item)}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                  item.status === 'DONE' && 'border-success bg-success text-white',
                  item.status === 'PENDING' && 'border-border',
                  item.status === 'NOT_APPLICABLE' && 'border-border bg-muted text-muted-foreground',
                )}
                aria-label={t(`checklistStatuses.${item.status}`)}
              >
                {item.status === 'DONE' ? '✓' : item.status === 'NOT_APPLICABLE' ? '–' : ''}
              </button>
              <span className={cn('flex-1 text-sm', item.status === 'NOT_APPLICABLE' && 'text-muted-foreground line-through')}>{item.label}</span>
              {can('checklist.manage') && (
                <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => remove.mutate(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
