// ============================================================================
// CacaoTrace — Types et constantes de la saisie de collecte
// ----------------------------------------------------------------------------
// Extrait de CollecteWizardScreen, qui dépassait 2 600 lignes. Regrouper ici les
// brouillons de saisie et leurs valeurs initiales permet aux composants de bloc
// et au hook de formulaire de partager un vocabulaire sans dépendre de l'écran.
// ============================================================================

import { EtatSanitaire, TypeSujet } from '../../types';
import type { AgentPratiquant, FrequencePratique } from '../../types';

/**
 * Brouillon de saisie d'UN volet de pratiques culturales (B4).
 * Les valeurs restent en chaînes tant que l'agent saisit : la conversion et le
 * contrôle des bornes se font à l'enregistrement.
 */
export interface VoletDraft {
  types: string[];
  typesAutre: string;
  agents: AgentPratiquant[];
  agentsAutre: string;
  frequence: FrequencePratique | null;
  frequenceAutre: string;
  nombreFoisParAn: string;
}

export const VOLET_VIDE: VoletDraft = {
  types: [],
  typesAutre: '',
  agents: [],
  agentsAutre: '',
  frequence: null,
  frequenceAutre: '',
  nombreFoisParAn: '',
};

/**
 * Nature du sujet relevé, telle que l'agent la choisit à l'écran.
 *
 * Trois choix là où le modèle de données n'a que deux types : « arbre d'ombrage »
 * et « autre arbre » sont tous deux des `ARBRE_OMBRAGE`, séparés par le seul
 * drapeau `emetOmbre`. Le protocole ne distingue pas des espèces différentes
 * mais un RÔLE différent dans le couvert — et c'est l'agent devant l'arbre qui
 * sait lequel il voit, pas la fiche du référentiel.
 *
 * Les « autres arbres » vivaient dans une étape séparée, rattachés à SP1 par
 * convention. Ils sont désormais relevés dans la sous-placette où ils poussent,
 * comme les deux autres catégories : c'est la même question posée au même
 * moment, elle n'a pas à changer d'écran.
 */
export type CategorieSujet = 'CACAO' | 'OMBRAGE' | 'AUTRE';

/** Traduit la catégorie choisie à l'écran vers le couple stocké en base. */
export const versModele = (
  categorie: CategorieSujet,
): { typeSujet: TypeSujet; emetOmbre?: boolean } => {
  if (categorie === 'CACAO') return { typeSujet: TypeSujet.CACAO };
  return { typeSujet: TypeSujet.ARBRE_OMBRAGE, emetOmbre: categorie === 'OMBRAGE' };
};

/** Chemin inverse : retrouve la puce à activer pour une mesure déjà enregistrée. */
export const versCategorie = (m: {
  typeSujet: TypeSujet;
  emetOmbre?: boolean;
}): CategorieSujet => {
  if (m.typeSujet === TypeSujet.CACAO) return 'CACAO';
  return m.emetOmbre === false ? 'AUTRE' : 'OMBRAGE';
};

export const CATEGORIE_LABELS: Record<CategorieSujet, string> = {
  CACAO: 'Cacaoyer',
  OMBRAGE: "Arbre d'ombrage",
  AUTRE: 'Autre arbre',
};

/**
 * Brouillon de saisie d'UNE mesure, propre à une sous-placette.
 * Chaque SP possède le sien : c'est ce qui garantit que la circonférence tapée
 * pour SP1 ne réapparaît pas dans SP2.
 */
export interface MesureDraft {
  categorie: CategorieSujet;
  /**
   * Les deux circonférences, en CENTIMÈTRES toutes les deux : à 30 cm du sol
   * et à 1,30 m. Elles se relèvent l'une après l'autre sur le même sujet ; les
   * demander en alternance dans un champ unique obligeait à choisir, alors que
   * le protocole veut les deux.
   */
  circo30: string;
  circo130: string;
  /**
   * Photo justifiant une circonférence hors du commun. Voir
   * `SEUIL_PHOTO_CIRCONFERENCE_CM` : la valeur reste acceptée, la photo lève
   * seulement le doute entre le sujet remarquable et la faute de frappe.
   */
  photoCirconference: string | null;
  /**
   * Hauteur du fût, en m — ARBRES UNIQUEMENT. Un cacaoyer se ramifie dès la
   * base : la notion n'a pas de sens pour lui, et le protocole ne lui demande
   * que sa hauteur totale. Le champ reste dans le brouillon pour ne pas perdre
   * une valeur déjà tapée si l'agent change de catégorie par erreur, mais il
   * n'est ni affiché ni transmis pour un cacaoyer.
   */
  hauteurFut: string;
  /** Hauteur totale, en m. Relevée sur tous les sujets. */
  hauteur: string;
  /** Cacaoyers uniquement : un arbre d'ombrage n'a pas d'état sanitaire relevé. */
  etatSanitaire: EtatSanitaire;
  /** Clé de l'espèce retenue (`id:<uuid>` ou `CLE_AUTRE`). */
  especeKey: string | null;
  especeAutre: string;
  /** Clé de la maladie retenue (`id:<uuid>`, `nom:<libellé>` ou `CLE_AUTRE`). */
  maladieKey: string | null;
  maladieAutre: string;
  photoMaladie: string | null;
}

