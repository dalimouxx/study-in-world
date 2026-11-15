import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center rounded-full border-[1.5px] border-ink/15 px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-muted text-foreground',
      primary: 'border-primary/30 bg-primary-soft text-primary',
      success: 'border-success/25 bg-success-soft text-success',
      danger: 'border-destructive/25 bg-destructive-soft text-destructive',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
