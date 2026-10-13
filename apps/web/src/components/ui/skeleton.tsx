import { cn } from '@/lib/utils';

/** Bloc de base : un rectangle qui pulse doucement, pour indiquer un contenu en cours de chargement. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

/** Remplace une liste de lignes de tableau pendant le chargement (mêmes colonnes qu'un <Table>). */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Remplace une grille de cartes-chiffres (tableaux de bord) pendant le chargement. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Remplace une liste de cartes verticales (portails, tâches, rendez-vous…) pendant le chargement. */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
