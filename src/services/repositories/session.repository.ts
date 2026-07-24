// ============================================================================
// CacaoTrace — Repository Session & identité appareil (magasin clé/valeur)
// ----------------------------------------------------------------------------
// Remplace l'ancienne dépendance à window.localStorage (inexistant en RN natif)
// par une persistance réelle et multiplateforme.
// ============================================================================

import { getPersistence, StorageKeys } from '../db';
import { generateUuid } from './ids';
import type { UserProfile } from '../auth';

class SessionRepository {
  async getSession(): Promise<UserProfile | null> {
    const p = await getPersistence();
    return p.getKV<UserProfile>(StorageKeys.SESSION);
  }

  async saveSession(user: UserProfile): Promise<void> {
    const p = await getPersistence();
    await p.setKV(StorageKeys.SESSION, user);
  }

  async clearSession(): Promise<void> {
    const p = await getPersistence();
    await p.removeKV(StorageKeys.SESSION);
  }

  /** Identifiant d'appareil stable (généré une fois, réutilisé ensuite). */
  async getDeviceId(): Promise<string> {
    const p = await getPersistence();
    let id = await p.getKV<string>(StorageKeys.DEVICE_ID);
    if (!id) {
      id = generateUuid();
      await p.setKV(StorageKeys.DEVICE_ID, id);
    }
    return id;
  }

  async getPushToken(): Promise<string | null> {
    const p = await getPersistence();
    return p.getKV<string>(StorageKeys.PUSH_TOKEN);
  }

  async savePushToken(token: string): Promise<void> {
    const p = await getPersistence();
    await p.setKV(StorageKeys.PUSH_TOKEN, token);
  }
}

export const sessionRepository = new SessionRepository();
