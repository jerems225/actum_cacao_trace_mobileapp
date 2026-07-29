// ============================================================================
// CacaoTrace — Schémas Zod mobile (contrôle de forme des payloads)
// ----------------------------------------------------------------------------
// Miroir allégé des schémas backend (backend/src/schemas/index.ts). Sert de
// filet de sécurité avant mise en file de synchronisation.
// Les bornes numériques viennent d'une seule source : `LIMITES`
// (mobile/src/utils/champs.ts), elle-même alignée sur le backend.
//
// ⚠️ Ces schémas ne sont pas encore branchés sur le wizard de collecte, qui
// valide en ligne champ par champ. Ils restent la référence si l'on veut
// centraliser cette validation plus tard — d'où l'obligation de les maintenir
// exacts : un schéma faux serait pire que pas de schéma.
// ============================================================================

import { z } from 'zod';
import { LIMITES } from '../utils/champs';

const CI_LAT_MIN = 4.0;
const CI_LAT_MAX = 10.8;
const CI_LON_MIN = -8.6;
const CI_LON_MAX = -2.5;

/** `max` facultatif : certaines grandeurs n'ont pas de plafond défendable. */
const borne = (l: { min: number; max?: number }) => {
  const base = z.number().min(l.min);
  return l.max === undefined ? base : base.max(l.max);
};

export const PointGPSSchema = z.object({
  ordreSommet: z.number().int().min(1).max(4),
  latitude: z
    .number()
    .min(CI_LAT_MIN, `Latitude doit être >= ${CI_LAT_MIN} (Côte d'Ivoire)`)
    .max(CI_LAT_MAX, `Latitude doit être <= ${CI_LAT_MAX} (Côte d'Ivoire)`),
  longitude: z
    .number()
    .min(CI_LON_MIN, `Longitude doit être >= ${CI_LON_MIN} (Côte d'Ivoire)`)
    .max(CI_LON_MAX, `Longitude doit être <= ${CI_LON_MAX} (Côte d'Ivoire)`),
  altitude: z.number().optional(),
  precision: z.number().min(0).optional(),
});

export const ProducteurFormSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire'),
  prenoms: z.string().trim().min(1, 'Les prénoms sont obligatoires'),
  identiteProprietaire: z.string().trim().optional(),
  genre: z.enum(['MASCULIN', 'FEMININ']).optional(),
  trancheAge: z.enum(['MOINS_30', 'DE_30_A_45', 'DE_45_A_60', 'PLUS_60']).optional(),
  situationMatrimoniale: z.enum(['CELIBATAIRE', 'MARIE', 'DIVORCE', 'VEUF']).optional(),
  situationFamiliale: z.string().trim().optional(),
  nombreEnfantsCharge: z.number().int().min(0).max(30).optional(),
  consentementDonne: z.boolean().refine((val) => val === true, {
    message: 'Le consentement du producteur (RGPD) est obligatoire pour enregistrer',
  }),
});

export const ParcelleFormSchema = z.object({
  producteurId: z.string().min(1, 'Producteur requis'),
  anneeParcelle: z.number().int().min(LIMITES.anneeParcelle.min).max(LIMITES.anneeParcelle.max).optional(),
  superficie: borne(LIMITES.superficieHa).optional(),
  executantEntretien: z.enum(['PROPRIETAIRE', 'MANOEUVRE', 'AGENT_TERRAIN']).optional(),
  typeEntretien: z.string().trim().optional(),
  frequenceEntretienAn: z.number().int().min(0).max(52).optional(),
  frequenceEntretienType: z
    .enum(['HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL', 'AUTRE'])
    .optional(),
  executantTaille: z.string().trim().optional(),
  frequenceTailleAn: z.number().int().min(0).max(52).optional(),
  typeIntrants: z.string().trim().optional(),
  raisonNonUtilisationIntrants: z.string().trim().optional(),
  autresEntretiens: z.string().trim().optional(),
  maladiesObservees: z.string().trim().optional(),
  ancienneteMaladies: z.string().trim().optional(),
  maladiesNonListees: z.string().trim().optional(),
  productionEstimee: borne(LIMITES.productionSacsAn).optional(),
  // 'SACS_PAR_AN' est l'unité désormais saisie ; les deux autres restent
  // acceptées pour les fiches enregistrées avant le changement d'unité.
  uniteProduction: z.enum(['KG_PAR_TRAITE', 'KG_PAR_AN', 'SACS_PAR_AN']).optional(),
});

