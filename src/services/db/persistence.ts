// ============================================================================
// CacaoTrace — Contrat de persistance locale (Dependency Inversion)
// ----------------------------------------------------------------------------
// Les repositories dépendent de cette interface, jamais d'une implémentation
// concrète. Deux adaptateurs l'implémentent : SQLite (natif) et localStorage
// (web / fallback). Le choix se fait au runtime dans ./index.ts.
// ============================================================================

/** Toute entité persistée doit être identifiable de façon stable. */
export interface Identifiable {
  id: string;
}

/**
 * Magasin de documents + magasin clé/valeur.
 * Volontairement minimaliste : les repositories construisent la logique métier
 * au-dessus de ces primitives (Single Responsibility).
 */
export interface Persistence {
  /** Prépare le stockage (création des tables / structures). Idempotent. */
  init(): Promise<void>;

  // --- Collections de documents ---
  getAll<T extends Identifiable>(collection: string): Promise<T[]>;
  getById<T extends Identifiable>(collection: string, id: string): Promise<T | null>;
  upsert<T extends Identifiable>(collection: string, item: T): Promise<T>;
  bulkUpsert<T extends Identifiable>(collection: string, items: T[]): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  clear(collection: string): Promise<void>;

  // --- Paires clé/valeur (session, préférences, jetons) ---
  getKV<T>(key: string): Promise<T | null>;
  setKV<T>(key: string, value: T): Promise<void>;
  removeKV(key: string): Promise<void>;
}

/** Noms de collections centralisés pour éviter les chaînes magiques. */
export const Collections = {
  PRODUCTEURS: 'producteurs',
  PARCELLES: 'parcelles',
  PLACETTES: 'placettes',
  SYNC_QUEUE: 'sync_queue',
  SYNC_HISTORY: 'sync_history',
  NOTIFICATIONS: 'notifications',
} as const;

/** Clés du magasin clé/valeur. */
export const StorageKeys = {
  SESSION: 'session',
  DEVICE_ID: 'device_id',
  PUSH_TOKEN: 'push_token',
  LAST_SYNC_AT: 'last_sync_at',
  // Empreinte d'authentification (code agent + hash du code secret) pour la
  // vérification hors-ligne. Stockée en secure-store sur natif.
  AUTH_GUARD: 'auth_guard',
  // Référentiel délégations/villes mis en cache pour l'usage hors-ligne.
  DELEGATIONS: 'delegations',
  // Réglages applicatifs (flags pilotés par l'admin) mis en cache.
  SETTINGS: 'app_settings',
  // Référentiels mesures (espèces / maladies) mis en cache pour l'offline.
  ESPECES: 'especes',
  MALADIES: 'maladies',
  // Préférences de l'agent sur CET appareil (thème, notifications). Elles ne
  // partent pas au serveur : elles décrivent l'appareil, pas le compte.
  PREFERENCES: 'preferences',
} as const;
