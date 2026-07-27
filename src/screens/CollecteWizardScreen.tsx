import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '../components/common/Header';
import { SelectField, type SelectOption } from '../components/common/SelectField';
import { PlacettePointsCapture } from '../components/GPS/PlacettePointsCapture';
import type { ManualPointValues } from '../components/GPS/PlacettePointsCapture';
import { colors, useResponsive } from '../theme';
import { createStyles } from './collecte/collecte.styles';
import {
  CLE_AUTRE,
  DRAFT_VIDE,
  ETAPES,
  VOLET_VIDE,
  type EtapeCollecte,
  type MesureCollectee,
  type MesureDraft,
  type VoletDraft,
} from './collecte/collecte.types';
import { LocationService, LocationError } from '../services/location';
import { offlineStorage } from '../services/storage';
import { delegationsService } from '../services/delegations';
import { settingsService } from '../services/settings';
import { referentielsService } from '../services/referentiels';
import { notificationService } from '../services/notification';
import { toast } from '../components/common/Toast';
import {
  TypeSujet,
  EtatSanitaire,
  Genre,
  TrancheAge,
  TypePoint,
  UniteProduction,
  StatutCollecte,
  PratiqueRetenue,
  AgentPratiquant,
  FrequencePratique,
  VOLETS_PRATIQUE,
  TYPES_PAR_VOLET,
  TRANCHE_AGE_LABELS,
  ETAT_SANITAIRE_LABELS,
  PRATIQUE_RETENUE_LABELS,
  AGENT_PRATIQUANT_LABELS,
  FREQUENCE_PRATIQUE_LABELS,
  MALADIES_PAR_DEFAUT,
  formatRole,
} from '../types';
import {
  LIMITES,
  parseNombre,
  sanitizeDecimal,
  sanitizeEntier,
  verifieBorne,
} from '../utils/champs';
import type { UserProfile } from '../services/auth';
import type {
  PointGPS,
  TabType,
  SousPlacetteLocal,
  Delegation,
  PlacetteLocal,
  Espece,
  Maladie,
  VoletPratique,
  PratiqueCulturaleLocal,
} from '../types';

interface CollecteWizardScreenProps {
  onNavigate: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
  /**
   * Identifiant local de la parcelle à reprendre. Renseigné = mode modification :
   * le même parcours de saisie, prérempli, et un envoi en modification plutôt
   * qu'en création.
   */
  editParcelleId?: string | null;
  /** Appelé quand la reprise est terminée, pour libérer le mode modification. */
  onEditDone?: () => void;
}

