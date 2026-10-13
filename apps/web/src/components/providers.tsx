'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/auth-context';

export function Providers({ children, dir }: { children: ReactNode; dir: 'ltr' | 'rtl' }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} dir={dir} richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
