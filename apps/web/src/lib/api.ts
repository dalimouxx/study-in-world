import type { SessionUser } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
/** Pour les rares appels hors du helper `api()` (ex : upload multipart) qui ont besoin du jeton courant. */
export const getAccessToken = () => accessToken;
export const apiBaseUrl = BASE;

type Query = Record<string, string | number | boolean | undefined | null>;
interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: boolean;
}

async function send(path: string, { method = 'GET', body, query, auth = true }: Options): Promise<Response> {
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${BASE}${path}${qs === '?' ? '' : qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Réseau indisponible');
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let code: string | undefined;
  let message = res.statusText;
  try {
    const data = await res.json();
    code = data.code;
    message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? message);
  } catch {
    /* corps non JSON */
  }
  throw new ApiError(res.status, code, message);
}

export interface AuthPayload {
  accessToken: string;
  user: SessionUser;
}

/** Une seule tentative de refresh à la fois, même si plusieurs requêtes expirent ensemble. */
let refreshing: Promise<AuthPayload | null> | null = null;
export function refreshSession(): Promise<AuthPayload | null> {
  refreshing ??= (async () => {
    try {
      // 2 essais : si un autre onglet vient de faire tourner le cookie, le 2e essai utilise le nouveau.
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await send('/auth/refresh', { method: 'POST', body: {}, auth: false });
        if (res.ok) {
          const data = (await res.json()) as AuthPayload;
          setAccessToken(data.accessToken);
          return data;
        }
        if (res.status !== 401) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      return null;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

let onSessionLost: (() => void) | null = null;
export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

export async function api<T = void>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);
  if (res.status === 401 && options.auth !== false) {
    const renewed = await refreshSession();
    if (!renewed) {
      setAccessToken(null);
      onSessionLost?.();
      return parse<T>(res);
    }
    res = await send(path, options);
  }
  return parse<T>(res);
}
