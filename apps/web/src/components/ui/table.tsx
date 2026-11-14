import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-start text-sm tabular-nums [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-primary-soft/50', className)} {...p} />
    </div>
  );
}
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn('whitespace-nowrap border-b border-border bg-muted/60 px-4 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', className)} {...p} />
);
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('border-b border-border px-4 py-3 align-middle', className)} {...p} />
);
