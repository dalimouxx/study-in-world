import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lève légèrement la carte au survol avec une ombre plus marquée — réservé aux cartes cliquables (liens, listes). */
  hoverable?: boolean;
}

export function Card({ className, hoverable, ...p }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm shadow-black/[0.03] transition-all duration-200',
        hoverable && 'hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md hover:shadow-primary/[0.08]',
        className,
      )}
      {...p}
    />
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