export const CollecteWizardScreen: React.FC<CollecteWizardScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
  editParcelleId,
  onEditDone,
}) => {
  const modeEdition = !!editParcelleId;
  const responsive = useResponsive();
  const { paddingHorizontal, contentStyle } = responsive;
  // Recalculé uniquement quand les dimensions changent (rotation, tablette).
  const styles = useMemo(() => createStyles(responsive), [responsive]);
  const [currentStep, setCurrentStep] = useState<EtapeCollecte>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chargementEdition, setChargementEdition] = useState(false);
  // Référence de la ScrollView : sert à remonter en haut à chaque étape.
  const scrollRef = useRef<ScrollView>(null);

  // --- Bloc A ---
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [genre, setGenre] = useState<Genre | null>(null);
  const [trancheAge, setTrancheAge] = useState<TrancheAge | null>(null);
  const [identite, setIdentite] = useState('');
  const [rgpdConsent, setRgpdConsent] = useState(true);

  // --- Bloc B ---
  const [anneeParcelle, setAnneeParcelle] = useState('');
  const [superficie, setSuperficie] = useState('');
  // B4 — cases de tête : quels volets sont à renseigner.
  const [pratiquesRetenues, setPratiquesRetenues] = useState<PratiqueRetenue[]>([]);
  const [aucunePrecision, setAucunePrecision] = useState(''); // B4.1
  const [autresPrecision, setAutresPrecision] = useState(''); // B4.2
  // Détail des volets : un brouillon PAR volet. Même principe qu'au Bloc D —
  // Entretien, Tailles et Engrais ne partagent aucun champ.
  const [voletsDetail, setVoletsDetail] = useState<Record<VoletPratique, VoletDraft>>({
    [PratiqueRetenue.ENTRETIEN]: { ...VOLET_VIDE },
    [PratiqueRetenue.TAILLES]: { ...VOLET_VIDE },
    [PratiqueRetenue.ENGRAIS]: { ...VOLET_VIDE },
  });
  const [voletActif, setVoletActif] = useState<VoletPratique | null>(null);
  const [productionEstimee, setProductionEstimee] = useState('');

  // Volets réellement à saisir = intersection des cases cochées et des 3 volets.
  const voletsCoches = VOLETS_PRATIQUE.filter((v) => pratiquesRetenues.includes(v));
  // Onglet courant : celui choisi s'il est encore coché, sinon le premier.
  // Calculé plutôt que synchronisé, pour ne jamais pointer un volet décoché.
  const voletCourant: VoletPratique | null =
    voletActif && voletsCoches.includes(voletActif) ? voletActif : voletsCoches[0] ?? null;
  const detailCourant = voletCourant ? voletsDetail[voletCourant] : null;

  /** Un volet est « entamé » dès qu'une case a été cochée quelque part. */
  const voletEntame = (v: VoletPratique) => {
    const d = voletsDetail[v];
    return d.types.length > 0 || d.agents.length > 0 || d.frequence !== null;
  };
  /**
   * Un volet est « complété » quand les trois rubriques à cocher du questionnaire
   * ont une réponse. Le nombre de fois par an n'entre pas dans le compte : la
   * case est vide sur le formulaire papier, tous les producteurs ne le savent pas.
   */
  const voletComplet = (v: VoletPratique) => {
    const d = voletsDetail[v];
    return d.types.length > 0 && d.agents.length > 0 && d.frequence !== null;
  };

  const patchVolet = (patch: Partial<VoletDraft>) => {
    if (!voletCourant) return;
    setVoletsDetail((prev) => ({
      ...prev,
      [voletCourant]: { ...prev[voletCourant], ...patch },
    }));
  };

  /**
   * Coche/décoche une case de tête du B4.
   * « Aucune pratique » est exclusive des trois volets : cocher l'une décoche
   * l'autre, plutôt que de laisser passer une fiche contradictoire.
   */
  const togglePratiqueRetenue = (p: PratiqueRetenue) =>
    setPratiquesRetenues((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (p === PratiqueRetenue.AUCUNE) {
        return [...prev.filter((x) => !VOLETS_PRATIQUE.includes(x as VoletPratique)), p];
      }
      const sansAucune = prev.filter((x) => x !== PratiqueRetenue.AUCUNE);
      return [...sansAucune, p];
    });

  const toggleDansListe = <T,>(liste: T[], valeur: T): T[] =>
    liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];

  // --- Bloc C : référentiel géographique (délégation → ville) ---
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [placettesLocales, setPlacettesLocales] = useState<PlacetteLocal[]>([]);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [villeId, setVilleId] = useState<string | null>(null);
  const [village, setVillage] = useState('');
  // Tous les points de la placette (S1-4, Mi1-6, Mc1-2).
  const [points, setPoints] = useState<PointGPS[]>([]);
  const [capturing, setCapturing] = useState<{ type: TypePoint; ordre: number } | null>(null);
  const sommetsOnly = points.filter((p) => p.typePoint === TypePoint.SOMMET);

  // Édition manuelle des coordonnées : interdite à l'agent terrain, sauf si
  // l'administration l'a activée via le réglage `agentManualPointEdit`.
  const [manualEditEnabled, setManualEditEnabled] = useState(false);
  const canEditPoints = user?.role !== 'AGENT_TERRAIN' || manualEditEnabled;

  // --- Identification de la collecte ---
  // Date relevée automatiquement par le système à l'ouverture de la fiche.
  const [collecteDate] = useState(() => new Date());
  // Chef d'équipe : pré-rempli si l'agent connecté est lui-même chef d'équipe.
  const [chefEquipe, setChefEquipe] = useState(
    user?.role === 'CHEF_EQUIPE' ? `${user.prenoms} ${user.nom}`.trim() : '',
  );
  const dateCollecteLabel = `${String(collecteDate.getDate()).padStart(2, '0')}/${String(
    collecteDate.getMonth() + 1,
  ).padStart(2, '0')}/${collecteDate.getFullYear()}`;

  // Chargement du référentiel (cache immédiat, puis rafraîchissement réseau)
  // et des placettes locales (pour l'aperçu du compteur).
  useEffect(() => {
    (async () => {
      setDelegations(await delegationsService.getCached());
      setPlacettesLocales(await offlineStorage.getPlacettes());
      setManualEditEnabled((await settingsService.getCached()).agentManualPointEdit);
      setEspeces(await referentielsService.getEspecesCached());
      setMaladiesList(await referentielsService.getMaladiesCached());
      setDelegations(await delegationsService.refresh());
      setManualEditEnabled((await settingsService.refresh()).agentManualPointEdit);
      const ref = await referentielsService.refresh();
      setEspeces(ref.especes);
      setMaladiesList(ref.maladies);
    })();
  }, []);

  const selectedDelegation = delegations.find((d) => d.id === delegationId) ?? null;
  const selectedVille = selectedDelegation?.villes.find((v) => v.id === villeId) ?? null;

  // Aperçu du numéro : le compteur définitif est attribué par le serveur à la
  // synchro ; ici on propose une séquence LOCALE provisoire (placettes déjà
  // saisies pour ce couple délégation/ville + 1).
  const sequenceProvisoire =
    placettesLocales.filter((p) => p.delegationId === delegationId && p.villeId === villeId)
      .length + 1;
  const numeroApercu =
    selectedDelegation && selectedVille
      ? `D-${selectedDelegation.code}-${selectedVille.code}-${String(sequenceProvisoire).padStart(3, '0')}`
      : null;

  // --- Bloc D ---
  const [selectedSP, setSelectedSP] = useState(1);
  // Référentiels espèces / maladies (chargés + mis en cache)
  const [especes, setEspeces] = useState<Espece[]>([]);
  const [maladiesList, setMaladiesList] = useState<Maladie[]>([]);
  // Compteurs par sous-placette
  const [nombrePlantsBySP, setNombrePlantsBySP] = useState<Record<number, string>>({});
  const [nombreArbresBySP, setNombreArbresBySP] = useState<Record<number, string>>({});
  const [mesuresCollectees, setMesuresCollectees] = useState<MesureCollectee[]>([]);
  // Un brouillon de saisie PAR sous-placette : SP1 et SP4 ne partagent plus
  // aucun champ. Basculer d'onglet retrouve la saisie laissée en cours, sans
  // jamais recopier les valeurs d'une autre sous-placette.
  const [draftsBySP, setDraftsBySP] = useState<Record<number, MesureDraft>>({});

  const draft = draftsBySP[selectedSP] ?? DRAFT_VIDE;
  const patchDraft = (patch: Partial<MesureDraft>) =>
    setDraftsBySP((prev) => ({
      ...prev,
      [selectedSP]: { ...(prev[selectedSP] ?? DRAFT_VIDE), ...patch },
    }));

  const isCacao = draft.typeSujet === TypeSujet.CACAO;
  // Un arbre d'ombrage se mesure toujours en DBH (m) ; le choix cm/DBH ne
  // concerne que le cacaoyer.
  const circoMode: 'CM' | 'DBH' = isCacao ? draft.circoMode : 'DBH';
  const limiteCirco = circoMode === 'CM' ? LIMITES.circonference30cmCm : LIMITES.circonferenceDBHM;

  const cacaoCountForSP = mesuresCollectees.filter(
    (m) => m.numeroSP === selectedSP && m.typeSujet === TypeSujet.CACAO,
  ).length;

  /**
   * Maladies proposées : le référentiel serveur dès qu'il est synchronisé,
   * sinon le repli embarqué pour que la liste ne soit jamais vide sur le
   * terrain. Une option sans `id` partira en `maladieLibre` (le backend la
   * rapproche par nom).
   */
  const maladieOptions: SelectOption[] = [
    ...(maladiesList.length
      ? maladiesList.map((m) => ({ key: `id:${m.id}`, label: m.nom }))
      : MALADIES_PAR_DEFAUT.map((nom) => ({ key: `nom:${nom}`, label: nom }))),
    // « Autres » toujours en dernier : on parcourt d'abord le référentiel.
    { key: CLE_AUTRE, label: 'Autres (à préciser)' },
  ];

  /** Espèces d'arbre proposées, même principe : référentiel puis « Autres ». */
  const especeOptions: SelectOption[] = [
    ...especes.map((e) => ({
      key: `id:${e.id}`,
      label: e.nom,
      hint: e.emetOmbre ? undefined : "n'émet pas d'ombre",
    })),
    { key: CLE_AUTRE, label: 'Autres (à préciser)' },
  ];

  const parseNum = parseNombre;

  const handleCapturePoint = async (type: TypePoint, ordre: number) => {
    if (capturing) return;
    setCapturing({ type, ordre });
    try {
      const point = await LocationService.getCurrentPosition(type, ordre);
      setPoints((prev) => {
        // Remplace le point de même catégorie+ordre s'il existe (re-capture).
        const filtered = prev.filter(
          (p) => !(p.typePoint === type && p.ordreSommet === ordre),
        );
        return [...filtered, point];
      });
    } catch (e) {
      const message = e instanceof LocationError ? e.message : 'Échec de la capture GPS.';
      toast.error(message);
    } finally {
      setCapturing(null);
    }
  };

  // Correction manuelle des coordonnées d'un point déjà relevé.
  const handleEditPoint = (type: TypePoint, ordre: number, values: ManualPointValues) => {
    setPoints((prev) => {
      const existing = prev.find((p) => p.typePoint === type && p.ordreSommet === ordre);
      if (!existing) return prev;
      const filtered = prev.filter((p) => !(p.typePoint === type && p.ordreSommet === ordre));
      return [...filtered, { ...existing, ...values }];
    });
  };

  /** Photo de diagnostic (état MALADE) : caméra, repli galerie. */
  const handleCapturePhotoMaladie = async () => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.granted) {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!r.canceled && r.assets?.[0]) patchDraft({ photoMaladie: r.assets[0].uri });
        return;
      }
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        toast.error('Autorisation caméra ou galerie requise pour la photo de diagnostic.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (!r.canceled && r.assets?.[0]) patchDraft({ photoMaladie: r.assets[0].uri });
    } catch {
      toast.error('Impossible de prendre la photo.');
    }
  };

  const handleAddMesure = () => {
    // Règle SP2-6 : 3 cacaoyers maximum (SP1 illimité).
    if (isCacao && selectedSP !== 1 && cacaoCountForSP >= 3) {
      toast.error('Maximum 3 cacaoyers par sous-placette (SP2 à SP6).');
      return;
    }

    // Espèce obligatoire pour un arbre (liste ou « autre »).
    let especeNom: string | undefined;
    let especeIdVal: string | undefined;
    let especeLibreVal: string | undefined;
    let emetOmbreVal: boolean | undefined;
    if (!isCacao) {
      if (draft.especeKey === CLE_AUTRE) {
        if (!draft.especeAutre.trim()) {
          toast.error("Précisez le nom de l'espèce.");
          return;
        }
        especeLibreVal = draft.especeAutre.trim();
        especeNom = especeLibreVal;
        emetOmbreVal = false; // espèce hors-liste = non émettrice d'ombre
      } else if (draft.especeKey?.startsWith('id:')) {
        const id = draft.especeKey.slice(3);
        const e = especes.find((x) => x.id === id);
        especeIdVal = id;
        especeNom = e?.nom;
        emetOmbreVal = e?.emetOmbre;
      } else {
        toast.error("Sélectionnez l'espèce de l'arbre.");
        return;
      }
    }

    // Bornes de plausibilité : on refuse ici ce que le backend refuserait aussi.
    const erreurCirco = verifieBorne(
      draft.circoValue,
      limiteCirco,
      circoMode === 'CM' ? 'Circonférence' : 'DBH',
    );
    if (erreurCirco) {
      toast.error(erreurCirco);
      return;
    }
    const erreurHauteur = verifieBorne(draft.hauteur, LIMITES.hauteurM, 'Hauteur totale');
    if (erreurHauteur) {
      toast.error(erreurHauteur);
      return;
    }

    // L'état sanitaire ne concerne que les cacaoyers : un arbre d'ombrage part
    // toujours en VIVANT, sans maladie ni photo.
    const etatRetenu = isCacao ? draft.etatSanitaire : EtatSanitaire.VIVANT;

    // État MALADE : maladie (liste ou « Autres ») + photo obligatoires.
    let maladieIdVal: string | undefined;
    let maladieLibreVal: string | undefined;
    if (etatRetenu === EtatSanitaire.MALADE) {
      if (draft.maladieKey === CLE_AUTRE) {
        if (!draft.maladieAutre.trim()) {
          toast.error('Précisez le nom de la maladie.');
          return;
        }
        maladieLibreVal = draft.maladieAutre.trim();
      } else if (draft.maladieKey?.startsWith('id:')) {
        maladieIdVal = draft.maladieKey.slice(3);
      } else if (draft.maladieKey?.startsWith('nom:')) {
        // Option du repli hors-ligne : pas d'id local, transmise par son nom et
        // rapprochée par le backend.
        maladieLibreVal = draft.maladieKey.slice(4);
      } else {
        toast.error('Sélectionnez la maladie.');
        return;
      }
      if (!draft.photoMaladie) {
        toast.error('Une photo de diagnostic est obligatoire pour un cacaoyer malade.');
        return;
      }
    }

    setMesuresCollectees((prev) => [
      ...prev,
      {
        numeroSP: selectedSP,
        typeSujet: draft.typeSujet,
        espece: especeNom,
        especeId: especeIdVal,
        especeLibre: especeLibreVal,
        emetOmbre: emetOmbreVal,
        circonference30cm: circoMode === 'CM' ? parseNum(draft.circoValue) : undefined,
        circonferenceDBH: circoMode === 'DBH' ? parseNum(draft.circoValue) : undefined,
        hauteurTotale: parseNum(draft.hauteur),
        etatSanitaire: etatRetenu,
        maladieId: maladieIdVal,
        maladieLibre: maladieLibreVal,
        photoMaladie:
          etatRetenu === EtatSanitaire.MALADE ? draft.photoMaladie ?? undefined : undefined,
      },
    ]);
    // Vide le brouillon de CETTE sous-placette pour la mesure suivante, en
    // conservant le type de sujet et l'unité (mode lot : l'agent enchaîne les
    // cacaoyers, puis les arbres).
    patchDraft({
      ...DRAFT_VIDE,
      typeSujet: draft.typeSujet,
      circoMode: draft.circoMode,
    });
  };

  /** Affiche l'erreur en inline (sous le formulaire) et en toast. */
  const showError = (message: string) => {
    setErrorMsg(message);
    toast.error(message);
  };

  /**
   * Informations requises encore absentes.
   * Ne bloque JAMAIS la navigation : l'agent renseigne dans l'ordre qui lui
   * convient sur le terrain. Cette liste conditionne seulement la soumission, et
   * s'affiche telle quelle pour qu'il sache quoi aller chercher.
   */
  const champsManquants = (): string[] => {
    const manque: string[] = [];

    // Bloc A — identité et consentement.
    if (!nom.trim()) manque.push('Nom du producteur (Bloc A)');
    if (!prenoms.trim()) manque.push('Prénoms du producteur (Bloc A)');
    if (!rgpdConsent) manque.push('Consentement du producteur (Bloc A)');

    // Bloc B — sans superficie ni année, la parcelle n'est pas exploitable dans
    // les restitutions (densité, âge du verger).
    if (!superficie.trim()) manque.push('Superficie déclarée (Bloc B)');
    if (!anneeParcelle.trim()) manque.push("Année d'installation de la parcelle (Bloc B)");
    if (pratiquesRetenues.length === 0) {
      // « Aucune pratique » existe justement pour ce cas : ne rien cocher n'est
      // pas une réponse, c'est une question restée sans réponse.
      manque.push('Pratiques culturales — au moins une case (Bloc B)');
    }
    if (pratiquesRetenues.includes(PratiqueRetenue.AUCUNE) && !aucunePrecision.trim()) {
      manque.push('B4.1 — précision « Aucune pratique » (Bloc B)');
    }
    if (pratiquesRetenues.includes(PratiqueRetenue.AUTRES) && !autresPrecision.trim()) {
      manque.push('B4.2 — précision « Autres pratiques » (Bloc B)');
    }
    // Un volet coché doit être détaillé : le backend refuse l'incohérence.
    for (const volet of voletsCoches) {
      if (voletsDetail[volet].types.length === 0) {
        manque.push(`${PRATIQUE_RETENUE_LABELS[volet]} — type de pratique (Bloc B)`);
      }
    }

    // Bloc C — localisation et traçabilité de la collecte.
    if (!delegationId) manque.push('Délégation (Bloc C)');
    if (!villeId) manque.push('Ville (Bloc C)');
    if (!village.trim()) manque.push('Village / localité (Bloc C)');
    if (!chefEquipe.trim()) manque.push("Chef d'équipe (Bloc C)");
    const ordres = new Set(sommetsOnly.map((s) => s.ordreSommet));
    if (sommetsOnly.length !== 4 || ![1, 2, 3, 4].every((n) => ordres.has(n))) {
      manque.push(`Sommets GPS de la placette (${sommetsOnly.length}/4) — Bloc C`);
    }

    // Bloc D — une placette sans aucune mesure ne documente rien.
    if (mesuresCollectees.length === 0) {
      manque.push('Au moins une mesure dendrométrique (Bloc D)');
    }
    // SP1 porte le recensement des cacaoyers de la placette.
    if (!(nombrePlantsBySP[1] ?? '').trim()) {
      manque.push('SP1 — nombre de cacaoyers recensés (Bloc D)');
    }

    return manque;
  };

  /**
   * Erreurs de saisie : valeurs hors bornes de plausibilité.
   * Elles bloquent TOUT enregistrement, brouillon compris — le backend les
   * refuserait à la synchronisation, et un brouillon impossible à synchroniser
   * serait un piège silencieux.
   */
  const erreursDeSaisie = (): string | null => {
    const erreur =
      verifieBorne(anneeParcelle, LIMITES.anneeParcelle, "Année d'installation") ??
      verifieBorne(superficie, LIMITES.superficieHa, 'Superficie') ??
      verifieBorne(productionEstimee, LIMITES.productionKgAn, 'Production estimée');
    if (erreur) return erreur;

    for (const volet of voletsCoches) {
      const err = verifieBorne(
        voletsDetail[volet].nombreFoisParAn,
        LIMITES.frequenceAn,
        `${PRATIQUE_RETENUE_LABELS[volet]} — nombre de fois par an`,
      );
      if (err) {
        setVoletActif(volet);
        return err;
      }
    }

    for (const [libelle, table] of [
      ['Nombre de cacaoyers', nombrePlantsBySP],
      ["Nombre d'arbres", nombreArbresBySP],
    ] as const) {
      for (const [sp, valeur] of Object.entries(table)) {
        const err = verifieBorne(valeur, LIMITES.comptageSP, `${libelle} (SP${sp})`);
        if (err) {
          setSelectedSP(Number(sp));
          return err;
        }
      }
    }
    return null;
  };

  const manquants = champsManquants();

  // Navigation libre : aucune vérification ne retient l'agent. Les contrôles
  // vivent au moment d'enregistrer, pas au moment de changer d'écran.
  const handleNextStep = () => {
    setErrorMsg(null);
    if (currentStep < 5) setCurrentStep((prev) => (prev + 1) as never);
  };

  /**
   * Construit le détail B4 à envoyer : une entrée par volet coché.
   * Les précisions « Autres » ne partent que si la case qui les ouvre est bien
   * cochée — sinon le backend les refuse, à juste titre (donnée orpheline).
   */
  const buildPratiques = (): PratiqueCulturaleLocal[] | undefined => {
    if (!voletsCoches.length) return undefined;
    return voletsCoches.map((volet) => {
      const d = voletsDetail[volet];
      return {
        volet,
        types: d.types,
        typesAutre: d.types.includes('AUTRES') ? d.typesAutre.trim() || undefined : undefined,
        agents: d.agents,
        agentsAutre: d.agents.includes(AgentPratiquant.AUTRE)
          ? d.agentsAutre.trim() || undefined
          : undefined,
        frequence: d.frequence ?? undefined,
        frequenceAutre:
          d.frequence === FrequencePratique.AUTRE ? d.frequenceAutre.trim() || undefined : undefined,
        nombreFoisParAn: parseNum(d.nombreFoisParAn),
      };
    });
  };

  const buildSousPlacettes = (): SousPlacetteLocal[] => {
    // Sous-placettes = tout SP ayant des mesures OU un compteur renseigné.
    const spNums = new Set<number>();
    mesuresCollectees.forEach((m) => spNums.add(m.numeroSP));
    for (const k of Object.keys(nombrePlantsBySP)) {
      if (parseNum(nombrePlantsBySP[+k]) !== undefined) spNums.add(+k);
    }
    for (const k of Object.keys(nombreArbresBySP)) {
      if (parseNum(nombreArbresBySP[+k]) !== undefined) spNums.add(+k);
    }

    // Approximation : la sous-placette hérite des 3 premiers sommets de la
    // placette (échantillon interne) tant que la capture GPS dédiée par
    // sous-placette n'est pas implémentée.
    return Array.from(spNums).map((numero) => ({
      // ids laissés vides : ils sont attribués (création) ou retrouvés par
      // appariement sur le `numero` (modification) côté storage.
      id: '',
      placetteId: '',
      numero,
      nombrePlantsCacao: parseNum(nombrePlantsBySP[numero] ?? ''),
      nombreArbres: parseNum(nombreArbresBySP[numero] ?? ''),
      sommets: sommetsOnly.slice(0, 3),
      mesures: mesuresCollectees
        .filter((m) => m.numeroSP === numero)
        .map((m) => ({
          // Une mesure rechargée d'un brouillon garde son id : c'est la clé qui
          // la fera MODIFIER et non recréer. Une mesure neuve n'en a pas encore.
          id: m.id ?? '',
          sousPlacetteId: '',
          typeSujet: m.typeSujet,
          espece: m.espece,
          especeId: m.especeId,
          especeLibre: m.especeLibre,
          emetOmbre: m.emetOmbre,
          circonference30cm: m.circonference30cm,
          circonferenceDBH: m.circonferenceDBH,
          hauteurTotale: m.hauteurTotale,
          etatSanitaire: m.etatSanitaire,
          maladieId: m.maladieId,
          maladieLibre: m.maladieLibre,
          photoMaladie: m.photoMaladie,
          createdAt: new Date().toISOString(),
        })),
    }));
  };

  /**
   * Enregistre la collecte.
   * - BROUILLON : accepté même incomplet, l'agent reviendra le compléter.
   * - SOUMISE : exige toutes les informations requises ; la fiche devient alors
   *   non modifiable depuis le mobile (correction réservée à l'administration).
   * Dans les deux cas les erreurs de saisie bloquent : un enregistrement que le
   * backend refuserait à la synchro serait un piège silencieux.
   */
  const handleSave = async (statut: StatutCollecte) => {
    setErrorMsg(null);

    const erreur = erreursDeSaisie();
    if (erreur) {
      showError(erreur);
      return;
    }

    if (statut === StatutCollecte.SOUMISE && manquants.length > 0) {
      showError(
        `Soumission impossible : ${manquants.length} information(s) requise(s) manquante(s). ` +
          'Complétez-les, ou enregistrez en brouillon pour y revenir plus tard.',
      );
      return;
    }

    setSaving(true);
    try {
      const donnees = {
        producteur: {
          nom: nom.trim(),
          prenoms: prenoms.trim(),
          genre: genre ?? undefined,
          trancheAge: trancheAge ?? undefined,
          identiteProprietaire: identite.trim() || undefined,
          consentementDonne: rgpdConsent,
          consentementDate: new Date().toISOString(),
        },
        parcelle: {
          statutCollecte: statut,
          anneeParcelle: parseNum(anneeParcelle),
          superficie: parseNum(superficie),
          // Bloc B4 : cases de tête + détail des volets cochés.
          pratiquesRetenues: pratiquesRetenues.length ? pratiquesRetenues : undefined,
          aucunePratiquePrecision: pratiquesRetenues.includes(PratiqueRetenue.AUCUNE)
            ? aucunePrecision.trim() || undefined
            : undefined,
          autresPratiquesPrecision: pratiquesRetenues.includes(PratiqueRetenue.AUTRES)
            ? autresPrecision.trim() || undefined
            : undefined,
          pratiques: buildPratiques(),
          // Pas de champ « maladies observées » ici : l'état sanitaire est relevé
          // sujet par sujet au Bloc D (mesures), avec photo de diagnostic.
          productionEstimee: parseNum(productionEstimee),
          uniteProduction: UniteProduction.KG_PAR_AN,
        },
        placette: {
          // Aperçu local ; le serveur attribuera le numéro définitif à la synchro.
          numeroPlacette: numeroApercu ?? 'PLC-PROVISOIRE',
          delegationRegionale: selectedDelegation?.nom ?? '',
          delegationId: delegationId ?? undefined,
          villeId: villeId ?? undefined,
          ville: selectedVille?.nom,
          village: village.trim() || undefined,
          chefEquipe: chefEquipe.trim() || undefined,
          dateInventaire: collecteDate.toISOString(),
          sommets: points,
          sousPlacettes: buildSousPlacettes(),
        },
      };

      if (editParcelleId) {
        // Reprise : envoi en MODIFICATION. Le diff est fait par le storage, qui
        // apparie sous-placettes et mesures pour ne recréer que le nouveau.
        const maj = await offlineStorage.updateCompleteCollecte({
          parcelleId: editParcelleId,
          producteur: donnees.producteur,
          parcelle: donnees.parcelle,
          placette: donnees.placette,
        });
        if (!maj) {
          showError('Collecte introuvable : la modification n\'a pas pu être enregistrée.');
          return;
        }
      } else {
        const cree = await offlineStorage.saveCompleteCollecte(donnees);
        // L'identifiant de la parcelle voyage avec la notification : la toucher
        // ouvrira directement la fiche concernée.
        await notificationService.notifyCollecteEnregistree(
          `${donnees.producteur.prenoms} ${donnees.producteur.nom}`,
          cree.parcelle.id,
        );
      }

      toast.success(
        statut === StatutCollecte.BROUILLON
          ? 'Brouillon enregistré. Vous pourrez le compléter depuis « Enquêtes ».'
          : editParcelleId
            ? 'Collecte complétée et soumise.'
            : 'Collecte soumise. Données mises en file de synchronisation.',
      );
      onEditDone?.();
      onNavigate('enquetes');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const mesuresPourSP = mesuresCollectees.filter((m) => m.numeroSP === selectedSP);

  // Chaque changement d'étape ramène en haut : sans cela l'agent arrive au
  // milieu du bloc suivant, à la hauteur de défilement qu'il avait laissée.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  /**
   * Mode modification : recharge la collecte et repeuple TOUS les blocs.
   * Le parcours de saisie est le même qu'à la création — seul l'enregistrement
   * diffère (modification et non ajout).
   */
  useEffect(() => {
    if (!editParcelleId) return;
    let annule = false;

    (async () => {
      setChargementEdition(true);
      const collecte = await offlineStorage.getCollecte(editParcelleId);
      if (annule) return;

      if (!collecte) {
        toast.error('Collecte introuvable en local.');
        setChargementEdition(false);
        onEditDone?.();
        return;
      }

      const { producteur: prod, parcelle: parc, placette: plc } = collecte;

      // Bloc A
      setNom(prod.nom);
      setPrenoms(prod.prenoms);
      setGenre(prod.genre ?? null);
      setTrancheAge(prod.trancheAge ?? null);
      setIdentite(prod.identiteProprietaire ?? '');
      setRgpdConsent(prod.consentementDonne);

      // Bloc B — les nombres redeviennent des chaînes : le formulaire travaille
      // en texte, la conversion se fait à l'enregistrement.
      setAnneeParcelle(parc.anneeParcelle != null ? String(parc.anneeParcelle) : '');
      setSuperficie(parc.superficie != null ? String(parc.superficie) : '');
      setProductionEstimee(parc.productionEstimee != null ? String(parc.productionEstimee) : '');
      setPratiquesRetenues(parc.pratiquesRetenues ?? []);
      setAucunePrecision(parc.aucunePratiquePrecision ?? '');
      setAutresPrecision(parc.autresPratiquesPrecision ?? '');
      if (parc.pratiques?.length) {
        setVoletsDetail((prev) => {
          const suivant = { ...prev };
          for (const p of parc.pratiques!) {
            suivant[p.volet] = {
              types: p.types ?? [],
              typesAutre: p.typesAutre ?? '',
              agents: p.agents ?? [],
              agentsAutre: p.agentsAutre ?? '',
              frequence: p.frequence ?? null,
              frequenceAutre: p.frequenceAutre ?? '',
              nombreFoisParAn: p.nombreFoisParAn != null ? String(p.nombreFoisParAn) : '',
            };
          }
          return suivant;
        });
      }

      // Bloc C
      if (plc) {
        setDelegationId(plc.delegationId ?? null);
        setVilleId(plc.villeId ?? null);
        setVillage(plc.village ?? '');
        setChefEquipe(plc.chefEquipe ?? '');
        setPoints(plc.sommets ?? []);

        // Bloc D : compteurs par SP et mesures, en conservant l'identifiant local
        // de chaque mesure — c'est lui qui permettra de la modifier plutôt que
        // d'en créer une nouvelle.
        const plants: Record<number, string> = {};
        const arbres: Record<number, string> = {};
        const mesures: MesureCollectee[] = [];
        for (const sp of plc.sousPlacettes ?? []) {
          if (sp.nombrePlantsCacao != null) plants[sp.numero] = String(sp.nombrePlantsCacao);
          if (sp.nombreArbres != null) arbres[sp.numero] = String(sp.nombreArbres);
          for (const m of sp.mesures ?? []) {
            mesures.push({
              id: m.id,
              numeroSP: sp.numero,
              typeSujet: m.typeSujet,
              espece: m.espece,
              especeId: m.especeId,
              especeLibre: m.especeLibre,
              emetOmbre: m.emetOmbre,
              circonference30cm: m.circonference30cm,
              circonferenceDBH: m.circonferenceDBH,
              hauteurTotale: m.hauteurTotale,
              etatSanitaire: m.etatSanitaire,
              maladieId: m.maladieId,
              maladieLibre: m.maladieLibre,
              photoMaladie: m.photoMaladie,
            });
          }
        }
        setNombrePlantsBySP(plants);
        setNombreArbresBySP(arbres);
        setMesuresCollectees(mesures);
      }

      setChargementEdition(false);
    })();

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParcelleId]);

  return (
    <View style={styles.container}>
      <Header
        title={modeEdition ? 'Compléter la collecte' : 'Nouvelle collecte'}
        subtitle={
          chargementEdition
            ? 'Chargement de la fiche…'
            : modeEdition
              ? 'Reprise du brouillon — mêmes étapes, données déjà en place'
              : 'Producteur & parcelle'
        }
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={user?.avatarUri}
        onNewAction={() => {
          setCurrentStep(1);
          onNavigate('collecte');
        }}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <View style={[styles.stepsContainer, { paddingHorizontal }, contentStyle]}>
        {ETAPES.map((item) => {
          const isActive = currentStep === item.step;
          const isDone = currentStep > item.step;
          return (
            <TouchableOpacity
              key={item.step}
              style={[styles.stepItem, isActive && styles.stepActive, isDone && styles.stepDone]}
              onPress={() => setCurrentStep(item.step as never)}
            >
              <Text
                style={[
                  styles.stepText,
                  isActive && styles.stepTextActive,
                  isDone && !isActive && styles.stepTextDone,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* BLOC A */}
        {currentStep === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc A — Informations du Producteur</Text>
            <Text style={styles.blocSub}>Identité socio-économique et consentement</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du Producteur *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: KOUASSI"
                placeholderTextColor={colors.textMuted}
                value={nom}
                onChangeText={setNom}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prénoms *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: Jean-Baptiste"
                placeholderTextColor={colors.textMuted}
                value={prenoms}
                onChangeText={setPrenoms}
              />
            </View>

            {/* Genre (optionnel) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Genre <Text style={styles.optionalTag}>(optionnel)</Text></Text>
              <View style={styles.chipsWrap}>
                {[
                  { v: Genre.MASCULIN, label: 'Masculin' },
                  { v: Genre.FEMININ, label: 'Féminin' },
                ].map((opt) => {
                  const active = genre === opt.v;
                  return (
                    <TouchableOpacity
                      key={opt.v}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setGenre(active ? null : opt.v)}
                      activeOpacity={0.8}
                    >
                      {active && (
                        <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Tranche d'âge (optionnel) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Tranche d'âge <Text style={styles.optionalTag}>(optionnel)</Text>
              </Text>
              <View style={styles.chipsWrap}>
                {Object.values(TrancheAge).map((t) => {
                  const active = trancheAge === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setTrancheAge(active ? null : t)}
                      activeOpacity={0.8}
                    >
                      {active && (
                        <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {TRANCHE_AGE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>N° Pièce d'Identité / CNI</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: CI-00984123"
                placeholderTextColor={colors.textMuted}
                value={identite}
                onChangeText={setIdentite}
              />
            </View>

            <View style={styles.consentCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.consentTitle}>Consentement RGPD du producteur</Text>
                <Text style={styles.consentText}>
                  Le producteur autorise la géolocalisation de sa parcelle et la collecte de données pour le suivi et l'amélioration de sa production.
                </Text>
              </View>
              <Switch
                value={rgpdConsent}
                onValueChange={setRgpdConsent}
                trackColor={{ false: '#CCC', true: colors.emeraldPrimary }}
                thumbColor={rgpdConsent ? colors.mintSoft : '#FFF'}
              />
            </View>
          </View>
        )}

        {/* BLOC B */}
        {currentStep === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc B — Pratiques Culturales</Text>
            <Text style={styles.blocSub}>Superficie, entretiens et diagnostic sanitaire</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Année d'installation de la parcelle</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="number-pad"
                placeholder="ex: 2016"
                placeholderTextColor={colors.textMuted}
                value={anneeParcelle}
                // Une année = 4 chiffres, rien d'autre.
                onChangeText={(t) => setAnneeParcelle(sanitizeEntier(t, 4))}
              />
              <Text style={styles.helperText}>
                Entre {LIMITES.anneeParcelle.min} et {LIMITES.anneeParcelle.max}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Superficie Déclarée (ha)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                placeholder="ex: 3.5"
                placeholderTextColor={colors.textMuted}
                value={superficie}
                onChangeText={(t) => setSuperficie(sanitizeDecimal(t))}
              />
            </View>

            {/* ---------- Pratiques culturales (B4 du questionnaire) ----------
                Pas de titre de section ici : l'écran annonce déjà « Bloc B ».  */}
            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Pratiques culturales{' '}
                <Text style={styles.optionalTag}>(plusieurs réponses possibles)</Text>
              </Text>
              <View style={styles.chipsWrap}>
                {Object.values(PratiqueRetenue).map((p) => {
                  const active = pratiquesRetenues.includes(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => togglePratiqueRetenue(p)}
                      activeOpacity={0.8}
                    >
                      {active && (
                        <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {PRATIQUE_RETENUE_LABELS[p]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Les cinq cases n'ont pas le même effet : autant le dire, plutôt
                  que de laisser l'agent découvrir ce qui s'ouvre en tâtonnant. */}
              <Text style={styles.helperText}>
                Entretien, Tailles et Engrais ouvrent chacun un détail à renseigner.
                {' '}Aucune pratique et Autres demandent une précision écrite.
              </Text>
            </View>

            {/* B4.1 — précision demandée quand « Aucune pratique » est cochée */}
            {pratiquesRetenues.includes(PratiqueRetenue.AUCUNE) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>B4.1 — Pratiques non listées *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Précisez ce qui est fait sur la parcelle"
                  placeholderTextColor={colors.textMuted}
                  value={aucunePrecision}
                  onChangeText={setAucunePrecision}
                  multiline
                />
              </View>
            )}

            {/* B4.2 — précision demandée quand « Autres » est cochée */}
            {pratiquesRetenues.includes(PratiqueRetenue.AUTRES) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>B4.2 — Autres pratiques *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Précisez les pratiques non listées"
                  placeholderTextColor={colors.textMuted}
                  value={autresPrecision}
                  onChangeText={setAutresPrecision}
                  multiline
                />
              </View>
            )}

            {/* Détail par volet. Le questionnaire papier est un tableau
                3 colonnes × 4 rubriques ; sur un téléphone il devient un volet
                à la fois. Pour que l'agent ne perde jamais le fil de la colonne
                qu'il remplit : onglets d'accès + bandeau nommant le volet actif
                + état d'avancement de chaque volet. */}
            {voletCourant && detailCourant && (
              <View style={styles.voletBloc}>
                <View style={styles.voletEntete}>
                  <Text style={styles.voletEnteteTitre}>Détail des pratiques</Text>
                  <Text style={styles.voletEnteteCompteur}>
                    {voletsCoches.filter(voletComplet).length}/{voletsCoches.length} complété
                    {voletsCoches.filter(voletComplet).length > 1 ? 's' : ''}
                  </Text>
                </View>

                {voletsCoches.length > 1 && (
                  <View style={styles.voletTabs}>
                    {voletsCoches.map((v) => {
                      const active = v === voletCourant;
                      const complet = voletComplet(v);
                      const entame = voletEntame(v);
                      return (
                        <TouchableOpacity
                          key={v}
                          style={[styles.voletTab, active && styles.voletTabActive]}
                          onPress={() => setVoletActif(v)}
                          activeOpacity={0.8}
                        >
                          {/* Pastille d'état : plein = complet, creux = entamé,
                              rien = pas encore touché. */}
                          <Feather
                            name={complet ? 'check-circle' : entame ? 'circle' : 'minus-circle'}
                            size={13}
                            color={
                              active
                                ? '#FFFFFF'
                                : complet
                                  ? colors.emeraldPrimary
                                  : colors.textMuted
                            }
                          />
                          <Text style={[styles.voletTabText, active && styles.voletTabTextActive]}>
                            {PRATIQUE_RETENUE_LABELS[v]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Bandeau d'identité : la question « je remplis quoi ? » ne doit
                    jamais se poser, même après un défilement. */}
                <View style={styles.voletBandeau}>
                  <Feather name="clipboard" size={14} color={colors.emeraldPrimary} />
                  <Text style={styles.voletBandeauTexte}>
                    {PRATIQUE_RETENUE_LABELS[voletCourant].toUpperCase()}
                  </Text>
                  {voletsCoches.length > 1 && (
                    <Text style={styles.voletBandeauRang}>
                      volet {voletsCoches.indexOf(voletCourant) + 1} sur {voletsCoches.length}
                    </Text>
                  )}
                </View>

                {/* Types de pratiques — options propres au volet */}
                <Text style={styles.rubriqueLabel}>Types de pratiques</Text>
                <View style={styles.chipsWrap}>
                  {TYPES_PAR_VOLET[voletCourant].map((t) => {
                    const active = detailCourant.types.includes(t.code);
                    return (
                      <TouchableOpacity
                        key={t.code}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => patchVolet({ types: toggleDansListe(detailCourant.types, t.code) })}
                        activeOpacity={0.8}
                      >
                        {active && (
                          <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {detailCourant.types.includes('AUTRES') && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    placeholder="Autres types de pratiques (préciser)"
                    placeholderTextColor={colors.textMuted}
                    value={detailCourant.typesAutre}
                    onChangeText={(t) => patchVolet({ typesAutre: t })}
                  />
                )}

                {/* Agent(s) pratiquant(s) */}
                <Text style={styles.rubriqueLabel}>Agent(s) pratiquant(s)</Text>
                <View style={styles.chipsWrap}>
                  {Object.values(AgentPratiquant).map((a) => {
                    const active = detailCourant.agents.includes(a);
                    return (
                      <TouchableOpacity
                        key={a}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => patchVolet({ agents: toggleDansListe(detailCourant.agents, a) })}
                        activeOpacity={0.8}
                      >
                        {active && (
                          <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {AGENT_PRATIQUANT_LABELS[a]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {detailCourant.agents.includes(AgentPratiquant.AUTRE) && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    placeholder="Autre(s) agent(s) (préciser)"
                    placeholderTextColor={colors.textMuted}
                    value={detailCourant.agentsAutre}
                    onChangeText={(t) => patchVolet({ agentsAutre: t })}
                  />
                )}

                {/* Fréquence — choix unique */}
                <Text style={styles.rubriqueLabel}>Fréquence</Text>
                <View style={styles.chipsWrap}>
                  {Object.values(FrequencePratique).map((f) => {
                    const active = detailCourant.frequence === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          patchVolet({
                            frequence: active ? null : f,
                            // Une précision n'a plus de sens hors « Autres ».
                            frequenceAutre: f === FrequencePratique.AUTRE ? detailCourant.frequenceAutre : '',
                          })
                        }
                        activeOpacity={0.8}
                      >
                        {active && (
                          <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {FREQUENCE_PRATIQUE_LABELS[f]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {detailCourant.frequence === FrequencePratique.AUTRE && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    placeholder="Autre fréquence (préciser)"
                    placeholderTextColor={colors.textMuted}
                    value={detailCourant.frequenceAutre}
                    onChangeText={(t) => patchVolet({ frequenceAutre: t })}
                  />
                )}

                {/* Nombre de fois par an */}
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.rubriqueLabel}>Nombre de fois par an</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    placeholder="ex: 4"
                    placeholderTextColor={colors.textMuted}
                    value={detailCourant.nombreFoisParAn}
                    onChangeText={(t) => patchVolet({ nombreFoisParAn: sanitizeEntier(t, 2) })}
                  />
                  <Text style={styles.helperText}>Maximum {LIMITES.frequenceAn.max} par an</Text>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            {/* Pas de saisie de l'état sanitaire ici : il est relevé sujet par
                sujet au Bloc D (état de santé, maladie du référentiel et photo
                de diagnostic obligatoire). Le redemander à la parcelle
                produisait une donnée déclarative redondante, et deux réponses
                possiblement contradictoires pour un même constat. */}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Estimation de Production (kg/an)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="number-pad"
                placeholder="ex: 1400"
                placeholderTextColor={colors.textMuted}
                value={productionEstimee}
                onChangeText={(t) => setProductionEstimee(sanitizeEntier(t, 6))}
              />
              <Text style={styles.helperText}>
                Maximum {LIMITES.productionKgAn.max.toLocaleString('fr-FR')} kg par an
              </Text>
            </View>
          </View>
        )}

        {/* BLOC C */}
        {currentStep === 3 && (
          <View>
            <View style={styles.stepCard}>
              <Text style={styles.blocTitle}>Bloc C — Localisation de la placette</Text>
              <Text style={styles.blocSub}>
                Renseignez la zone pour générer le numéro, puis relevez les sommets GPS.
              </Text>

              {/* 1. Délégation (référentiel paramétrable, mis en cache) */}
              <View style={styles.inputGroup}>
                <View style={styles.fieldHead}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.inputLabel}>Délégation</Text>
                </View>
                {delegations.length === 0 ? (
                  <View style={styles.emptyRef}>
                    <Feather name="wifi-off" size={14} color={colors.textSecondary} />
                    <Text style={styles.emptyRefText}>
                      Référentiel indisponible — connectez-vous une première fois.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.chipsWrap}>
                    {delegations.map((d) => {
                      const active = d.id === delegationId;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => {
                            setDelegationId(d.id);
                            setVilleId(null);
                          }}
                          activeOpacity={0.8}
                        >
                          {active && (
                            <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                          )}
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {d.nom}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 2. Ville (filtrée par la délégation choisie) */}
              {selectedDelegation && (
                <View style={styles.inputGroup}>
                  <View style={styles.fieldHead}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <Text style={styles.inputLabel}>Ville</Text>
                  </View>
                  <View style={styles.chipsWrap}>
                    {selectedDelegation.villes.map((v) => {
                      const active = v.id === villeId;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setVilleId(v.id)}
                          activeOpacity={0.8}
                        >
                          {active && (
                            <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                          )}
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {v.nom}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 3. Village libre */}
              <View style={styles.inputGroup}>
                <View style={styles.fieldHead}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.inputLabel}>Village / Localité</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Grand-Zattry"
                  placeholderTextColor={colors.textMuted}
                  value={village}
                  onChangeText={setVillage}
                />
              </View>

              {/* Identification de la collecte : chef d'équipe + date auto */}
              <View style={styles.divider} />
              <Text style={styles.sectionMini}>Identification de la collecte</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Chef d'équipe</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nom complet du chef d'équipe"
                  placeholderTextColor={colors.textMuted}
                  value={chefEquipe}
                  onChangeText={setChefEquipe}
                />
              </View>

              <View style={styles.dateRow}>
                <View style={styles.dateIcon}>
                  <Feather name="calendar" size={15} color={colors.emeraldPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateLabel}>Date de collecte</Text>
                  <Text style={styles.dateValue}>{dateCollecteLabel}</Text>
                </View>
                <View style={styles.autoPill}>
                  <Text style={styles.autoPillText}>AUTO</Text>
                </View>
              </View>

              {/* Carte numéro de placette (aperçu) */}
              <LinearGradient
                colors={[colors.forestLight, colors.emeraldPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.numeroCard}
              >
                <View style={styles.numeroTop}>
                  <View style={styles.numeroIcon}>
                    <Feather name="hash" size={15} color="#FFFFFF" />
                  </View>
                  <Text style={styles.numeroCardLabel}>Numéro de placette</Text>
                  {numeroApercu && (
                    <View style={styles.apercuPill}>
                      <Text style={styles.apercuPillText}>APERÇU</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.numeroCardValue}>{numeroApercu ?? 'D-•••-•••-•••'}</Text>
                <Text style={styles.numeroCardHint}>
                  {numeroApercu
                    ? 'Numéro définitif attribué automatiquement à la synchronisation.'
                    : 'Choisissez la délégation et la ville pour obtenir le numéro.'}
                </Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* BLOC C — Étape 2 : relevé GPS des sommets (après obtention du numéro) */}
        {currentStep === 4 && (
          <View>
            <View style={styles.stepCard}>
              <Text style={styles.blocTitle}>Bloc C — Sommets GPS</Text>
              <Text style={styles.blocSub}>
                Placette {numeroApercu ?? ''} — relevez les 4 sommets qui délimitent la parcelle.
              </Text>
            </View>
            <PlacettePointsCapture
              points={points}
              onCapture={handleCapturePoint}
              onManualEdit={handleEditPoint}
              canEdit={canEditPoints}
              capturing={capturing}
              areaInHectares={LocationService.calculateAreaInHectares(sommetsOnly)}
            />
            <Text style={styles.helperText}>
              {sommetsOnly.length}/4 sommets (S) requis{' '}
              {sommetsOnly.length === 4
                ? '✓ Parcelle délimitée'
                : '— capturez S1 à S4 pour continuer'}
            </Text>
          </View>
        )}

        {/* BLOC D */}
        {currentStep === 5 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc D — Mesures Dendrométriques</Text>
            <Text style={styles.blocSub}>Comptage et circonférence par sous-placette</Text>

            <Text style={styles.inputLabel}>Sous-placette Échantillon</Text>
            <View style={styles.spSelector}>
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const count = mesuresCollectees.filter((m) => m.numeroSP === num).length;
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.spButton, selectedSP === num && styles.spButtonActive]}
                    onPress={() => setSelectedSP(num)}
                  >
                    <Text style={[styles.spText, selectedSP === num && styles.spTextActive]}>
                      SP{num}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, isCacao && styles.typeBtnActive]}
                // Le changement de type vide ce qui ne s'applique plus : la
                // grosseur (cm ↔ DBH en m, unités différentes) et l'espèce, qui
                // ne concerne que les arbres.
                onPress={() =>
                  patchDraft({
                    typeSujet: TypeSujet.CACAO,
                    circoValue: '',
                    especeKey: null,
                    especeAutre: '',
                  })
                }
              >
                <Feather name="box" size={14} color={isCacao ? '#FFF' : colors.textPrimary} />
                <Text style={[styles.typeBtnText, isCacao && styles.typeBtnTextActive]}>
                  Cacaoyer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, !isCacao && styles.typeBtnActive]}
                // Vers un arbre : l'état sanitaire ne s'applique plus, on remet
                // VIVANT et on efface maladie et photo pour ne rien transmettre
                // d'un diagnostic saisi sur un cacaoyer.
                onPress={() =>
                  patchDraft({
                    typeSujet: TypeSujet.ARBRE_OMBRAGE,
                    circoValue: '',
                    etatSanitaire: EtatSanitaire.VIVANT,
                    maladieKey: null,
                    maladieAutre: '',
                    photoMaladie: null,
                  })
                }
              >
                <Feather name="sun" size={14} color={!isCacao ? '#FFF' : colors.textPrimary} />
                <Text style={[styles.typeBtnText, !isCacao && styles.typeBtnTextActive]}>
                  Arbre d'ombrage
                </Text>
              </TouchableOpacity>
            </View>

            {/* Espèce — arbres d'ombrage uniquement. Liste déroulante, « Autres »
                en dernière position, et champ de saisie révélé seulement si
                l'agent choisit cette option. */}
            {!isCacao && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Espèce de l'arbre *</Text>
                <SelectField
                  title="Espèce de l'arbre"
                  placeholder="Choisir dans la liste…"
                  value={draft.especeKey}
                  options={especeOptions}
                  onChange={(key) => patchDraft({ especeKey: key, especeAutre: '' })}
                />
                {draft.especeKey === CLE_AUTRE && (
                  <>
                    <Text style={styles.optionalTag}>
                      Espèce hors liste — enregistrée comme non émettrice d'ombre, puis
                      proposée à tous après validation par l'administration.
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nom de l'espèce"
                      placeholderTextColor={colors.textMuted}
                      value={draft.especeAutre}
                      onChangeText={(t) => patchDraft({ especeAutre: t })}
                    />
                  </>
                )}
              </View>
            )}

            {/* Grosseur du sujet : cacaoyer = cm OU DBH (m) ; arbre = DBH (m) seul */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{isCacao ? 'Circonférence' : 'DBH (m)'}</Text>
              {isCacao ? (
                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, circoMode === 'CM' && styles.segmentBtnActive]}
                    onPress={() => patchDraft({ circoMode: 'CM', circoValue: '' })}
                  >
                    <Text
                      style={[styles.segmentText, circoMode === 'CM' && styles.segmentTextActive]}
                    >
                      cm
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, circoMode === 'DBH' && styles.segmentBtnActive]}
                    onPress={() => patchDraft({ circoMode: 'DBH', circoValue: '' })}
                  >
                    <Text
                      style={[styles.segmentText, circoMode === 'DBH' && styles.segmentTextActive]}
                    >
                      DBH (m)
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.helperText}>
                  Mesure unique pour un arbre d'ombrage : DBH à 1,30 m, en mètres.
                </Text>
              )}
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                placeholder={circoMode === 'CM' ? 'Circonférence en cm' : 'DBH en mètres'}
                placeholderTextColor={colors.textMuted}
                value={draft.circoValue}
                onChangeText={(t) => patchDraft({ circoValue: sanitizeDecimal(t) })}
              />
              <Text style={styles.helperText}>
                Entre {limiteCirco.min} et {limiteCirco.max} {limiteCirco.unite}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hauteur totale (m)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                placeholder="ex: 4.5"
                placeholderTextColor={colors.textMuted}
                value={draft.hauteur}
                onChangeText={(t) => patchDraft({ hauteur: sanitizeDecimal(t) })}
              />
            </View>

            {/* État de santé — CACAOYERS uniquement. Le diagnostic sanitaire
                porte sur la production de cacao ; un arbre d'ombrage est relevé
                pour son espèce et sa grosseur, pas pour son état. */}
            {isCacao && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>État de santé</Text>
                <View style={styles.chipsWrap}>
                  {Object.values(EtatSanitaire).map((et) => {
                    const active = draft.etatSanitaire === et;
                    return (
                      <TouchableOpacity
                        key={et}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => patchDraft({ etatSanitaire: et })}
                        activeOpacity={0.8}
                      >
                        {active && (
                          <Feather name="check" size={13} color="#FFFFFF" style={styles.chipCheck} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {ETAT_SANITAIRE_LABELS[et]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* MALADE : maladie (liste déroulante) + photo obligatoire */}
            {isCacao && draft.etatSanitaire === EtatSanitaire.MALADE && (
              <View style={styles.maladieBox}>
                <Text style={styles.inputLabel}>Maladie *</Text>
                {/* Liste déroulante, « Autres » en dernière position : le champ
                    de saisie n'apparaît que si l'agent retient cette option. */}
                <SelectField
                  title="Maladie observée"
                  placeholder="Choisir dans la liste…"
                  value={draft.maladieKey}
                  options={maladieOptions}
                  onChange={(key) => patchDraft({ maladieKey: key, maladieAutre: '' })}
                />
                {draft.maladieKey === CLE_AUTRE && (
                  <>
                    <Text style={styles.optionalTag}>
                      Maladie hors liste — proposée à tous les agents après validation par
                      l'administration.
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nom de la maladie"
                      placeholderTextColor={colors.textMuted}
                      value={draft.maladieAutre}
                      onChangeText={(t) => patchDraft({ maladieAutre: t })}
                    />
                  </>
                )}

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Photo de diagnostic *</Text>
                {draft.photoMaladie ? (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: draft.photoMaladie }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoRetake} onPress={handleCapturePhotoMaladie}>
                      <Feather name="refresh-cw" size={14} color={colors.emeraldPrimary} />
                      <Text style={styles.photoRetakeText}>Reprendre</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoBtn} onPress={handleCapturePhotoMaladie}>
                    <Feather name="camera" size={16} color={colors.emeraldPrimary} />
                    <Text style={styles.photoBtnText}>Ajouter la photo (obligatoire)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.addMesureBtn} onPress={handleAddMesure}>
              <Feather name="plus-circle" size={16} color={colors.emeraldPrimary} />
              <Text style={styles.addMesureText}>
                Ajouter {isCacao ? 'ce cacaoyer' : 'cet arbre'} à SP{selectedSP}
              </Text>
            </TouchableOpacity>
            {isCacao && selectedSP !== 1 && (
              <Text style={styles.helperText}>{cacaoCountForSP}/3 cacaoyers (maximum SP2–SP6)</Text>
            )}

            {/* Comptage de la sous-placette : uniquement celui du type de sujet
                sélectionné, pour ne pas demander à l'agent un chiffre qui ne
                concerne pas ce qu'il est en train de relever. Les deux valeurs
                restent mémorisées par SP et partent ensemble à l'enregistrement. */}
            <View style={[styles.inputGroup, { marginTop: 16 }]}>
              <Text style={styles.inputLabel}>
                {isCacao ? 'Nombre de cacaoyers (SP' : "Nombre d'arbres (SP"}
                {selectedSP})
              </Text>
              <TextInput
                style={styles.textInput}
                keyboardType="number-pad"
                placeholder={isCacao ? 'ex: 120' : 'ex: 8'}
                placeholderTextColor={colors.textMuted}
                value={(isCacao ? nombrePlantsBySP : nombreArbresBySP)[selectedSP] ?? ''}
                onChangeText={(t) => {
                  // Comptage = entier positif : la frappe est filtrée à la source.
                  const v = sanitizeEntier(t, 4);
                  if (isCacao) setNombrePlantsBySP((p) => ({ ...p, [selectedSP]: v }));
                  else setNombreArbresBySP((p) => ({ ...p, [selectedSP]: v }));
                }}
              />
            </View>

            {/* Mesures déjà saisies pour la sous-placette sélectionnée */}
            {mesuresPourSP.length > 0 && (
              <View style={styles.mesuresList}>
                <Text style={styles.mesuresListTitle}>
                  {mesuresPourSP.length} mesure(s) — SP{selectedSP}
                </Text>
                {mesuresPourSP.map((m, i) => (
                  <View key={i} style={styles.mesureChip}>
                    <Feather
                      name={m.typeSujet === TypeSujet.CACAO ? 'box' : 'sun'}
                      size={12}
                      color={colors.emeraldPrimary}
                    />
                    <Text style={styles.mesureChipText}>
                      {m.typeSujet === TypeSujet.CACAO ? 'Cacaoyer' : m.espece || 'Arbre'}
                      {m.circonference30cm ? ` • ${m.circonference30cm} cm` : ''}
                      {m.circonferenceDBH ? ` • DBH ${m.circonferenceDBH} m` : ''}
                      {m.hauteurTotale ? ` • ${m.hauteurTotale} m` : ''}
                      {` • ${ETAT_SANITAIRE_LABELS[m.etatSanitaire]}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Message d'erreur de validation (visible web + natif) */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Récapitulatif de ce qui manque, à la dernière étape. Informe sans
            interdire : la navigation reste libre, seule la soumission attend
            que la liste soit vide. */}
        {currentStep === 5 && manquants.length > 0 && (
          <View style={styles.manquantsBox}>
            <View style={styles.manquantsHead}>
              <Feather name="alert-triangle" size={15} color={colors.warning} />
              <Text style={styles.manquantsTitre}>
                {manquants.length} information{manquants.length > 1 ? 's' : ''} requise
                {manquants.length > 1 ? 's' : ''} manquante{manquants.length > 1 ? 's' : ''}
              </Text>
            </View>
            {manquants.map((m) => (
              <Text key={m} style={styles.manquantsLigne}>
                • {m}
              </Text>
            ))}
            <Text style={styles.manquantsAide}>
              Vous pouvez enregistrer en brouillon et compléter plus tard.
            </Text>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.bottomBarNav}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => setCurrentStep((prev) => (prev - 1) as never)}
            >
              <Feather name="arrow-left" size={18} color={colors.textPrimary} />
              <Text style={styles.prevBtnText}>Précédent</Text>
            </TouchableOpacity>
          )}

          {currentStep < 5 && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
              <Text style={styles.nextBtnText}>Étape Suivante</Text>
              <Feather name="arrow-right" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Deux actions explicites à la fin de la saisie : l'agent décide, rien
            n'est choisi à sa place. */}
        {currentStep === 5 && (
          <View style={styles.actionsFin}>
            <TouchableOpacity
              style={[styles.draftBtn, saving && styles.saveBtnDisabled]}
              onPress={() => handleSave(StatutCollecte.BROUILLON)}
              disabled={saving}
            >
              <Feather name="save" size={17} color={colors.textPrimary} />
              <Text style={styles.draftBtnText}>
                {saving ? 'Enregistrement…' : 'Enregistrer en brouillon'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || manquants.length > 0) && styles.saveBtnDisabled,
              ]}
              onPress={() => handleSave(StatutCollecte.SOUMISE)}
              disabled={saving}
            >
              <Feather name="check" size={18} color={colors.textLight} />
              <Text style={styles.saveBtnText}>
                {saving
                  ? 'Enregistrement…'
                  : modeEdition
                    ? 'Compléter et soumettre'
                    : 'Soumettre la collecte'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionsFinAide}>
              Une collecte soumise n'est plus modifiable depuis le mobile.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};
