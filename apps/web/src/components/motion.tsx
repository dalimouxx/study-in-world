'use client';

import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Primitives d'animation Bento Pop, partagées par le site public, l'admin et les portails.
 * Règles (voir le document de conception, §5.4) : entrées courtes (≤ 0,3 s) qui partent d'un état presque
 * visible, ressort pour les interactions, et rien ne bouge si l'utilisateur a demandé moins de mouvement.
 */

export const SPRING = { type: 'spring', stiffness: 400, damping: 22 } as const;

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0.001, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0.001, y: 8 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.28, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}

/** Sens de l'ombre Pop : 1 en LTR, -1 en RTL (lu sur le document, comme --pop-x en CSS). */
function usePopX() {
  const [x, setX] = useState(1);
  useEffect(() => setX(document.documentElement.dir === 'rtl' ? -1 : 1), []);
  return x;
}

/** Enveloppe qui se soulève au survol et s'enfonce au clic, avec un ressort (pour les éléments sans .pop-hover). */
export function PopHover({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const reduce = useReducedMotion();
  const x = usePopX();
  const Comp = as === 'li' ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      whileHover={reduce ? undefined : { x: -3 * x, y: -3 }}
      whileTap={reduce ? undefined : { x: 2 * x, y: 2 }}
      transition={SPRING}
    >
      {children}
    </Comp>
  );
}

/** Chiffre qui défile de 0 jusqu'à sa valeur ; affiche directement la valeur finale si moins de mouvement. */
export function CountUp({ value, durationMs = 900, format }: { value: number; durationMs?: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: durationMs / 1000,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, durationMs, reduce]);

  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 100) / 100;
  return <span className="tabular-nums">{format ? format(rounded) : rounded.toLocaleString()}</span>;
}
