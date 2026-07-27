// ============================================================================
// CacaoTrace — Référentiel délégations/villes (avec cache hors-ligne)
// ----------------------------------------------------------------------------
// Le référentiel vient du backend (paramétrable depuis le tableau de bord). On
// le met en cache localement (magasin kv) pour rester utilisable hors-ligne
// pendant la collecte. `refresh()` re-synchronise quand le réseau est dispo.
// ============================================================================

import { apiClient } from './apiClient';
import { getPersistence, StorageKeys } from './db';
import type { Delegation } from '../types';

class DelegationsService {
  private cache: Delegation[] | null = null;

  /** Liste depuis le cache (mémoire → kv). Vide si jamais synchronisée. */
  async getCached(): Promise<Delegation[]> {
    if (this.cache) return this.cache;
    const p = await getPersistence();
    this.cache = (await p.getKV<Delegation[]>(StorageKeys.DELEGATIONS)) ?? [];
    return this.cache;
  }

  /** Re-synchronise depuis le backend et met à jour le cache. Silencieux si hors-ligne. */
  async refresh(): Promise<Delegation[]> {
    try {
      const delegations = await apiClient.getDelegations();
      this.cache = delegations;
      const p = await getPersistence();
      await p.setKV(StorageKeys.DELEGATIONS, delegations);
      return delegations;
    } catch {
      // Hors-ligne ou serveur indisponible : on garde le cache existant.
      return this.getCached();
    }
  }
}

export const delegationsService = new DelegationsService();
