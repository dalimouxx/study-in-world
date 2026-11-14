import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Carte cliquable : style Pop qui se soulève au survol, sur toutes les surfaces. */
  hoverable?: boolean;
  /**
   * Force l'intensité. Sans valeur, elle suit le cadre (data-surface) : Pop complet sur le site public,
   * adouci (contour fin, sans ombre) dans l'admin et les portails.
   */
  variant?: 'pop' | 'soft';
}

export function Card({ className, hoverable, variant, ...p }: CardProps) {
  const style = hoverable || variant === 'pop' ? 'pop' : variant === 'soft' ? 'pop-soft' : 'card-auto';
  return <div className={cn('rounded-tile bg-card', style, hoverable && 'pop-hover cursor-pointer', className)} {...p} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
