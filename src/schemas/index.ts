import { z } from 'zod';

const CI_LAT_MIN = 4.0;
const CI_LAT_MAX = 10.8;
const CI_LON_MIN = -8.6;
const CI_LON_MAX = -2.5;

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
  nom: z.string().min(1, 'Le nom est obligatoire'),
  prenoms: z.string().min(1, 'Les prénoms sont obligatoires'),
  identiteProprietaire: z.string().optional(),
  trancheAge: z.enum(['MOINS_25', 'DE_25_A_35', 'DE_36_A_45', 'DE_46_A_60', 'PLUS_60']).optional(),
  situationMatrimoniale: z.enum(['CELIBATAIRE', 'MARIE', 'DIVORCE', 'VEUF']).optional(),
  situationFamiliale: z.string().optional(),
  nombreEnfantsCharge: z.number().int().min(0).optional(),
  consentementDonne: z.boolean().refine((val) => val === true, {
    message: 'Le consentement du producteur (RGPD) est obligatoire pour enregistrer',
  }),
});

export const ParcelleFormSchema = z.object({
  producteurId: z.string().min(1, 'Producteur requis'),
  anneeParcelle: z.number().int().min(1900).max(2100).optional(),
  superficie: z.number().positive('La superficie doit être > 0').optional(),
  executantEntretien: z.enum(['PROPRIETAIRE', 'MANOEUVRE', 'AGENT_TERRAIN']).optional(),
  typeEntretien: z.string().optional(),
  frequenceEntretienAn: z.number().int().min(0).optional(),
  frequenceEntretienType: z.string().optional(),
  executantTaille: z.string().optional(),
  frequenceTailleAn: z.number().int().min(0).optional(),
  typeIntrants: z.string().optional(),
  raisonNonUtilisationIntrants: z.string().optional(),
  autresEntretiens: z.string().optional(),
  maladiesObservees: z.string().optional(),
  ancienneteMaladies: z.string().optional(),
  maladiesNonListees: z.string().optional(),
  productionEstimee: z.number().min(0).optional(),
  uniteProduction: z.string().optional(),
});

export const PlacetteFormSchema = z.object({
  parcelleId: z.string().min(1, 'Parcelle requise'),
  numeroPlacette: z.string().min(1, 'N° Placette requis'),
  delegationRegionale: z.string().min(1, 'Délégation Régionale requise'),
  ville: z.string().optional(),
  village: z.string().optional(),
  zoneCadastrale: z.string().optional(),
  typologiePreIdentifiee: z.string().optional(),
  chefEquipe: z.string().optional(),
  dateInventaire: z.string().optional(),
  sommets: z.array(PointGPSSchema).length(4, 'Exactement 4 sommets GPS requis pour la placette'),
});

export const MesureArbreFormSchema = z.object({
  typeSujet: z.enum(['CACAO', 'ARBRE_OMBRAGE']),
  espece: z.string().optional(),
  estMature: z.boolean().optional(),
  circonference30cm: z.number().positive().optional(),
  circonferenceDBH: z.number().positive().optional(),
  hauteurFut: z.number().positive().optional(),
  hauteurTotale: z.number().positive().optional(),
  etatSanitaire: z.enum(['SAIN', 'MALADE', 'MORT']).default('SAIN'),
  precisionEtat: z.string().optional(),
});
