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
 * Brouillon de saisie d'UNE mesure, propre à une sous-placette.
 * Chaque SP possède le sien : c'est ce qui garantit que la circonférence tapée
 * pour SP1 ne réapparaît pas dans SP2.
 */
export interface MesureDraft {
  typeSujet: TypeSujet;
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
  /** Hauteur du fût (jusqu'aux premières branches) et hauteur totale, en m. */
  hauteurFut: string;
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
  typeSujet: TypeSujet.CACAO,
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
 * Étapes du parcours de saisie.
 * La 6e est une page de validation : le récapitulatif de ce qui manque et les
 * deux actions d'enregistrement y vivent, plutôt qu'au pied du Bloc D déjà long.
 */
export type EtapeCollecte = 1 | 2 | 3 | 4 | 5 | 6;

export const ETAPES: { step: EtapeCollecte; label: string }[] = [
  // Les puces nomment ce qu'on saisit, plus la lettre du questionnaire papier :
  // l'agent lit un écran, pas un formulaire imprimé.
  { step: 1, label: 'Producteur' },
  { step: 2, label: 'Parcelle' },
  { step: 3, label: 'Placette' },
  { step: 4, label: 'GPS' },
  { step: 5, label: 'Mesures' },
  // Libellé court : six puces se partagent la largeur, « Validation » passait à la ligne.
  { step: 6, label: 'Valider' },
];

/** Dernière étape du parcours — sert de borne à la navigation. */
export const DERNIERE_ETAPE: EtapeCollecte = 6;

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
