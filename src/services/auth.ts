// ============================================================================
// CacaoTrace — Service d'authentification
// ----------------------------------------------------------------------------
// Session persistée via le repository (SQLite/Web) au lieu de window.localStorage
// — inexistant en React Native natif — ce qui corrige la non-persistance de la
// session après redémarrage. Aucune valeur factice : les données proviennent du
// backend ou de la session sauvegardée.
// ============================================================================

import * as Crypto from 'expo-crypto';
import { apiClient } from './apiClient';
import { HttpError } from './http';
import { sessionRepository } from './repositories/session.repository';
import { secureStore } from './secureStore';
import { StorageKeys } from './db';

/** Durée de validité d'une session avant re-connexion complète (24 h). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Empreinte locale servant à vérifier le code secret hors-ligne. */
interface AuthGuard {
  codeAgent: string;
  secretHash: string;
}

const normCode = (code: string) => code.trim().toUpperCase();

async function hashSecret(codeAgent: string, secret: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `cacaotrace:${normCode(codeAgent)}:${secret}`,
  );
}

export interface UserProfile {
  id: string;
  nom: string;
  prenoms: string;
  email: string; // vide ('') pour un agent terrain, qui n'a pas d'email
  role: 'ENQUETEUR' | 'CHEF_EQUIPE' | 'SUPERVISEUR' | 'ADMIN' | 'AGENT_TERRAIN';
  zoneAffectation: string;
  telephone?: string;
  avatarUri?: string;
  codeAgent?: string; // identifiant terrain (CT-XXXX), présent pour les agents
  loginAt?: number; // horodatage du dernier login réussi (TTL de session 24 h)
  token?: string;
}

/** Résultat d'une tentative de connexion agent terrain. */
export interface AgentLoginResult {
  success: boolean;
  message?: string;
  user?: UserProfile;
  /** true si l'agent doit créer son code de sécurité (1re connexion). */
  doitDefinirCodeSecurite?: boolean;
}

