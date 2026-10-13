import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const field =
  'w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-destructive';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, 'h-10', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(field, 'min-h-24 py-2', className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(field, 'h-10 pe-8', className)} {...p}>
      {children}
    </select>
  );
});

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Libellé + champ + message d'erreur, relié par aria-describedby. */
export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
