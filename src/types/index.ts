export type TabType = 'home' | 'enquetes' | 'collecte' | 'carte' | 'sync';

// Aligné sur l'enum Role du backend (Prisma). AGENT_TERRAIN et CHEF_EQUIPE
// s'authentifient par code agent (mobile) ; les autres via email/mot de passe.
export enum Role {
  ENQUETEUR = 'ENQUETEUR',
  CHEF_EQUIPE = 'CHEF_EQUIPE',
  SUPERVISEUR = 'SUPERVISEUR',
  ADMIN = 'ADMIN',
  AGENT_TERRAIN = 'AGENT_TERRAIN',
}

/** Libellés humanisés des rôles pour l'affichage (évite le brut "AGENT TERRAIN"). */
export const ROLE_LABELS: Record<string, string> = {
  ENQUETEUR: 'Enquêteur',
  CHEF_EQUIPE: "Chef d'équipe",
  SUPERVISEUR: 'Superviseur',
  ADMIN: 'Administrateur',
  AGENT_TERRAIN: 'Agent terrain',
};

/**
 * Rend un rôle lisible. Repli propre (Capitalisation + espaces) pour tout rôle
 * inconnu, afin de ne jamais afficher un identifiant technique tel quel.
 */
export function formatRole(role?: string | null): string {
  if (!role) return '';
  return (
    ROLE_LABELS[role] ??
    role
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

// Aligné backend : 4 tranches (bornes <30 / 30-45 / 45-60 / >60).
export enum TrancheAge {
  MOINS_30 = 'MOINS_30',
  DE_30_A_45 = 'DE_30_A_45',
  DE_45_A_60 = 'DE_45_A_60',
  PLUS_60 = 'PLUS_60',
}

export enum Genre {
  MASCULIN = 'MASCULIN',
  FEMININ = 'FEMININ',
}

/** Libellés d'affichage des tranches d'âge. */
export const TRANCHE_AGE_LABELS: Record<TrancheAge, string> = {
  [TrancheAge.MOINS_30]: 'Moins de 30 ans',
  [TrancheAge.DE_30_A_45]: '30 – 45 ans',
  [TrancheAge.DE_45_A_60]: '45 – 60 ans',
  [TrancheAge.PLUS_60]: 'Plus de 60 ans',
};

export enum SituationMatrimoniale {
  CELIBATAIRE = 'CELIBATAIRE',
  MARIE = 'MARIE',
  DIVORCE = 'DIVORCE',
  VEUF = 'VEUF',
}

export enum ExecutantEntretien {
  PROPRIETAIRE = 'PROPRIETAIRE',
  MANOEUVRE = 'MANOEUVRE',
  AGENT_TERRAIN = 'AGENT_TERRAIN',
}

export enum EtatSanitaire {
  VIVANT = 'VIVANT',
  MALADE = 'MALADE',
  MORT_SAIN = 'MORT_SAIN',
  MORT_POURRI = 'MORT_POURRI',
}

/** Libellés d'affichage des états de santé. */
export const ETAT_SANITAIRE_LABELS: Record<EtatSanitaire, string> = {
  [EtatSanitaire.VIVANT]: 'Vivant',
  [EtatSanitaire.MALADE]: 'Malade',
  [EtatSanitaire.MORT_SAIN]: 'Mort sain',
  [EtatSanitaire.MORT_POURRI]: 'Mort pourri',
};

/** Espèce d'arbre (référentiel backend, mis en cache). */
export interface Espece {
  id: string;
  nom: string;
  emetOmbre: boolean;
}

/** Maladie (référentiel backend, mis en cache). */
export interface Maladie {
  id: string;
  nom: string;
  /** VALIDE = référentiel officiel ; A_VALIDER = proposée par le terrain. */
  statut?: 'VALIDE' | 'A_VALIDER';
}

/**
 * Repli hors-ligne du référentiel des maladies.
 * Sert uniquement quand le référentiel serveur n'a pas encore été synchronisé
 * (1re installation, terrain sans réseau) : l'agent voit malgré tout une liste
 * au lieu d'un select vide. Une valeur choisie ici part en `maladieLibre` ; à la
 * synchro le backend la rapproche par nom de l'entrée déjà seedée — pas de
 * doublon, pas de passage indu en « à valider ».
 * ⚠️ À garder aligné sur MALADIES dans backend/prisma/seed-referentiels.ts.
 */
export const MALADIES_PAR_DEFAUT: string[] = [
  'Swollen shoot (virus)',
  'Pourriture brune (Phytophthora)',
  'Mirides / Capsides',
  'Anthracnose',
  'Loranthus (gui parasite)',
  'Fonte des semis',
  'Chancre du tronc',
  'Cochenilles',
  'Foreurs de tiges',
  'Termites',
  'Attaque de rongeurs / écureuils',
  'Dépérissement (cause indéterminée)',
];

/** Fréquence d'un entretien / d'une taille — valeurs fermées (colonne texte). */
export enum FrequenceType {
  HEBDOMADAIRE = 'HEBDOMADAIRE',
  MENSUEL = 'MENSUEL',
  TRIMESTRIEL = 'TRIMESTRIEL',
  SEMESTRIEL = 'SEMESTRIEL',
  ANNUEL = 'ANNUEL',
  AUTRE = 'AUTRE',
}

export const FREQUENCE_TYPE_LABELS: Record<FrequenceType, string> = {
  [FrequenceType.HEBDOMADAIRE]: 'Hebdomadaire',
  [FrequenceType.MENSUEL]: 'Mensuel',
  [FrequenceType.TRIMESTRIEL]: 'Trimestriel',
  [FrequenceType.SEMESTRIEL]: 'Semestriel',
  [FrequenceType.ANNUEL]: 'Annuel',
  [FrequenceType.AUTRE]: 'Autre',
};

// ============================================================================
// Bloc B4 — Pratiques culturales
// ----------------------------------------------------------------------------
// Reprise littérale du tableau du questionnaire papier : des cases de tête
// choisissent les volets, puis chaque volet coché est détaillé en 4 rubriques
// (types de pratiques, agent(s) pratiquant(s), fréquence, nombre de fois par an).
// ⚠️ À garder aligné sur backend/src/schemas/index.ts (PRATIQUES_RETENUES,
// TYPES_PAR_VOLET, AGENTS_PRATIQUANTS, FREQUENCES_PRATIQUE).
// ============================================================================

/** Cases de tête du B4. AUCUNE et AUTRES renvoient vers B4.1 et B4.2. */
export enum PratiqueRetenue {
  ENTRETIEN = 'ENTRETIEN',
  TAILLES = 'TAILLES',
  ENGRAIS = 'ENGRAIS',
  AUCUNE = 'AUCUNE',
  AUTRES = 'AUTRES',
}

export const PRATIQUE_RETENUE_LABELS: Record<PratiqueRetenue, string> = {
  [PratiqueRetenue.ENTRETIEN]: 'Entretien',
  [PratiqueRetenue.TAILLES]: 'Tailles',
  [PratiqueRetenue.ENGRAIS]: 'Engrais',
  [PratiqueRetenue.AUCUNE]: 'Aucune pratique',
  [PratiqueRetenue.AUTRES]: 'Autres',
};

/** Les trois volets détaillables (sous-ensemble des cases de tête). */
export const VOLETS_PRATIQUE = [
  PratiqueRetenue.ENTRETIEN,
  PratiqueRetenue.TAILLES,
  PratiqueRetenue.ENGRAIS,
] as const;
export type VoletPratique = (typeof VOLETS_PRATIQUE)[number];

/**
 * Types de pratiques proposés par volet, dans l'ordre du formulaire papier.
 * Seul TAILLES porte une case « Autres : … » sur cette ligne.
 */
export const TYPES_PAR_VOLET: Record<VoletPratique, { code: string; label: string }[]> = {
  [PratiqueRetenue.ENTRETIEN]: [
    { code: 'DESHERBAGE_MANUEL', label: 'Désherbage manuel' },
    { code: 'DESHERBAGE_CHIMIQUE', label: 'Désherbage chimique (produit phytosanitaire)' },
  ],
  [PratiqueRetenue.TAILLES]: [
    { code: 'EGOURMANDAGE', label: 'Égourmandage' },
    { code: 'PLANTES_PARASITAIRES', label: 'Plantes parasitaires (loranthacées, épiphytes)' },
    { code: 'RECOLTE_SANITAIRE', label: 'Récolte sanitaire' },
    { code: 'AUTRES', label: 'Autres' },
  ],
  [PratiqueRetenue.ENGRAIS]: [
    { code: 'ENGRAIS_SYNTHETIQUE', label: 'Engrais synthétique (chimique)' },
    { code: 'ENGRAIS_ORGANIQUE', label: 'Engrais organique (biologique)' },
  ],
};

/** Agent(s) réalisant la pratique — mêmes options pour les trois volets. */
export enum AgentPratiquant {
  PLANTEUR = 'PLANTEUR',
  MANOEUVRE = 'MANOEUVRE',
  AGENT_TERRAIN = 'AGENT_TERRAIN',
  PRODUCTEUR_RELAIS = 'PRODUCTEUR_RELAIS',
  AUTRE = 'AUTRE',
}

// Libellés fidèles au formulaire papier que l'enquêteur a en main — d'où
// « Agent ANADER » pour le code technique AGENT_TERRAIN.
export const AGENT_PRATIQUANT_LABELS: Record<AgentPratiquant, string> = {
  [AgentPratiquant.PLANTEUR]: 'Planteur',
  [AgentPratiquant.MANOEUVRE]: 'Manœuvre',
  [AgentPratiquant.AGENT_TERRAIN]: 'Agent ANADER',
  [AgentPratiquant.PRODUCTEUR_RELAIS]: 'Producteur relais (PR)',
  [AgentPratiquant.AUTRE]: 'Autres',
};

/** Fréquence déclarée — mêmes options pour les trois volets. */
export enum FrequencePratique {
  MENSUEL = 'MENSUEL',
  TRIMESTRIEL = 'TRIMESTRIEL',
  SEMESTRIEL = 'SEMESTRIEL',
  AUTRE = 'AUTRE',
}

export const FREQUENCE_PRATIQUE_LABELS: Record<FrequencePratique, string> = {
  [FrequencePratique.MENSUEL]: 'Mensuel',
  [FrequencePratique.TRIMESTRIEL]: 'Trimestriel',
  [FrequencePratique.SEMESTRIEL]: 'Semestriel',
  [FrequencePratique.AUTRE]: 'Autres',
};

/** Détail d'un volet, tel qu'envoyé au backend. */
export interface PratiqueCulturaleLocal {
  volet: VoletPratique;
  types: string[];
  typesAutre?: string;
  agents: AgentPratiquant[];
  agentsAutre?: string;
  frequence?: FrequencePratique;
  frequenceAutre?: string;
  nombreFoisParAn?: number;
}

/**
 * Cycle de vie d'une collecte, porté par la parcelle.
 * BROUILLON : fiche incomplète, l'agent la complétera plus tard. Elle est bien
 *   synchronisée (rien n'est perdu si l'appareil casse) mais reste exclue des
 *   statistiques et des exports.
 * SOUMISE : fiche déclarée terminée. Plus modifiable depuis le mobile ; seule
 *   l'administration peut la corriger.
 */
export enum StatutCollecte {
  BROUILLON = 'BROUILLON',
  SOUMISE = 'SOUMISE',
}

export const STATUT_COLLECTE_LABELS: Record<StatutCollecte, string> = {
  [StatutCollecte.BROUILLON]: 'Brouillon',
  [StatutCollecte.SOUMISE]: 'Soumise',
};

/** Unité de l'estimation de production — valeurs fermées (colonne texte). */
export enum UniteProduction {
  KG_PAR_TRAITE = 'KG_PAR_TRAITE',
  KG_PAR_AN = 'KG_PAR_AN',
}

export const UNITE_PRODUCTION_LABELS: Record<UniteProduction, string> = {
  [UniteProduction.KG_PAR_TRAITE]: 'kg par traite',
  [UniteProduction.KG_PAR_AN]: 'kg par an',
};

export enum TypeSujet {
  CACAO = 'CACAO',
  ARBRE_OMBRAGE = 'ARBRE_OMBRAGE',
}

export enum TypePoint {
  SOMMET = 'SOMMET',
  MILIEU_INTERMEDIAIRE = 'MILIEU_INTERMEDIAIRE',
  MILIEU_CENTRAL = 'MILIEU_CENTRAL',
}

export interface PointGPS {
  typePoint: TypePoint;
  ordreSommet: number; // ordre dans la catégorie (S1-4, Mi1-6, Mc1-2)
  latitude: number;
  longitude: number;
  altitude?: number;
  precision?: number;
}

export interface ProducteurLocal {
  id: string;
  serverId?: string;
  nom: string;
  prenoms: string;
  genre?: Genre;
  identiteProprietaire?: string;
  trancheAge?: TrancheAge;
  situationMatrimoniale?: SituationMatrimoniale;
  situationFamiliale?: string;
  nombreEnfantsCharge?: number;
  consentementDonne: boolean;
  consentementDate?: string;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParcelleLocal {
  id: string;
  serverId?: string;
  producteurId: string;
  producteurNom?: string;
  /** Cycle de vie de la collecte. Absent = collecte antérieure, donc soumise. */
  statutCollecte?: StatutCollecte;
  anneeParcelle?: number;
  superficie?: number;
  // --- Bloc B4 : pratiques culturales ---
  pratiquesRetenues?: PratiqueRetenue[];
  /** B4.1 — précision si « Aucune pratique » est cochée. */
  aucunePratiquePrecision?: string;
  /** B4.2 — précision si « Autres » est cochée. */
  autresPratiquesPrecision?: string;
  /** Détail des volets cochés (0 à 3). */
  pratiques?: PratiqueCulturaleLocal[];

  // --- Champs de pratiques dépréciés (remplacés par `pratiques`) ---
  // Conservés pour lire les collectes enregistrées avant la refonte du B4.
  executantEntretien?: ExecutantEntretien;
  typeEntretien?: string;
  frequenceEntretienAn?: number;
  frequenceEntretienType?: string;
  executantTaille?: string;
  frequenceTailleAn?: number;
  typeIntrants?: string;
  raisonNonUtilisationIntrants?: string;
  autresEntretiens?: string;
  // État sanitaire au niveau parcelle : déprécié, retiré de la saisie du Bloc B.
  // Relevé par sujet au Bloc D. Conservé pour lire les collectes antérieures.
  maladiesObservees?: string;
  ancienneteMaladies?: string;
  maladiesNonListees?: string;
  productionEstimee?: number;
  uniteProduction?: UniteProduction;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Référentiel géographique paramétrable (source : backend, mis en cache). */
export interface Ville {
  id: string;
  delegationId: string;
  code: string;
  nom: string;
}

export interface Delegation {
  id: string;
  code: string;
  nom: string;
  villes: Ville[];
}

export interface PlacetteLocal {
  id: string;
  serverId?: string;
  parcelleId: string;
  numeroPlacette: string;
  delegationRegionale: string;
  delegationId?: string;
  villeId?: string;
  ville?: string;
  village?: string;
  zoneCadastrale?: string;
  typologiePreIdentifiee?: string;
  chefEquipe?: string;
  dateInventaire?: string;
  sommets: PointGPS[];
  sousPlacettes: SousPlacetteLocal[];
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SousPlacetteLocal {
  id: string;
  placetteId: string;
  numero: number;
  nombrePlantsCacao?: number;
  nombreArbres?: number;
  sommets: PointGPS[];
  mesures: MesureArbreLocal[];
}

export interface MesureArbreLocal {
  id: string;
  sousPlacetteId: string;
  typeSujet: TypeSujet;
  espece?: string;
  especeId?: string;
  especeLibre?: string;
  emetOmbre?: boolean;
  estMature?: boolean;
  circonference30cm?: number;
  circonferenceDBH?: number;
  hauteurFut?: number;
  hauteurTotale?: number;
  etatSanitaire: EtatSanitaire;
  precisionEtat?: string;
  maladieId?: string;
  maladieLibre?: string;
  photoMaladie?: string;
  createdAt: string;
}

/** Entités synchronisables (doit rester aligné avec le backend). */
export type SyncEntity =
  | 'Producteur'
  | 'Parcelle'
  | 'Placette'
  | 'SousPlacette'
  | 'MesureArbre'
  | 'Photo';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

/** Cycle de vie d'un élément de la file de synchronisation. */
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';

export interface SyncQueueRecord {
  id: string;
  clientId: string;
  entity: SyncEntity;
  action: SyncAction;
  payload: Record<string, unknown>;
  status: SyncStatus;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface SyncHistoryEntry {
  id: string;
  date: string;
  synced: number;
  failed: number;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
}