export const DRAFT_VIDE: MesureDraft = {
  categorie: 'CACAO',
  circo30: '',
  circo130: '',
  photoCirconference: null,
  hauteurFut: '',
  hauteur: '',
  etatSanitaire: EtatSanitaire.VIVANT,
  especeKey: null,
  especeAutre: '',
  maladieKey: null,
  maladieAutre: '',
  photoMaladie: null,
};

/**
 * Clé de l'option « Autres » des listes déroulantes de référentiel.
 * Placée en dernière position, elle révèle le champ de saisie libre — plutôt
 * qu'un champ toujours visible qui laissait croire à deux réponses possibles.
 */
export const CLE_AUTRE = 'AUTRE';

/** Mesure saisie en cours de collecte, rattachée à un numéro de sous-placette. */
export interface MesureCollectee {
  /**
   * Identifiant local, présent uniquement pour une mesure rechargée depuis un
   * brouillon. C'est la clé d'appariement qui permet de la MODIFIER plutôt que
   * de la recréer à l'enregistrement (voir storage.diffMesures).
   */
  id?: string;
  numeroSP: number;
  typeSujet: TypeSujet;
  espece?: string;
  especeId?: string;
  especeLibre?: string;
  emetOmbre?: boolean;
  circonference30cm?: number;
  /**
   * Circonférence à 1,30 m, en CENTIMÈTRES. Le champ s'appelle encore
   * `circonferenceDBH` côté base, où il portait des mètres : les fiches
   * antérieures gardent donc leur unité d'origine, les nouvelles sont en cm.
   * L'écart est visible à l'œil (0,45 contre 45), il n'y a pas d'ambiguïté.
   */
  circonferenceDBH?: number;
  /** Arbres uniquement — voir `MesureDraft.hauteurFut`. */
  hauteurFut?: number;
  hauteurTotale?: number;
  etatSanitaire: EtatSanitaire;
  maladieId?: string;
  maladieLibre?: string;
  photoMaladie?: string;
  /** Photo justifiant une circonférence supérieure au seuil. */
  photoCirconference?: string;
}

/**
 * Nombre MAXIMAL de cacaoyers mesurés sur SP2 à SP6.
 *
 * Le protocole y prélève un échantillon de trois sujets, l'effectif réel étant
 * compté à part (voir `SousPlacetteLocal.nombrePlantsCacao`). SP1 n'est pas
 * concernée : elle porte le relevé exhaustif de la placette.
 */
export const MAX_CACAO_MESURES_SP = 3;

/**
 * Sous-placette portant le relevé exhaustif des cacaoyers. Sur les autres,
 * l'agent mesure trois sujets et saisit le nombre présent.
 */
export const SP_RELEVE_EXHAUSTIF = 1;

/**
 * Étapes du parcours de saisie.
 * La 6e est une page de validation : le récapitulatif de ce qui manque et les
 * deux actions d'enregistrement y vivent, plutôt qu'au pied du Bloc D déjà long.
 */
export type EtapeCollecte = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Deux libellés par étape :
 *   `label` — sur la puce, court, la barre étant défilante ;
 *   `titre` — dans le bandeau sous la barre, qui nomme l'étape en cours.
 *
 * Le bandeau existe parce que la barre défile : une puce active poussée hors
 * de l'écran laissait l'agent sans repère sur ce qu'il était en train de
 * remplir. Le titre, lui, ne bouge jamais.
 */
export const ETAPES: { step: EtapeCollecte; label: string; titre: string }[] = [
  // Les puces nomment ce qu'on saisit, plus la lettre du questionnaire papier :
  // l'agent lit un écran, pas un formulaire imprimé.
  { step: 1, label: 'Producteur', titre: 'Identité du producteur' },
  { step: 2, label: 'Parcelle', titre: 'Informations sur la parcelle' },
  { step: 3, label: 'Placette', titre: 'Localisation de la placette' },
  { step: 4, label: 'GPS', titre: 'Points GPS de la placette' },
  { step: 5, label: 'Mesures', titre: 'Mesures dendrométriques' },
  // Remplace l'ancienne étape « Autres arbres », dont le contenu a rejoint le
  // sélecteur de type du Bloc D : les autres arbres se relèvent maintenant dans
  // la sous-placette où ils poussent. Cette étape-ci répond à une autre
  // question — combien, au total, et par sous-placette.
  { step: 6, label: 'Comptage', titre: 'Résumé des comptes par sous-placette' },
  { step: 7, label: 'Valider', titre: 'Validation de la collecte' },
];

/** Dernière étape du parcours — sert de borne à la navigation. */
export const DERNIERE_ETAPE: EtapeCollecte = 7;

/**
 * Écart minimal entre deux points relevés d'une même placette, en mètres.
 * En dessous, on mesure le bruit du GPS plutôt que la parcelle.
 */
export const DISTANCE_MIN_POINTS_M = 5;

/**
 * Nom court d'un point tel que l'agent le lit sur son écran : S1, Mi3, Mc2.
 * Sert aux messages d'erreur, qui doivent désigner le point en cause dans le
 * vocabulaire de la carte, pas dans celui du modèle de données.
 */
export function libellePoint(typePoint: string, ordre: number): string {
  if (typePoint === 'MILIEU_INTERMEDIAIRE') return `Mi${ordre}`;
  if (typePoint === 'MILIEU_CENTRAL') return `Mc${ordre}`;
  return `S${ordre}`;
}
