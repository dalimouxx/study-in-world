import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25',
        secondary: 'border border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        danger: 'bg-destructive text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md',
      },
      size: { md: 'h-10 px-4', sm: 'h-8 px-3', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, loading, disabled, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(variants({ variant, size }), className)} disabled={disabled || loading} {...rest}>
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
