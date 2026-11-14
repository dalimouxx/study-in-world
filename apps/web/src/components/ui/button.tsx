import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Bento Pop : contour encre + ombre décalée qui grandit au survol et s'écrase au clic (.pop .pop-hover, globals.css).
const variants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'pop pop-hover bg-primary text-primary-foreground',
        secondary: 'pop pop-hover bg-card text-foreground',
        ghost: 'text-foreground transition-colors hover:bg-primary-soft hover:text-primary',
        danger: 'pop pop-hover bg-destructive text-white',
      },
      size: { md: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' },
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
    <button
      ref={ref}
      type={type}
      data-variant={variant ?? 'primary'}
      className={cn(variants({ variant, size }), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
