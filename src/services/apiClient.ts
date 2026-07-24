// ============================================================================
// CacaoTrace — Client API typé (endpoints backend)
// ----------------------------------------------------------------------------
// Une méthode par endpoint métier. Les payloads reflètent les contrats zod du
// backend (section 9 de la spec). Aucune logique de stockage ici : ce module
// ne fait que parler au serveur.
// ============================================================================

import { apiRequest } from './http';
import type { UserProfile } from './auth';

// --- Contrats de synchronisation (alignés backend/sync) ---
export interface SyncPushRecord {
  clientId: string;
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  clientUpdatedAt: string;
}

export interface SyncPushRequest {
  deviceId: string;
  lastSyncAt: string;
  records: SyncPushRecord[];
}

export interface SyncPushResult {
  clientId: string;
  status: 'SYNCED' | 'CONFLICT';
  serverId?: string;
  reason?: string;
}

export interface SyncPullResponse {
  syncedAt: string;
  entities: {
    producteurs: unknown[];
    parcelles: unknown[];
    placettes: unknown[];
    sousPlacettes: unknown[];
    mesures: unknown[];
    photos: unknown[];
  };
}

interface LoginResponse {
  token: string;
  user: {
    userId?: string;
    id?: string;
    email: string;
    nom?: string;
    prenoms?: string;
    role?: UserProfile['role'];
    zoneAffectation?: string;
    avatarUri?: string;
    telephone?: string;
  };
}

/** Requête de connexion agent terrain (code agent + code de sécurité). */
export interface AgentLoginPayload {
  codeAgent: string;
  codeSecurite?: string;
  nouveauCodeSecurite?: string;
}

/**
 * Réponse de /auth/agent-login. Union discriminée :
 * - `doitDefinirCodeSecurite` : 1re connexion, l'agent doit créer son code.
 * - sinon : `token` + profil (connexion réussie).
 */
export type AgentLoginResponse =
  | { doitDefinirCodeSecurite: true }
  | (LoginResponse & { user: LoginResponse['user'] & { codeAgent?: string | null } });

/** État d'un code agent (guidage avant saisie du code de sécurité). */
export interface AgentCodeStatus {
  exists: boolean;
  isActive: boolean;
  doitDefinirCodeSecurite: boolean;
}


export const apiClient = {
  // --- Authentification ---
  login(email: string, password: string): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
  },

  checkAgentCode(codeAgent: string): Promise<AgentCodeStatus> {
    return apiRequest<AgentCodeStatus>('/auth/agent-code/check', {
      method: 'POST',
      auth: false,
      body: { codeAgent },
    });
  },

  agentLogin(payload: AgentLoginPayload): Promise<AgentLoginResponse> {
    return apiRequest<AgentLoginResponse>('/auth/agent-login', {
      method: 'POST',
      auth: false,
      body: payload,
    });
  },

  getProfile(): Promise<Partial<UserProfile>> {
    return apiRequest<Partial<UserProfile>>('/auth/me');
  },

  updateProfile(updates: Partial<UserProfile>): Promise<Partial<UserProfile>> {
    return apiRequest<Partial<UserProfile>>('/auth/profile', {
      method: 'PATCH',
      body: updates,
    });
  },

  // --- Synchronisation ---
  pushSync(request: SyncPushRequest): Promise<SyncPushResult[]> {
    return apiRequest<SyncPushResult[]>('/sync/push', {
      method: 'POST',
      body: request,
    });
  },

  pullSync(since: string, deviceId: string): Promise<SyncPullResponse> {
    const query = `?since=${encodeURIComponent(since)}&deviceId=${encodeURIComponent(deviceId)}`;
    return apiRequest<SyncPullResponse>(`/sync/pull${query}`);
  },

  // --- Notifications push ---
  registerDevice(token: string, deviceId: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>('/notifications/register-device', {
      method: 'POST',
      body: { token, deviceId },
    });
  },
};
