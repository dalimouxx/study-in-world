'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { portalApi } from '@/lib/portal-api';
import type { Message } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, formatDateTime } from '@/lib/utils';

export function PortalMessagesPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({ queryKey: ['portal', 'messages'], queryFn: () => portalApi<Message[]>('/portal/messages') });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [query.data]);

  const send = useMutation({
    mutationFn: () => portalApi('/portal/messages', { method: 'POST', body: { content } }),
    onSuccess: () => {
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['portal', 'messages'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('messagesTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('messagesSubtitle')}</p>

      <div className="mt-6 flex h-[32rem] flex-col rounded-organic border border-primary/10 bg-white shadow-sm">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {query.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('emptyMessages')}</p>
          ) : (
            items.map((m) => (
              <div key={m.id} className={cn('flex', m.sender === 'CANDIDATE' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', m.sender === 'CANDIDATE' ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-navy')}>
                  <p>{m.content}</p>
                  <p className={cn('mt-1 text-[11px]', m.sender === 'CANDIDATE' ? 'text-primary-foreground/70' : 'text-navy/60')}>{formatDateTime(m.createdAt, locale)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-end gap-2 border-t border-border p-3">
          <Textarea rows={2} className="flex-1" placeholder={t('messagePlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} />
          <Button className="!rounded-full" disabled={!content.trim()} loading={send.isPending} onClick={() => send.mutate()}>
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );
}
