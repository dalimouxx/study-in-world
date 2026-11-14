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
        ink: 'hsl(var(--ink))',
        warning: 'hsl(var(--warning))',
        'sw-sky': 'hsl(var(--sw-sky))',
        'sw-bg-light': 'hsl(var(--sw-bg-light))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        // Ancienne classe font-poppins (jamais déclarée jusqu'ici) : désormais alias de la police de titre.
        poppins: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        // Caveat retiré (Bento Pop) : l'alias reste valide jusqu'à la refonte des pages publiques (lot 2).
        handwritten: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
      },
      borderRadius: { md: '0.625rem', lg: '1rem', xl: '1rem', tile: '1.5rem', organic: '1.5rem' },
      borderWidth: { pop: '2px' },
      boxShadow: {
        'pop-sm': 'calc(var(--pop-x) * 3px) 3px 0 hsl(var(--ink))',
        pop: 'calc(var(--pop-x) * 4px) 4px 0 hsl(var(--ink))',
        'pop-lg': 'calc(var(--pop-x) * 7px) 7px 0 hsl(var(--ink))',
        'pop-primary': 'calc(var(--pop-x) * 3px) 3px 0 hsl(var(--primary) / 0.35)',
      },
      keyframes: {
        'pop-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        wiggle: { '0%, 100%': { transform: 'rotate(8deg)' }, '50%': { transform: 'rotate(-4deg) scale(1.06)' } },
        morph: {
          '0%, 100%': { borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%', transform: 'rotate(0deg)' },
          '50%': { borderRadius: '63% 37% 41% 59% / 58% 61% 39% 42%', transform: 'rotate(30deg)' },
        },
        marquee: { to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'pop-in': 'pop-in 220ms cubic-bezier(0.3, 1.4, 0.5, 1)',
        'fade-in': 'fade-in 180ms ease-out',
        wiggle: 'wiggle 2.5s ease-in-out infinite',
        morph: 'morph 8s ease-in-out infinite',
        marquee: 'marquee 24s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
