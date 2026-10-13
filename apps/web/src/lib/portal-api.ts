import { ApiError } from './api';
import type { PortalCandidate } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export { ApiError as PortalApiError };

let accessToken: string | null = null;
export const setPortalAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getPortalAccessToken = () => accessToken;
export const portalApiBaseUrl = BASE;

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

export interface PortalAuthPayload {
  accessToken: string;
  candidate: PortalCandidate;
}

/** Client isolé du client employé (lib/api.ts) : jeton, cookie de session et gestion d'erreurs propres au portail. */
let refreshing: Promise<PortalAuthPayload | null> | null = null;
export function refreshPortalSession(): Promise<PortalAuthPayload | null> {
  refreshing ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await send('/portal/auth/refresh', { method: 'POST', body: {}, auth: false });
        if (res.ok) {
          const data = (await res.json()) as PortalAuthPayload;
          setPortalAccessToken(data.accessToken);
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

let onPortalSessionLost: (() => void) | null = null;
export const setPortalSessionLostHandler = (fn: (() => void) | null) => {
  onPortalSessionLost = fn;
};

export async function portalApi<T = void>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);
  if (res.status === 401 && options.auth !== false) {
    const renewed = await refreshPortalSession();
    if (!renewed) {
      setPortalAccessToken(null);
      onPortalSessionLost?.();
      return parse<T>(res);
    }
    res = await send(path, options);
  }
  return parse<T>(res);
}
