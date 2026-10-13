'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Message } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

export function MessagesTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [content, setContent] = useState('');
  const [draftOpen, setDraftOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({ queryKey: ['candidates', candidateId, 'messages'], queryFn: () => api<Message[]>(`/candidates/${candidateId}/messages`) });

  useEffect(() => {
    void api(`/candidates/${candidateId}/messages/read`, { method: 'POST' });
  }, [candidateId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [query.data]);

  const send = useMutation({
    mutationFn: () => api(`/candidates/${candidateId}/messages`, { method: 'POST', body: { content } }),
    onSuccess: () => {
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'messages'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const draft = useMutation({
    mutationFn: () => api<{ text: string }>(`/candidates/${candidateId}/ai/draft-message`, { method: 'POST', body: { instruction } }),
    onSuccess: (res) => { setContent(res.text); setDraftOpen(false); setInstruction(''); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border border-border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {query.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('emptyMessages')}</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className={cn('flex', m.sender === 'STAFF' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] rounded-lg px-3 py-2 text-sm', m.sender === 'STAFF' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                <p>{m.content}</p>
                <p className={cn('mt-1 text-[11px]', m.sender === 'STAFF' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{formatDateTime(m.createdAt, locale)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {can('candidate.manage') && (
        <div className="flex items-end gap-2 border-t border-border p-3">
          <Button variant="ghost" size="icon" aria-label={t('aiDraft')} onClick={() => setDraftOpen(true)}>
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          </Button>
          <Textarea rows={2} className="flex-1" placeholder={t('messagePlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} />
          <Button disabled={!content.trim()} loading={send.isPending} onClick={() => send.mutate()}>
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        </div>
      )}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen} title={t('aiDraftTitle')} description={t('aiDraftHint')}>
        <div className="space-y-4">
          <Field label={t('aiDraftInstruction')} htmlFor="draft-instruction">
            <Input id="draft-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t('aiDraftPlaceholder')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDraftOpen(false)}>{tc('cancel')}</Button>
            <Button disabled={!instruction.trim()} loading={draft.isPending} onClick={() => draft.mutate()}>{t('aiDraftGenerate')}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
