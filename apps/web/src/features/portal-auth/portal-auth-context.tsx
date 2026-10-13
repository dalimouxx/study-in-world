'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PortalAuthPayload, portalApi, refreshPortalSession, setPortalAccessToken, setPortalSessionLostHandler,
} from '@/lib/portal-api';
import type { PortalCandidate } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface PortalAuthContext {
  candidate: PortalCandidate | null;
  status: Status;
  login: (email: string, password: string) => Promise<PortalCandidate>;
  logout: () => Promise<void>;
}

const Ctx = createContext<PortalAuthContext | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [candidate, setCandidate] = useState<PortalCandidate | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const clear = useCallback(() => {
    setPortalAccessToken(null);
    setCandidate(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setPortalSessionLostHandler(clear);
    let active = true;
    void refreshPortalSession().then((session) => {
      if (!active) return;
      if (session) {
        setCandidate(session.candidate);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
    return () => {
      active = false;
      setPortalSessionLostHandler(null);
    };
  }, [clear]);

  const applySession = useCallback((payload: PortalAuthPayload) => {
    setPortalAccessToken(payload.accessToken);
    setCandidate(payload.candidate);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await portalApi<PortalAuthPayload>('/portal/auth/login', { method: 'POST', body: { email, password }, auth: false });
      applySession(payload);
      return payload.candidate;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await portalApi('/portal/auth/logout', { method: 'POST', body: {}, auth: false });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<PortalAuthContext>(() => ({ candidate, status, login, logout }), [candidate, status, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortalAuth doit être utilisé dans <PortalAuthProvider>');
  return ctx;
}
