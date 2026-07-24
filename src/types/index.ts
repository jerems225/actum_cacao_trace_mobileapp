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

export enum TrancheAge {
  MOINS_25 = 'MOINS_25',
  DE_25_A_35 = 'DE_25_A_35',
  DE_36_A_45 = 'DE_36_A_45',
  DE_46_A_60 = 'DE_46_A_60',
  PLUS_60 = 'PLUS_60',
}

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
  SAIN = 'SAIN',
  MALADE = 'MALADE',
  MORT = 'MORT',
}

export enum TypeSujet {
  CACAO = 'CACAO',
  ARBRE_OMBRAGE = 'ARBRE_OMBRAGE',
}

export interface PointGPS {
  ordreSommet: number;
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
  anneeParcelle?: number;
  superficie?: number;
  executantEntretien?: ExecutantEntretien;
  typeEntretien?: string;
  frequenceEntretienAn?: number;
  frequenceEntretienType?: string;
  executantTaille?: string;
  frequenceTailleAn?: number;
  typeIntrants?: string;
  raisonNonUtilisationIntrants?: string;
  autresEntretiens?: string;
  maladiesObservees?: string;
  ancienneteMaladies?: string;
  maladiesNonListees?: string;
  productionEstimee?: number;
  uniteProduction?: string;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlacetteLocal {
  id: string;
  serverId?: string;
  parcelleId: string;
  numeroPlacette: string;
  delegationRegionale: string;
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
  sommets: PointGPS[];
  mesures: MesureArbreLocal[];
}

export interface MesureArbreLocal {
  id: string;
  sousPlacetteId: string;
  typeSujet: TypeSujet;
  espece?: string;
  estMature?: boolean;
  circonference30cm?: number;
  circonferenceDBH?: number;
  hauteurFut?: number;
  hauteurTotale?: number;
  etatSanitaire: EtatSanitaire;
  precisionEtat?: string;
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