class AuthService {
  private currentUser: UserProfile | null = null;

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.currentUser) {
      this.currentUser = await sessionRepository.getSession();
    }
    return this.currentUser ? { ...this.currentUser } : null;
  }

  /** Session valide = jeton présent ET dernier login < 24 h (sinon parcours complet). */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user?.token || !user.loginAt) return false;
    return Date.now() - user.loginAt < SESSION_TTL_MS;
  }

  // --- Empreinte d'authentification (vérification hors-ligne du code secret) ---

  private async saveAuthGuard(codeAgent: string, secret: string): Promise<void> {
    const guard: AuthGuard = {
      codeAgent: normCode(codeAgent),
      secretHash: await hashSecret(codeAgent, secret),
    };
    await secureStore.setItem(StorageKeys.AUTH_GUARD, JSON.stringify(guard));
  }

  private async readAuthGuard(): Promise<AuthGuard | null> {
    const raw = await secureStore.getItem(StorageKeys.AUTH_GUARD);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthGuard;
    } catch {
      return null;
    }
  }

  /**
   * Resynchronise le profil local depuis la base (GET /auth/me) pour garantir
   * que l'interface affiche des informations à jour et cohérentes avec la DB.
   * En cas d'échec réseau, conserve la session locale (mode hors-ligne).
   */
  async refreshProfile(): Promise<UserProfile | null> {
    const current = await this.getCurrentUser();
    if (!current?.token) return current;
    try {
      const server = await apiClient.getProfile();
      const merged: UserProfile = {
        ...current,
        id: server.id ?? current.id,
        nom: server.nom ?? current.nom,
        prenoms: server.prenoms ?? current.prenoms,
        email: server.email ?? current.email,
        role: server.role ?? current.role,
        zoneAffectation: server.zoneAffectation ?? current.zoneAffectation,
        telephone: server.telephone ?? current.telephone,
        avatarUri: server.avatarUri ?? current.avatarUri,
        token: current.token, // le jeton n'est jamais renvoyé par /me
      };
      this.currentUser = merged;
      await sessionRepository.saveSession(merged);
      return merged;
    } catch {
      return current;
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; user?: UserProfile }> {
    try {
      const data = await apiClient.login(email, password);
      const user: UserProfile = {
        id: data.user.userId || data.user.id || '',
        nom: data.user.nom || '',
        prenoms: data.user.prenoms || '',
        email: data.user.email || email,
        role: data.user.role || 'ENQUETEUR',
        zoneAffectation: data.user.zoneAffectation || '',
        telephone: data.user.telephone || undefined,
        avatarUri: data.user.avatarUri || undefined,
        loginAt: Date.now(),
        token: data.token,
      };
      this.currentUser = user;
      await sessionRepository.saveSession(user);
      return { success: true, user };
    } catch (e) {
      // Échec réseau : si une session valide existe déjà, autoriser l'accès hors-ligne.
      if (!(e instanceof HttpError) || e.status >= 500) {
        const saved = await sessionRepository.getSession();
        if (saved?.token) {
          this.currentUser = saved;
          return { success: true, user: saved };
        }
      }
      const message =
        e instanceof HttpError
          ? e.message
          : "Impossible de contacter le serveur d'authentification. Vérifiez votre connexion.";
      return { success: false, message };
    }
  }

  /**
   * Connexion d'un agent terrain par code agent + code de sécurité.
   * - Sans `nouveauCodeSecurite`, si le backend renvoie `doitDefinirCodeSecurite`,
   *   c'est une 1re connexion : l'écran bascule sur la création du code.
   * - Avec `nouveauCodeSecurite`, le code est défini et la session ouverte.
   * Au succès en ligne, on mémorise une empreinte locale (hash du code secret)
   * qui permet la reconnexion HORS-LIGNE : serveur injoignable + code agent et
   * code secret correspondant à l'empreinte → accès. Sinon erreur (plus de
   * connexion aveugle).
   */
  async agentLogin(
    codeAgent: string,
    codeSecurite?: string,
    nouveauCodeSecurite?: string,
  ): Promise<AgentLoginResult> {
    const usedSecret = nouveauCodeSecurite ?? codeSecurite;
    try {
      const data = await apiClient.agentLogin({ codeAgent, codeSecurite, nouveauCodeSecurite });

      if ('doitDefinirCodeSecurite' in data) {
        return { success: false, doitDefinirCodeSecurite: true };
      }

      const user: UserProfile = {
        id: data.user.userId || data.user.id || '',
        nom: data.user.nom || '',
        prenoms: data.user.prenoms || '',
        email: data.user.email || '',
        role: data.user.role || 'AGENT_TERRAIN',
        zoneAffectation: data.user.zoneAffectation || '',
        telephone: data.user.telephone || undefined,
        avatarUri: data.user.avatarUri || undefined,
        codeAgent: data.user.codeAgent || normCode(codeAgent),
        loginAt: Date.now(),
        token: data.token,
      };
      this.currentUser = user;
      await sessionRepository.saveSession(user);
      // Empreinte pour la vérification hors-ligne ultérieure.
      if (usedSecret) await this.saveAuthGuard(codeAgent, usedSecret);
      return { success: true, user };
    } catch (e) {
      // Erreur réseau (ou 5xx) : tentative de reconnexion hors-ligne VÉRIFIÉE.
      if (!(e instanceof HttpError) || e.status >= 500) {
        const offline = await this.tryOfflineLogin(codeAgent, codeSecurite);
        if (offline) return { success: true, user: offline };
        return {
          success: false,
          message: 'Serveur injoignable et code non vérifiable hors-ligne.',
        };
      }
      // Erreur métier (4xx) renvoyée par le serveur : message tel quel.
      return { success: false, message: e.message };
    }
  }

  /**
   * Vérifie un code agent AVANT de demander le code secret (étape identifiant).
   * N'ouvre jamais de session. Distingue « paramétrer » (1re connexion) de
   * « vérifier » (code déjà défini).
   * - 'creation'    : compte existant sans code secret → à paramétrer.
   * - 'saisie'      : compte existant avec code secret → demander le code.
   * - 'introuvable' : aucun code agent correspondant.
   * - 'desactive'   : compte existant mais désactivé.
   * - 'hors-ligne'  : serveur injoignable.
   */
  async checkAgentCode(codeAgent: string): Promise<{
    status: 'creation' | 'saisie' | 'introuvable' | 'desactive' | 'hors-ligne';
  }> {
    try {
      const s = await apiClient.checkAgentCode(codeAgent);
      if (!s.exists) return { status: 'introuvable' };
      if (!s.isActive) return { status: 'desactive' };
      return { status: s.doitDefinirCodeSecurite ? 'creation' : 'saisie' };
    } catch (e) {
      if (e instanceof HttpError && e.status < 500) {
        // Erreur métier (ex. format) : on laisse tenter la saisie.
        return { status: 'saisie' };
      }
      return { status: 'hors-ligne' };
    }
  }

  /**
   * Reconnexion hors-ligne : n'ouvre la session QUE si le code agent et le code
   * secret saisis correspondent à l'empreinte locale et à la session en cache.
   * (La création d'un code — 1re connexion — est impossible hors-ligne.)
   */
  private async tryOfflineLogin(
    codeAgent: string,
    codeSecurite?: string,
  ): Promise<UserProfile | null> {
    if (!codeSecurite) return null;
    const saved = await sessionRepository.getSession();
    const guard = await this.readAuthGuard();
    const code = normCode(codeAgent);
    if (
      !saved?.token ||
      normCode(saved.codeAgent ?? '') !== code ||
      !guard ||
      guard.codeAgent !== code
    ) {
      return null;
    }
    const hash = await hashSecret(codeAgent, codeSecurite);
    if (hash !== guard.secretHash) return null;

    const refreshed: UserProfile = { ...saved, loginAt: Date.now() };
    this.currentUser = refreshed;
    await sessionRepository.saveSession(refreshed);
    return refreshed;
  }

  /**
   * Met à jour le profil : session locale immédiate + persistance backend.
   * En cas d'échec réseau, la modification reste enregistrée localement.
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!this.currentUser) {
      this.currentUser = await sessionRepository.getSession();
    }
    if (!this.currentUser) return null;

    this.currentUser = { ...this.currentUser, ...updates };
    await sessionRepository.saveSession(this.currentUser);

    if (this.currentUser.token) {
      try {
        const server = await apiClient.updateProfile({
          nom: updates.nom,
          prenoms: updates.prenoms,
          email: updates.email,
          telephone: updates.telephone,
          zoneAffectation: updates.zoneAffectation,
          avatarUri: updates.avatarUri,
        });
        this.currentUser = {
          ...this.currentUser,
          nom: server.nom ?? this.currentUser.nom,
          prenoms: server.prenoms ?? this.currentUser.prenoms,
          email: server.email ?? this.currentUser.email,
          telephone: server.telephone ?? this.currentUser.telephone,
          zoneAffectation: server.zoneAffectation ?? this.currentUser.zoneAffectation,
          avatarUri: server.avatarUri ?? this.currentUser.avatarUri,
        };
        await sessionRepository.saveSession(this.currentUser);
      } catch {
        // Modification conservée localement ; resynchronisée à la prochaine connexion.
      }
    }

    return { ...this.currentUser };
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    await sessionRepository.clearSession();
    await secureStore.removeItem(StorageKeys.AUTH_GUARD);
  }
}

export const authService = new AuthService();
