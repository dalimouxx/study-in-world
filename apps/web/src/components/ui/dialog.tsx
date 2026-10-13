'use client';

import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, className }: Props) {
  const t = useTranslations('common');
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-navy/50" />
        <D.Content
          className={cn(
            'fixed start-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl ltr:-translate-x-1/2 rtl:translate-x-1/2',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label={t('close')}>
              <X className="h-4 w-4" aria-hidden />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