export const PlacetteFormSchema = z.object({
  parcelleId: z.string().min(1, 'Parcelle requise'),
  numeroPlacette: z.string().min(1, 'N° Placette requis'),
  delegationRegionale: z.string().min(1, 'Délégation Régionale requise'),
  ville: z.string().optional(),
  village: z.string().trim().optional(),
  zoneCadastrale: z.string().trim().optional(),
  typologiePreIdentifiee: z.string().trim().optional(),
  chefEquipe: z.string().trim().optional(),
  dateInventaire: z.string().optional(),
  sommets: z.array(PointGPSSchema).length(4, 'Exactement 4 sommets GPS requis pour la placette'),
});

export const SousPlacetteFormSchema = z.object({
  numero: z.number().int().min(1).max(6),
  nombrePlantsCacao: z.number().int().min(LIMITES.comptageSP.min).max(LIMITES.comptageSP.max).optional(),
  nombreArbres: z.number().int().min(LIMITES.comptageSP.min).max(LIMITES.comptageSP.max).optional(),
});

export const MesureArbreFormSchema = z
  .object({
    typeSujet: z.enum(['CACAO', 'ARBRE_OMBRAGE']),
    espece: z.string().trim().optional(),
    especeId: z.string().optional(),
    especeLibre: z.string().trim().optional(),
    emetOmbre: z.boolean().optional(),
    estMature: z.boolean().optional(),
    circonference30cm: borne(LIMITES.circonference30cmCm).optional(),
    // Circonférence à 1,30 m, désormais en centimètres comme celle à 30 cm.
    circonferenceDBH: borne(LIMITES.circonference130cm).optional(),
    hauteurFut: borne(LIMITES.hauteurM).optional(),
    hauteurTotale: borne(LIMITES.hauteurM).optional(),
    etatSanitaire: z
      .enum(['VIVANT', 'MALADE', 'MORT_SAIN', 'MORT_POURRI'])
      .default('VIVANT'),
    precisionEtat: z.string().trim().optional(),
    maladieId: z.string().optional(),
    maladieLibre: z.string().trim().optional(),
    photoMaladie: z.string().optional(),
  })
  .refine((d) => d.typeSujet !== 'ARBRE_OMBRAGE' || !!(d.especeId || d.especeLibre || d.espece), {
    message: "L'espèce est requise pour un arbre",
    path: ['especeId'],
  })
  .refine((d) => !(d.circonference30cm !== undefined && d.circonferenceDBH !== undefined), {
    message: 'Une seule mesure de grosseur : circonférence (cm) OU DBH (m)',
    path: ['circonference30cm'],
  })
  .refine((d) => d.typeSujet !== 'ARBRE_OMBRAGE' || d.circonference30cm === undefined, {
    message: "Pour un arbre d'ombrage, la grosseur se saisit en DBH (m)",
    path: ['circonference30cm'],
  })
  .refine((d) => d.etatSanitaire !== 'MALADE' || !!(d.maladieId || d.maladieLibre), {
    message: 'La maladie est requise quand le sujet est MALADE',
    path: ['maladieId'],
  })
  .refine((d) => d.etatSanitaire !== 'MALADE' || !!d.photoMaladie, {
    message: 'Une photo de diagnostic est requise pour un sujet MALADE',
    path: ['photoMaladie'],
  });
