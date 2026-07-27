// ============================================================================
// CacaoTrace — Préférences de l'agent sur cet appareil
// ----------------------------------------------------------------------------
// À ne pas confondre avec `services/settings.ts` : celui-là lit les FLAGS
// décidés par l'administration côté serveur (ce que l'agent a le droit de
// faire). Ici, ce sont les préférences de confort de l'agent sur SON téléphone
// (thème, notifications). Elles restent locales : elles décrivent l'appareil,
// pas le compte, et n'ont donc aucune raison de voyager.
// ============================================================================

import { getPersistence, StorageKeys } from './db';

/** Thème : suivre le système, ou forcer clair / sombre. */
export type ThemeMode = 'systeme' | 'clair' | 'sombre';

export interface Preferences {
  theme: ThemeMode;
  /** Faux = plus aucune notification n'est présentée par le système. */
  notificationsActives: boolean;
}

const DEFAUTS: Preferences = {
  theme: 'systeme',
  notificationsActives: true,
};

class PreferencesService {
  private cache: Preferences | null = null;
  private abonnes = new Set<(p: Preferences) => void>();

  async get(): Promise<Preferences> {
    if (this.cache) return this.cache;
    const p = await getPersistence();
    const stocke = await p.getKV<Partial<Preferences>>(StorageKeys.PREFERENCES);
    // Fusion avec les défauts : une préférence ajoutée plus tard ne doit pas
    // rester `undefined` chez un agent dont l'appareil a déjà un enregistrement.
    this.cache = { ...DEFAUTS, ...(stocke ?? {}) };
    return this.cache;
  }

  /**
   * Lecture synchrone du cache, pour les rendus qui ne peuvent pas attendre.
   * Renvoie les défauts tant que `get()` n'a pas été appelé au moins une fois.
   */
  getCacheOuDefauts(): Preferences {
    return this.cache ?? DEFAUTS;
  }

  async set(patch: Partial<Preferences>): Promise<Preferences> {
    const actuel = await this.get();
    const suivant = { ...actuel, ...patch };
    this.cache = suivant;
    const p = await getPersistence();
    await p.setKV(StorageKeys.PREFERENCES, suivant);
    this.abonnes.forEach((fn) => fn(suivant));
    return suivant;
  }

  /** Prévient les écrans déjà montés (le thème doit changer sans redémarrage). */
  souscrire(fn: (p: Preferences) => void): () => void {
    this.abonnes.add(fn);
    return () => {
      this.abonnes.delete(fn);
    };
  }
}

export const preferencesService = new PreferencesService();
