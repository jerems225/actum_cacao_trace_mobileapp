// ============================================================================
// CacaoTrace — Typage des champs de saisie (mobile)
// ----------------------------------------------------------------------------
// But : empêcher la faute de frappe AVANT l'enregistrement, pas la signaler
// après. Deux niveaux, complémentaires :
//   1. `sanitizeEntier` / `sanitizeDecimal` : filtrent la frappe caractère par
//      caractère (onChangeText). L'agent ne peut physiquement pas taper une
//      lettre dans une hauteur, ni deux virgules, ni 3 décimales.
//   2. `verifieBorne` : contrôle la plausibilité au moment de valider, avec un
//      message en français qui dit quoi corriger.
//
// LIMITES est le miroir de `LIMITES` dans backend/src/schemas/index.ts. Les deux
// doivent bouger ensemble : le mobile guide, le backend tranche (il refuse même
// une donnée arrivée par un autre chemin).
// ============================================================================

export const LIMITES = {
  /** Année d'installation de la parcelle. */
  anneeParcelle: { min: 1950, max: new Date().getFullYear(), unite: '' },
  /** Superficie déclarée, en hectares. */
  superficieHa: { min: 0.01, max: 500, unite: 'ha' },
  /**
   * Production estimée, en sacs par an. Sans plafond : le cumul des traites
   * d'une grande parcelle dépasse ce qu'on saurait fixer de façon défendable.
   */
  productionSacsAn: { min: 0, unite: 'sac(s)/an' },
  /**
   * Nombre de fois par an d'une pratique culturale. Sans plafond non plus :
   * un désherbage peut être hebdomadaire, et 52 refusait déjà des cas réels.
   */
  frequenceAn: { min: 0, unite: 'fois/an' },
  /**
   * Circonférences, LES DEUX en centimètres : à 30 cm du sol (C30) et à 1,30 m
   * (C1,30). La seconde était relevée en mètres, ce qui obligeait l'agent à
   * changer d'unité en cours de mesure — source d'erreurs d'un facteur 100.
   *
   * Minimum 5 cm : en dessous, ce n'est plus un sujet mesurable. Pas de maximum,
   * mais au-delà de `SEUIL_PHOTO_CIRCONFERENCE_CM` une photo est demandée en
   * justification — une valeur rare mais réelle doit rester enregistrable.
   */
  circonference30cmCm: { min: 5, unite: 'cm' },
  circonference130cm: { min: 5, unite: 'cm' },
  /** Hauteur totale, en mètres. */
  hauteurM: { min: 0.1, max: 80, unite: 'm' },
  /** Comptages par sous-placette. */
  comptageSP: { min: 0, max: 5_000, unite: '' },
} as const;

/**
 * `max` est facultatif. Certaines grandeurs n'ont pas de plafond défendable :
 * un plafond arbitraire y refuse une saisie pourtant exacte, et l'agent n'a
 * alors aucun moyen d'enregistrer ce qu'il a compté. Mieux vaut pas de borne
 * haute qu'une borne fausse.
 */
export type Limite = { min: number; max?: number; unite: string };

/**
 * Au-delà de cette circonférence, la mesure doit être justifiée par une photo.
 * Ce n'est pas un plafond : un sujet de 120 cm existe et doit pouvoir être
 * enregistré. La photo sert à distinguer le cas rare de la faute de frappe,
 * sans jamais refuser la donnée.
 */
export const SEUIL_PHOTO_CIRCONFERENCE_CM = 100;

/** Ne laisse passer que des chiffres. Optionnellement borne la longueur. */
export const sanitizeEntier = (valeur: string, maxChiffres?: number): string => {
  const chiffres = valeur.replace(/[^0-9]/g, '');
  return maxChiffres ? chiffres.slice(0, maxChiffres) : chiffres;
};

/**
 * Ne laisse passer qu'un nombre décimal : chiffres + un seul séparateur.
 * La virgule est acceptée à la frappe (habitude francophone) et conservée telle
 * quelle à l'écran ; `parseNombre` la normalise en point.
 */
export const sanitizeDecimal = (valeur: string, maxDecimales = 2): string => {
  // 1. On ne garde que chiffres, virgules et points.
  let v = valeur.replace(/[^0-9.,]/g, '');
  // 2. Un seul séparateur : les suivants sont supprimés.
  const premierSep = v.search(/[.,]/);
  if (premierSep !== -1) {
    const entier = v.slice(0, premierSep);
    const sep = v[premierSep];
    const decimales = v.slice(premierSep + 1).replace(/[.,]/g, '');
    v = `${entier}${sep}${decimales.slice(0, maxDecimales)}`;
  }
  return v;
};

/** Convertit une saisie (virgule ou point) en nombre, ou `undefined` si vide/invalide. */
export const parseNombre = (valeur: string): number | undefined => {
  const n = parseFloat(valeur.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Vérifie qu'une valeur saisie tient dans ses bornes métier.
 * Retourne `null` si tout va bien, sinon le message à afficher à l'agent.
 * Un champ vide est considéré valide : c'est le rôle du contrôle « obligatoire »
 * de trancher, pas celui du typage.
 */
export const verifieBorne = (
  valeur: string,
  limite: Limite,
  libelle: string,
): string | null => {
  if (!valeur.trim()) return null;
  const n = parseNombre(valeur);
  if (n === undefined) return `${libelle} : valeur numérique attendue.`;
  const u = limite.unite ? ` ${limite.unite}` : '';
  if (n < limite.min) return `${libelle} : minimum ${limite.min}${u}.`;
  if (limite.max !== undefined && n > limite.max) {
    return `${libelle} : maximum ${limite.max}${u} — vérifiez la saisie.`;
  }
  return null;
};
