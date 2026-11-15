'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const COLORS = { primary: 'hsl(var(--primary))', success: 'hsl(var(--success))', destructive: 'hsl(var(--destructive))' };

/**
 * Anneau de progression qui se remplit une seule fois (jamais en boucle : il est posé à côté de données).
 * `value` en pourcentage ; `null` affiche « – ». Sur fond bleu (`tone="onBlue"`), l'anneau passe en blanc.
 */
export function ProgressRing({
  value, size = 88, stroke = 10, label, tone = 'onWhite', color = 'primary',
}: { value: number | null; size?: number; stroke?: number; label: string; tone?: 'onBlue' | 'onWhite'; color?: keyof typeof COLORS }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const track = tone === 'onBlue' ? 'rgb(255 255 255 / 0.25)' : 'hsl(var(--primary-soft))';
  const fill = tone === 'onBlue' ? '#fff' : COLORS[color];

  return (
    <div role="img" aria-label={`${label} : ${value === null ? '–' : `${value} %`}`} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {/* À 0 %, aucun arc : un trait de longueur nulle aux bouts arrondis dessinerait un point isolé. */}
        {value !== null && pct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={{ pathLength: reduce ? pct : 0 }}
            animate={{ pathLength: pct }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
        )}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold tabular-nums', tone === 'onBlue' ? 'text-white' : 'text-ink')}>
        {value === null ? '–' : `${value}%`}
      </span>
    </div>
  );
}
