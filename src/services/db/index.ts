// ============================================================================
// CacaoTrace — Fabrique de persistance (sélection de la stratégie au runtime)
// ----------------------------------------------------------------------------
// Point d'entrée unique : les repositories importent `getPersistence()` et
// ignorent totalement l'implémentation sous-jacente (SQLite ou Web).
// ============================================================================

import { Platform } from 'react-native';
import type { Persistence } from './persistence';
import { WebPersistence } from './web.adapter';

let instance: Persistence | null = null;
let initPromise: Promise<Persistence> | null = null;

async function createPersistence(): Promise<Persistence> {
  // Web : pas de mode offline → store mémoire éphémère, et surtout aucun
  // chargement de expo-sqlite (import dynamique réservé au natif).
  if (Platform.OS === 'web') {
    return new WebPersistence();
  }
  // Natif (iOS/Android) : persistance réelle via SQLite.
  const { SQLitePersistence } = await import('./sqlite.adapter');
  return new SQLitePersistence();
}

/**
 * Retourne l'instance unique de persistance, initialisée.
 * Sûr à appeler de façon concurrente (une seule initialisation réelle).
 */
export async function getPersistence(): Promise<Persistence> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = (async () => {
      const p = await createPersistence();
      await p.init();
      instance = p;
      return p;
    })();
  }
  return initPromise;
}

export * from './persistence';
