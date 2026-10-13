'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Petites animations d'apparition, neutres et réutilisables partout (admin, portails) — contrairement à
 * celles de `features/public/design-system.tsx`, qui portent en plus les styles de l'identité de marque.
 */

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}
