'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Prospect, ProspectStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn } from '@/lib/utils';

const COLUMNS: ProspectStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];
const CATEGORY_TONE = { hot: 'danger', warm: 'primary', cold: 'neutral' } as const;

/**
 * Glisser-déposer natif du navigateur (HTML5 draggable), sans bibliothèque supplémentaire : suffisant pour
 * réordonner entre 3 colonnes et évite d'ajouter une dépendance pour un besoin aussi simple.
 */
export function ProspectsBoard() {
  const t = useTranslations('prospects');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ProspectStatus | null>(null);

  const board = useQuery({ queryKey: ['prospects', 'board'], queryFn: () => api<Prospect[]>('/prospects/board') });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) => api(`/prospects/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['prospects'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = board.data ?? [];
  const byColumn = (status: ProspectStatus) => items.filter((p) => p.status === status);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {COLUMNS.map((column) => (
        <div
          key={column}
          onDragOver={(e) => { e.preventDefault(); setOverColumn(column); }}
          onDragLeave={() => setOverColumn((c) => (c === column ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setOverColumn(null);
            const id = e.dataTransfer.getData('text/plain');
            if (id && dragging) move.mutate({ id, status: column });
            setDragging(null);
          }}
          className={cn('flex flex-col gap-3 rounded-tile border-2 border-border bg-muted/60 p-3 transition-colors', overColumn === column && 'border-dashed border-primary bg-primary-soft/60')}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="font-display text-base font-extrabold text-ink">{t(`statuses.${column}`)}</h3>
            <Badge tone="primary">{byColumn(column).length}</Badge>
          </div>
          <div className="flex-1 space-y-2">
            {byColumn(column).map((p) => (
              <Card
                key={p.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setDragging(p.id); }}
                onDragEnd={() => setDragging(null)}
                // Carte en cours de déplacement : penchée et soulevée (purement visuel, la logique de glisser-déposer est inchangée).
                variant="pop"
                className={cn('pop-hover cursor-grab select-none p-3 transition-transform active:cursor-grabbing', dragging === p.id && 'rotate-2 scale-[1.02] opacity-80 shadow-pop-lg')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{p.firstName} {p.lastName}</p>
                  <Badge tone={CATEGORY_TONE[p.category]}>{p.score}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{p.phone}</p>
                {p.desiredCountry && <p className="mt-1 text-xs text-muted-foreground">{p.desiredCountry.flagEmoji} {p.desiredCountry.name}</p>}
                {p.assignedTo && <p className="mt-1 text-xs text-muted-foreground">{p.assignedTo.firstName} {p.assignedTo.lastName}</p>}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
