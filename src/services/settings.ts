// ============================================================================
// CacaoTrace — Réglages applicatifs (flags admin) avec cache hors-ligne
// ----------------------------------------------------------------------------
// Les flags (ex. autorisation d'édition manuelle des points pour l'agent
// terrain) sont pilotés côté backend par l'administration. On les met en cache
// localement pour rester cohérent hors-ligne.
// ============================================================================

import { apiClient, AppSettings } from './apiClient';
import { getPersistence, StorageKeys } from './db';

const DEFAULTS: AppSettings = {
  agentManualPointEdit: false,
};

class SettingsService {
  private cache: AppSettings | null = null;

  async getCached(): Promise<AppSettings> {
    if (this.cache) return this.cache;
    const p = await getPersistence();
    this.cache = (await p.getKV<AppSettings>(StorageKeys.SETTINGS)) ?? { ...DEFAULTS };
    return this.cache;
  }

  async refresh(): Promise<AppSettings> {
    try {
      const settings = await apiClient.getSettings();
      this.cache = settings;
      const p = await getPersistence();
      await p.setKV(StorageKeys.SETTINGS, settings);
      return settings;
    } catch {
      return this.getCached();
    }
  }
}

export const settingsService = new SettingsService();
