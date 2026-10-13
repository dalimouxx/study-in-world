'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, AuthPayload, refreshSession, setAccessToken, setSessionLostHandler } from '@/lib/api';
import type { SessionUser } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContext {
  user: SessionUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** Après un changement de mot de passe : l'API renvoie une nouvelle session. */
  applySession: (payload: AuthPayload) => void;
  can: (permission: string) => boolean;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionLostHandler(clear);
    let active = true;
    void refreshSession().then((session) => {
      if (!active) return;
      if (session) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
    return () => {
      active = false;
      setSessionLostHandler(null);
    };
  }, [clear]);

  const applySession = useCallback((payload: AuthPayload) => {
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await api<AuthPayload>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      applySession(payload);
      return payload.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {}, auth: false });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthContext>(
    () => ({
      user,
      status,
      login,
      logout,
      applySession,
      can: (permission) => !!user && (user.roleCode === 'SUPER_ADMIN' || user.permissions.includes(permission)),
    }),
    [user, status, login, logout, applySession],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
