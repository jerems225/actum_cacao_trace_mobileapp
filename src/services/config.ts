// ============================================================================
// Actum Collect — Configuration runtime (variables d'environnement Expo)
// ----------------------------------------------------------------------------
// Source unique pour les paramètres injectés via app.config / .env. Toute
// lecture d'`EXPO_PUBLIC_*` passe par ici (pas de process.env dispersé).
//
// RAPPEL SUR LE BUILD : Expo fige ces variables dans le bundle AU MOMENT DE LA
// COMPILATION. Elles doivent donc être présentes sur la machine qui construit
// — le poste en développement, le serveur EAS en production. Un `.env` local
// exclu de git n'est PAS envoyé à EAS : les valeurs de build sont déclarées
// dans `eas.json`, profil par profil.
// ============================================================================

const urlApi = process.env.EXPO_PUBLIC_API_URL;

/**
 * URL de base de l'API versionnée.
 *
 * Le repli sur `localhost` ne vaut QUE pour le développement. Il valait
 * auparavant partout, et c'était un piège silencieux : une application
 * construite sans la variable pointait sur la machine du développeur, donc sur
 * rien du tout depuis un téléphone. Elle se lançait, affichait l'écran de
 * connexion, et échouait à chaque appel sans jamais dire pourquoi — l'agent
 * concluait à une panne de réseau.
 *
 * En production, l'absence de la variable est une erreur de configuration du
 * build : mieux vaut le dire tout de suite et fort que livrer une application
 * qui paraît fonctionner.
 */
export const API_BASE_URL = (() => {
  if (urlApi) return urlApi.replace(/\/+$/, '');

  if (__DEV__) {
    console.warn(
      "[Config] EXPO_PUBLIC_API_URL absente : repli sur http://localhost:4000/api/v1. " +
        'Depuis un téléphone ou un émulateur, cette adresse ne désigne PAS votre machine.',
    );
    return 'http://localhost:4000/api/v1';
  }

  throw new Error(
    "EXPO_PUBLIC_API_URL n'a pas été fournie au moment du build. " +
      "L'application ne sait pas à quel serveur s'adresser. " +
      'Renseignez-la dans le bloc `env` du profil concerné, dans eas.json, puis reconstruisez.',
  );
})();

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
