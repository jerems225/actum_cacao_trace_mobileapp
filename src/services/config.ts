// ============================================================================
// CacaoTrace — Configuration runtime (variables d'environnement Expo)
// ----------------------------------------------------------------------------
// Source unique pour les paramètres injectés via app.config / .env. Toute
// lecture d'`EXPO_PUBLIC_*` passe par ici (pas de process.env dispersé).
// ============================================================================

/** URL de base de l'API versionnée. */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/** Précision GPS minimale acceptable (mètres) avant avertissement. */
export const GPS_MIN_ACCURACY_METERS = Number(
  process.env.EXPO_PUBLIC_GPS_MIN_ACCURACY_METERS || '10',
);

/**
 * Autorise la simulation GPS quand le capteur est indisponible (émulateur,
 * permission refusée). À laisser `false` en production pour garantir des
 * coordonnées réelles (fiabilité des données de terrain).
 */
export const ALLOW_GPS_SIMULATION =
  (process.env.EXPO_PUBLIC_ALLOW_GPS_SIMULATION || 'true') === 'true';

/** Délai maximal (ms) d'une requête réseau avant abandon. */
export const REQUEST_TIMEOUT_MS = 15000;
