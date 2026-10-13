import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({ locales: ['fr', 'ar'], defaultLocale: 'fr' });
export type Locale = (typeof routing.locales)[number];
export const isRtl = (locale: string) => locale === 'ar';
