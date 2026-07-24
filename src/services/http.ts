// ============================================================================
// CacaoTrace — Client HTTP bas niveau
// ----------------------------------------------------------------------------
// Encapsule fetch : injection du jeton JWT, timeout, et parsing de l'enveloppe
// standard { success, data, error } du backend. Toute la couche métier
// consomme ce client plutôt que fetch directement (DRY + gestion d'erreurs
// homogène).
// ============================================================================

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { sessionRepository } from './repositories/session.repository';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

/** Erreur applicative portant le code métier renvoyé par le backend. */
export class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean; // Injecte le header Authorization (défaut : true)
  timeoutMs?: number;
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await sessionRepository.getSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

/**
 * Exécute une requête et retourne `data`. Lève `HttpError` si le serveur
 * répond une enveloppe d'erreur ou en cas d'échec réseau/timeout.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) Object.assign(headers, await authHeader());

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!res.ok || !json || json.success === false) {
      const err = json?.error;
      throw new HttpError(
        err?.code || 'HTTP_ERROR',
        err?.message || `Erreur serveur (${res.status})`,
        res.status,
        err?.details,
      );
    }

    return json.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Vérifie la joignabilité du backend (utilisé par le SyncManager). */
export async function isBackendReachable(): Promise<boolean> {
  try {
    await apiRequest('/health', { auth: false, timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}
