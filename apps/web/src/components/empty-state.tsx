import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ title, hint, action, icon: Icon = Inbox }: { title: string; hint?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border-pop border-ink bg-primary-soft text-primary shadow-pop-sm">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
