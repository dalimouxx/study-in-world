import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))', soft: 'hsl(var(--primary-soft))' },
        accent: 'hsl(var(--accent))',
        destructive: { DEFAULT: 'hsl(var(--destructive))', soft: 'hsl(var(--destructive-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        navy: 'hsl(var(--navy))',
        'sw-sky': 'hsl(var(--sw-sky))',
        'sw-bg-light': 'hsl(var(--sw-bg-light))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        handwritten: ['var(--font-handwritten)', 'cursive'],
      },
      borderRadius: { md: '0.5rem', lg: '0.875rem', organic: '1.75rem' },
    },
  },
  plugins: [],
};

export default config;
