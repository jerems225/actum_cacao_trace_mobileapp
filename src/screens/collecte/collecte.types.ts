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
  /** cm ou DBH (m) — pertinent pour le cacaoyer uniquement. */
  circoMode: 'CM' | 'DBH';
  circoValue: string;
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
  circoMode: 'CM',
  circoValue: '',
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
  circonferenceDBH?: number;
  hauteurTotale?: number;
  etatSanitaire: EtatSanitaire;
  maladieId?: string;
  maladieLibre?: string;
  photoMaladie?: string;
}

/** Les cinq étapes du parcours de saisie. */
export type EtapeCollecte = 1 | 2 | 3 | 4 | 5;

export const ETAPES: { step: EtapeCollecte; label: string }[] = [
  { step: 1, label: 'A. Prod.' },
  { step: 2, label: 'B. Prat.' },
  { step: 3, label: 'C. Infos' },
  { step: 4, label: 'C. GPS' },
  { step: 5, label: 'D. Mes.' },
];
