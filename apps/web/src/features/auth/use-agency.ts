'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PublicAgency {
  name: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  footerText: string | null;
}

/** Identité de l'agence (endpoint public) : jamais codée en dur dans les pages. */
export function useAgency() {
  return useQuery({
    queryKey: ['public-agency'],
    queryFn: () => api<PublicAgency>('/public/agency', { auth: false }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
