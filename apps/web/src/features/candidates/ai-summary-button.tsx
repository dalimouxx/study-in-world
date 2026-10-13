'use client';

import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';

/** Résumé IA (Phase 10) : jamais écrit en base, jamais montré sans que l'employé clique explicitement. */
export function AiSummaryButton({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);

  const summary = useMutation({
    mutationFn: () => api<{ text: string }>(`/candidates/${candidateId}/ai/summary`),
    onSuccess: () => setOpen(true),
  });

  return (
    <>
      <Button variant="secondary" size="sm" loading={summary.isPending} onClick={() => summary.mutate()}>
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />{t('aiSummary')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t('aiSummaryTitle')}>
        {summary.isError ? (
          <p role="alert" className="text-sm text-destructive">{errorMessage(summary.error)}</p>
        ) : (
          <p className="whitespace-pre-line text-sm">{summary.data?.text}</p>
        )}
      </Dialog>
    </>
  );
}
