import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const dateLocale = (locale: string) => (locale === 'ar' ? 'ar-TN' : 'fr-TN');

export function formatDateTime(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date(value));
}

/**
 * Lien WhatsApp direct (section 56) : ouvre WhatsApp avec un message prérempli, sans intégration d'API — aucune
 * dépendance externe, fonctionne pour n'importe quel numéro tel que saisi dans le CRM.
 */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  const qs = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${qs}`;
}
