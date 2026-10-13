'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PartnerPortalAuthPayload, partnerPortalApi, refreshPartnerPortalSession, setPartnerAccessToken, setPartnerPortalSessionLostHandler,
} from '@/lib/partner-portal-api';
import type { PartnerAuthUser } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface PartnerAuthContext {
  partnerUser: PartnerAuthUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<PartnerAuthUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<PartnerAuthContext | null>(null);

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [partnerUser, setPartnerUser] = useState<PartnerAuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const clear = useCallback(() => {
    setPartnerAccessToken(null);
    setPartnerUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setPartnerPortalSessionLostHandler(clear);
    let active = true;
    void refreshPartnerPortalSession().then((session) => {
      if (!active) return;
      if (session) {
        setPartnerUser(session.partnerUser);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
    return () => {
      active = false;
      setPartnerPortalSessionLostHandler(null);
    };
  }, [clear]);

  const applySession = useCallback((payload: PartnerPortalAuthPayload) => {
    setPartnerAccessToken(payload.accessToken);
    setPartnerUser(payload.partnerUser);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await partnerPortalApi<PartnerPortalAuthPayload>('/partner-portal/auth/login', { method: 'POST', body: { email, password }, auth: false });
      applySession(payload);
      return payload.partnerUser;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await partnerPortalApi('/partner-portal/auth/logout', { method: 'POST', body: {}, auth: false });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<PartnerAuthContext>(() => ({ partnerUser, status, login, logout }), [partnerUser, status, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePartnerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePartnerAuth doit être utilisé dans <PartnerAuthProvider>');
  return ctx;
}
