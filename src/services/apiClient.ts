// ============================================================================
// CacaoTrace — Client API typé (endpoints backend)
// ----------------------------------------------------------------------------
// Une méthode par endpoint métier. Les payloads reflètent les contrats zod du
// backend (section 9 de la spec). Aucune logique de stockage ici : ce module
// ne fait que parler au serveur.
// ============================================================================

import { apiRequest } from './http';
import type { UserProfile } from './auth';
import type { Delegation, Espece, Maladie } from '../types';

/** Réglages applicatifs pilotés par l'admin (flags). */
export interface AppSettings {
  agentManualPointEdit: boolean;
}

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
  /** Champs autoritatifs renvoyés par le serveur (ex. numeroPlacette final). */
  fields?: Record<string, unknown>;
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
    /** Référence durable (`bucket/chemin`). */
    avatarUri?: string;
    /** Lien signé temporaire, pour affichage seulement. */
    avatarUrl?: string;
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

/** Réponse du changement d'identifiant (POST /auth/change-credential). */
export interface ChangeCredentialResponse {
  type: 'CODE_SECURITE' | 'MOT_DE_PASSE';
  /** Libellé en clair fourni par le serveur (« code de sécurité »…). */
  libelle: string;
  /** Vrai si l'identifiant n'existait pas encore (agent réinitialisé). */
  premiereDefinition: boolean;
  modifieLe: string;
}

/** Une entrée du journal d'activité (GET /auth/activity). */
export interface ActivityEntry {
  id: string;
  action: string;
  /** Libellé lisible fourni par le serveur, pour éviter deux tables de libellés. */
  libelle: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
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

  /**
   * Change son propre identifiant. Le serveur décide de la nature traitée
   * (code de sécurité pour un agent terrain, mot de passe pour un compte
   * administration) et la renvoie : le mobile n'a pas à deviner.
   */
  changeCredential(payload: {
    ancien?: string;
    nouveau: string;
  }): Promise<ChangeCredentialResponse> {
    return apiRequest<ChangeCredentialResponse>('/auth/change-credential', {
      method: 'POST',
      body: payload,
    });
  },

  /** Journal d'activité du compte (connexions, envois, modifications). */
  async getActivity(limit = 20): Promise<ActivityEntry[]> {
    const reponse = await apiRequest<ActivityEntry[] | { entries?: ActivityEntry[] }>(
      `/auth/activity?limit=${limit}`,
    );
    // Même précaution que pour /sync/push : le backend encapsule dans un objet,
    // on tolère les deux formes pour ne pas casser sur une évolution de contrat.
    if (Array.isArray(reponse)) return reponse;
    return Array.isArray(reponse?.entries) ? reponse.entries : [];
  },

  // --- Référentiel géographique ---
  getDelegations(): Promise<Delegation[]> {
    return apiRequest<Delegation[]>('/delegations');
  },

  // --- Réglages applicatifs (flags admin) ---
  getSettings(): Promise<AppSettings> {
    return apiRequest<AppSettings>('/settings');
  },

  // --- Référentiels mesures (espèces / maladies) ---
  getEspeces(): Promise<Espece[]> {
    return apiRequest<Espece[]>('/especes');
  },
  getMaladies(): Promise<Maladie[]> {
    return apiRequest<Maladie[]>('/maladies');
  },

  // --- Synchronisation ---
  /**
   * Pousse un lot vers le serveur et renvoie TOUJOURS un tableau de résultats.
   *
   * Le backend répond `data: { results: [...] }` — un objet, pas un tableau nu.
   * `apiRequest<T>` se contentant de caster, TypeScript ne pouvait pas voir
   * l'écart : le tableau attendu arrivait sous forme d'objet et `results.map`
   * échouait à l'exécution. On désencapsule ici, en tolérant les deux formes
   * pour qu'une application déjà installée continue de fonctionner si la réponse
   * serveur évolue.
   */
  async pushSync(request: SyncPushRequest): Promise<SyncPushResult[]> {
    const reponse = await apiRequest<SyncPushResult[] | { results?: SyncPushResult[] }>(
      '/sync/push',
      { method: 'POST', body: request },
    );
    if (Array.isArray(reponse)) return reponse;
    return Array.isArray(reponse?.results) ? reponse.results : [];
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
