import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  DERNIERE_ETAPE,
  DISTANCE_MIN_POINTS_M,
  DRAFT_VIDE,
  ETAPES,
  libellePoint,
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
  SEUIL_PHOTO_CIRCONFERENCE_CM,
  verifieBorne,
} from '../utils/champs';
import { confirmer } from '../components/common/Confirmation';
import { avatarAffichable, type UserProfile } from '../services/auth';
import type {
  PointGPS,
  TabType,
  SousPlacetteLocal,
  Delegation,
  PlacetteLocal,
  Espece,
  Maladie,
  TypeCadastre,
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
  /**
   * Signale qu'une saisie est commencée. L'écran parent s'en sert pour demander
   * confirmation avant de changer d'onglet — sans quoi un appui distrait sur la
   * barre du bas ferait quitter la fiche sans un mot.
   */
  onSaisieEnCoursChange?: (enCours: boolean) => void;
}

export const CollecteWizardScreen: React.FC<CollecteWizardScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
  editParcelleId,
  onEditDone,
  onSaisieEnCoursChange,
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
  /** Barre d'étapes : on la fait suivre l'étape active (voir plus bas). */
  const stepsScrollRef = useRef<ScrollView>(null);

  /**
   * Identifiant de la fiche créée par la sauvegarde automatique.
   *
   * `saveCompleteCollecte` CRÉE une parcelle à chaque appel : sans mémoriser
   * cet identifiant, chaque passage de la sauvegarde automatique fabriquerait
   * un brouillon de plus. Une fois posé, on ne fait plus que des mises à jour.
   */
  const [idBrouillonAuto, setIdBrouillonAuto] = useState<string | null>(null);

  // --- Bloc A ---
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [genre, setGenre] = useState<Genre | null>(null);
  const [trancheAge, setTrancheAge] = useState<TrancheAge | null>(null);
  /**
   * Numéro de pièce d'identité : plus jamais saisi, mais toujours transporté.
   * À la reprise d'une fiche antérieure la valeur est relue et renvoyée telle
   * quelle ; la retirer d'ici l'écraserait en base au premier enregistrement.
   */
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

  /**
   * Années proposées pour l'installation de la parcelle, de la plus récente à
   * la plus ancienne : une plantation de l'an dernier se choisit en un geste,
   * une de 1970 demande de dérouler — et c'est le bon ordre de fréquence.
   */
  const anneesDisponibles: SelectOption[] = useMemo(() => {
    const annees: SelectOption[] = [];
    const debut = LIMITES.anneeParcelle.max ?? new Date().getFullYear();
    for (let a = debut; a >= LIMITES.anneeParcelle.min; a -= 1) {
      annees.push({ key: String(a), label: String(a) });
    }
    return annees;
  }, []);

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
   * Coche/décoche une case de tête des pratiques culturales.
   *
   * « Aucune pratique » est exclusive de TOUTES les autres, « Autres » compris :
   * déclarer qu'il ne se fait rien sur la parcelle et décrire dans la foulée ce
   * qui s'y fait sont deux affirmations contradictoires, et rien ne permettrait
   * ensuite de savoir laquelle croire.
   *
   * Comme la cocher efface les volets déjà renseignés, elle passe par une
   * confirmation : c'est le seul geste de cet écran qui détruit une saisie.
   */
  const appliquerAucunePratique = () =>
    setPratiquesRetenues([PratiqueRetenue.AUCUNE]);

  const togglePratiqueRetenue = async (p: PratiqueRetenue) => {
    const dejaCochee = pratiquesRetenues.includes(p);

    if (p === PratiqueRetenue.AUCUNE && !dejaCochee) {
      const aPerdre = pratiquesRetenues.filter((x) => x !== PratiqueRetenue.AUCUNE);
      if (aPerdre.length === 0) {
        appliquerAucunePratique();
        return;
      }
      const ok = await confirmer({
        titre: 'Aucune pratique culturale ?',
        message:
          'Vous déclarez qu’aucune pratique n’est menée sur cette parcelle. Les autres cases seront décochées et leur détail effacé.',
        destructif: true,
      });
      if (ok) appliquerAucunePratique();
      return;
    }

    setPratiquesRetenues((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      // Toute autre case cochée lève « Aucune pratique », sans quoi la fiche
      // porterait les deux affirmations à la fois.
      return [...prev.filter((x) => x !== PratiqueRetenue.AUCUNE), p];
    });
  };

  const toggleDansListe = <T,>(liste: T[], valeur: T): T[] =>
    liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];

  // --- Bloc C : référentiel géographique (délégation → ville) ---
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [placettesLocales, setPlacettesLocales] = useState<PlacetteLocal[]>([]);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [villeId, setVilleId] = useState<string | null>(null);
  const [village, setVillage] = useState('');
  /** Type de zone cadastrale, choisi dans le référentiel administré. */
  const [zoneCadastrale, setZoneCadastrale] = useState('');
  const [typesCadastre, setTypesCadastre] = useState<TypeCadastre[]>([]);
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
      setTypesCadastre(await referentielsService.getTypesCadastreCached());
      setDelegations(await delegationsService.refresh());
      setManualEditEnabled((await settingsService.refresh()).agentManualPointEdit);
      const ref = await referentielsService.refresh();
      setEspeces(ref.especes);
      setMaladiesList(ref.maladies);
      // `refresh` ne rend pas les types de cadastre : on relit le cache qu'il
      // vient de mettre à jour, plutôt que d'élargir sa signature.
      setTypesCadastre(await referentielsService.getTypesCadastreCached());
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
  // Les comptages par sous-placette ne sont plus des états : ils se déduisent
  // des mesures (voir `compteursSP`).
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

  /** Fenêtre de relecture et de correction des mesures de la SP courante. */
  const [modaleMesuresOuverte, setModaleMesuresOuverte] = useState(false);

  // --- Bloc E : arbres n'émettant pas d'ombre ---
  const [especeNonEmettrice, setEspeceNonEmettrice] = useState<string | null>(null);
  const [especeNonEmettriceAutre, setEspeceNonEmettriceAutre] = useState('');

  /** La plus grande des deux circonférences saisies — commande la photo. */
  const circonferenceMaxSaisie = Math.max(
    parseNombre(draft.circo30) ?? 0,
    parseNombre(draft.circo130) ?? 0,
  );

  const cacaoCountForSP = mesuresCollectees.filter(
    (m) => m.numeroSP === selectedSP && m.typeSujet === TypeSujet.CACAO,
  ).length;

  /**
   * Comptages DÉDUITS des mesures relevées, et non plus tapés à la main.
   *
   * Deux chiffres saisis séparément finissaient toujours par se contredire :
   * l'agent annonçait 120 cacaoyers puis en relevait 118, et rien ne disait
   * lequel faisait foi. Le compte suit maintenant ce qui a été effectivement
   * enregistré. Les cacaoyers ne comptent que VIVANTS — un sujet mort n'entre
   * pas dans l'effectif du verger, il est relevé pour la statistique sanitaire.
   */
  const compteursSP = useMemo(() => {
    const parSP: Record<number, { cacaoVivants: number; arbres: number }> = {};
    for (const m of mesuresCollectees) {
      const c = parSP[m.numeroSP] ?? { cacaoVivants: 0, arbres: 0 };
      if (m.typeSujet === TypeSujet.CACAO) {
        if (m.etatSanitaire === EtatSanitaire.VIVANT) c.cacaoVivants += 1;
      } else if (m.emetOmbre !== false) {
        // Les arbres qui n'émettent pas d'ombre sont recensés à part (bloc
        // suivant) : les compter ici gonflerait le couvert d'ombrage de la
        // sous-placette avec des sujets qui n'en produisent pas.
        c.arbres += 1;
      }
      parSP[m.numeroSP] = c;
    }
    return parSP;
  }, [mesuresCollectees]);

  /**
   * Arbres n'émettant pas d'ombre, recensés pour la placette entière.
   *
   * Ils sont rattachés à SP1 par convention : le modèle exige une
   * sous-placette, et le recensement de la placette y est déjà porté. Ce qui
   * les distingue n'est pas leur rattachement mais `emetOmbre: false`.
   */
  const arbresNonEmetteurs = useMemo(
    () => mesuresCollectees.filter((m) => m.typeSujet !== TypeSujet.CACAO && m.emetOmbre === false),
    [mesuresCollectees],
  );

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

      // Deux points de la placette ne peuvent pas se confondre. En dessous de
      // cinq mètres, on est dans le bruit d'un GPS de téléphone : le relevé
      // décrirait moins la parcelle que l'imprécision de l'appareil. Le cas
      // vient presque toujours d'un agent qui capture deux fois sans se
      // déplacer — mieux vaut le lui dire tout de suite que de découvrir un
      // polygone aberrant à la restitution.
      const trop = points.find((p) => {
        if (p.typePoint === type && p.ordreSommet === ordre) return false; // Re-capture du même point.
        return LocationService.distanceMetres(p, point) < DISTANCE_MIN_POINTS_M;
      });

      if (trop) {
        const distance = Math.round(LocationService.distanceMetres(trop, point));
        toast.error(
          `Trop près du point ${libellePoint(trop.typePoint, trop.ordreSommet)} (${distance} m). ` +
            `Écartez-vous d'au moins ${DISTANCE_MIN_POINTS_M} m avant de relever.`,
        );
        return;
      }

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

  /**
   * Photo justifiant une circonférence hors norme. Même chemin que la photo de
   * diagnostic : caméra d'abord, galerie en repli si elle est refusée.
   */
  const handlePhotoCirconference = async () => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.granted) {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!r.canceled && r.assets?.[0]) {
          patchDraft({ photoCirconference: r.assets[0].uri });
          return;
        }
      }
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        toast.error('Autorisation caméra ou galerie requise pour la photo justificative.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (!r.canceled && r.assets?.[0]) patchDraft({ photoCirconference: r.assets[0].uri });
    } catch {
      toast.error('Impossible de prendre la photo.');
    }
  };

  /** Retire une mesure déjà enregistrée (depuis la fenêtre de correction). */
  const supprimerMesure = async (index: number) => {
    const ok = await confirmer({
      titre: 'Supprimer cette mesure ?',
      message: 'Le sujet relevé sera retiré de la sous-placette.',
      libelleConfirmer: 'Supprimer',
      destructif: true,
    });
    if (ok) setMesuresCollectees((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Ajoute un arbre n'émettant pas d'ombre au recensement de la placette.
   *
   * Volontairement plus léger que le Bloc D : ni circonférence, ni hauteur, ni
   * état sanitaire. Ce bloc répond à une question de dénombrement — combien
   * d'arbres de ce type, et lesquels — et non à un relevé dendrométrique.
   * Demander les mêmes champs qu'au Bloc D en découragerait la saisie.
   */
  const ajouterArbreNonEmetteur = () => {
    let especeNom: string | undefined;
    let especeIdVal: string | undefined;
    let especeLibreVal: string | undefined;

    if (especeNonEmettrice === CLE_AUTRE) {
      if (!especeNonEmettriceAutre.trim()) {
        toast.error("Précisez le nom de l'espèce.");
        return;
      }
      especeLibreVal = especeNonEmettriceAutre.trim();
      especeNom = especeLibreVal;
    } else if (especeNonEmettrice?.startsWith('id:')) {
      const id = especeNonEmettrice.slice(3);
      especeIdVal = id;
      especeNom = especes.find((e) => e.id === id)?.nom;
    } else {
      toast.error("Sélectionnez l'espèce de l'arbre.");
      return;
    }

    setMesuresCollectees((prev) => [
      ...prev,
      {
        // SP1 par convention : la placette entière est recensée là.
        numeroSP: 1,
        typeSujet: TypeSujet.ARBRE_OMBRAGE,
        espece: especeNom,
        especeId: especeIdVal,
        especeLibre: especeLibreVal,
        // C'est CE drapeau qui range l'arbre au bloc E plutôt qu'au bloc D.
        emetOmbre: false,
        etatSanitaire: EtatSanitaire.VIVANT,
      },
    ]);

    // On garde l'espèce sélectionnée : l'agent en recense souvent plusieurs de
    // la même essence à la suite, un appui suffit alors pour la suivante.
    setEspeceNonEmettriceAutre('');
  };

  /**
   * Retire UN arbre de l'espèce donnée (le dernier ajouté).
   *
   * Le récapitulatif étant groupé, on ne peut pas désigner une ligne précise :
   * on décrémente. Sans confirmation, à la différence d'une mesure du Bloc D —
   * ici rien n'est perdu qu'un appui ne rétablisse.
   */
  const retirerUnArbreNonEmetteur = (nomEspece: string) => {
    setMesuresCollectees((prev) => {
      const correspond = (m: MesureCollectee) =>
        m.typeSujet !== TypeSujet.CACAO &&
        m.emetOmbre === false &&
        (m.espece ?? 'Espèce non précisée') === nomEspece;

      const dernier = prev.map(correspond).lastIndexOf(true);
      if (dernier < 0) return prev;
      return prev.filter((_, i) => i !== dernier);
    });
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
        // « Autres » se saisit dans l'onglet « Arbre d'ombrage » : l'agent y
        // décrit une essence d'ombrage absente de la liste. La classer non
        // émettrice l'aurait fait disparaître des couverts recensés — et les
        // arbres qui n'émettent pas d'ombre ont leur propre comptage.
        emetOmbreVal = true;
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
    const erreurCirco =
      verifieBorne(draft.circo30, LIMITES.circonference30cmCm, 'Circonférence à 30 cm') ??
      verifieBorne(draft.circo130, LIMITES.circonference130cm, 'Circonférence à 1,30 m');
    if (erreurCirco) {
      toast.error(erreurCirco);
      return;
    }

    // Circonférence hors du commun : on ACCEPTE la valeur, on demande la preuve.
    // Un plafond aurait rendu le sujet remarquable impossible à enregistrer ;
    // ne rien demander aurait laissé passer une virgule oubliée.
    const plusGrande = Math.max(parseNum(draft.circo30) ?? 0, parseNum(draft.circo130) ?? 0);
    if (plusGrande > SEUIL_PHOTO_CIRCONFERENCE_CM && !draft.photoCirconference) {
      toast.error(
        `Circonférence de ${plusGrande} cm : au-delà de ${SEUIL_PHOTO_CIRCONFERENCE_CM} cm, ` +
          'une photo du sujet est demandée pour justifier la mesure.',
      );
      return;
    }

    const erreurHauteur =
      verifieBorne(draft.hauteurFut, LIMITES.hauteurM, 'Hauteur du fût') ??
      verifieBorne(draft.hauteur, LIMITES.hauteurM, 'Hauteur totale');
    if (erreurHauteur) {
      toast.error(erreurHauteur);
      return;
    }

    // Le fût ne peut pas dépasser la hauteur totale : c'en est une partie.
    const fut = parseNum(draft.hauteurFut);
    const totale = parseNum(draft.hauteur);
    if (fut !== undefined && totale !== undefined && fut > totale) {
      toast.error('La hauteur du fût ne peut pas dépasser la hauteur totale.');
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
        // Les deux circonférences partent ensemble, toutes deux en centimètres.
        circonference30cm: parseNum(draft.circo30),
        circonferenceDBH: parseNum(draft.circo130),
        hauteurFut: parseNum(draft.hauteurFut),
        hauteurTotale: parseNum(draft.hauteur),
        etatSanitaire: etatRetenu,
        maladieId: maladieIdVal,
        maladieLibre: maladieLibreVal,
        photoMaladie:
          etatRetenu === EtatSanitaire.MALADE ? draft.photoMaladie ?? undefined : undefined,
        photoCirconference: draft.photoCirconference ?? undefined,
      },
    ]);
    // Vide le brouillon de CETTE sous-placette pour la mesure suivante, en
    // conservant le type de sujet et l'unité (mode lot : l'agent enchaîne les
    // cacaoyers, puis les arbres).
    patchDraft({ ...DRAFT_VIDE, typeSujet: draft.typeSujet });
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
    // SP1 porte le recensement des cacaoyers de la placette. Le compte étant
    // déduit des mesures, on vérifie qu'il y a bien des cacaoyers relevés —
    // et non plus qu'un nombre a été tapé.
    if ((compteursSP[1]?.cacaoVivants ?? 0) === 0) {
      manque.push('SP1 — aucun cacaoyer vivant relevé (Bloc D)');
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
      verifieBorne(productionEstimee, LIMITES.productionSacsAn, 'Production estimée');
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

    // Les comptages ne sont plus saisis : ils comptent des mesures réellement
    // enregistrées et ne peuvent donc plus sortir de leurs bornes.
    return null;
  };

  const manquants = champsManquants();

  // Navigation libre : aucune vérification ne retient l'agent. Les contrôles
  // vivent au moment d'enregistrer, pas au moment de changer d'écran.
  const handleNextStep = () => {
    setErrorMsg(null);
    if (currentStep < DERNIERE_ETAPE) setCurrentStep((prev) => (prev + 1) as never);
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
    // Une sous-placette existe dès qu'elle porte au moins une mesure. Les
    // compteurs n'étant plus saisis à part, il n'y a plus de SP « vide mais
    // renseignée » : le relevé fait foi.
    const spNums = new Set<number>();
    mesuresCollectees.forEach((m) => spNums.add(m.numeroSP));

    // Approximation : la sous-placette hérite des 3 premiers sommets de la
    // placette (échantillon interne) tant que la capture GPS dédiée par
    // sous-placette n'est pas implémentée.
    return Array.from(spNums).map((numero) => ({
      // ids laissés vides : ils sont attribués (création) ou retrouvés par
      // appariement sur le `numero` (modification) côté storage.
      id: '',
      placetteId: '',
      numero,
      // Comptes déduits des mesures : ils ne peuvent plus contredire le relevé.
      nombrePlantsCacao: compteursSP[numero]?.cacaoVivants ?? 0,
      nombreArbres: compteursSP[numero]?.arbres ?? 0,
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
          hauteurFut: m.hauteurFut,
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
  /**
   * Assemble la fiche telle qu'elle sera écrite en base.
   *
   * Extraite de `handleSave` : la persistance automatique en a besoin elle
   * aussi, et dupliquer cet assemblage aurait garanti qu'une des deux copies
   * finisse par oublier un champ ajouté à l'autre.
   */
  const construireDonnees = (statut: StatutCollecte) => ({
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
          // Le producteur compte en sacs, jamais en kilos : l'unité suit l'usage.
          uniteProduction: UniteProduction.SACS_PAR_AN,
        },
        placette: {
          // Aperçu local ; le serveur attribuera le numéro définitif à la synchro.
          numeroPlacette: numeroApercu ?? 'PLC-PROVISOIRE',
          delegationRegionale: selectedDelegation?.nom ?? '',
          delegationId: delegationId ?? undefined,
          villeId: villeId ?? undefined,
          ville: selectedVille?.nom,
          village: village.trim() || undefined,
          zoneCadastrale: zoneCadastrale.trim() || undefined,
          chefEquipe: chefEquipe.trim() || undefined,
          dateInventaire: collecteDate.toISOString(),
          sommets: points,
          sousPlacettes: buildSousPlacettes(),
        },
  });

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
      const donnees = construireDonnees(statut);
      // La fiche a pu être créée entre-temps par la sauvegarde automatique :
      // on reprend son identifiant, sinon on créerait un second brouillon.
      const cible = editParcelleId ?? idBrouillonAuto;

      if (cible) {
        // Reprise : envoi en MODIFICATION. Le diff est fait par le storage, qui
        // apparie sous-placettes et mesures pour ne recréer que le nouveau.
        const maj = await offlineStorage.updateCompleteCollecte({
          parcelleId: cible,
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

  // --------------------------------------------------------------------------
  // Sauvegarde automatique du brouillon
  // --------------------------------------------------------------------------
  // Le terrain n'est pas un bureau : batterie à plat, application tuée par le
  // système, appui malheureux. Une saisie d'une heure et demie ne doit tenir
  // que dans la mémoire de l'application le temps qu'elle dure.
  //
  // Deux notions distinctes, qu'il ne faut pas confondre :
  //
  //   `saisieCommencee` — ce qui justifie d'ÉCRIRE un brouillon. Il faut un nom
  //   de producteur : sans lui, la fiche serait introuvable dans la liste des
  //   collectes, et créer un brouillon anonyme l'encombrerait pour rien.
  //
  //   `aQuelqueChose`   — ce qui justifie de DEMANDER CONFIRMATION avant de
  //   quitter. Là, tout compte. Un agent qui a relevé quatre points GPS et
  //   trente mesures sans avoir encore tapé le nom du producteur a beaucoup à
  //   perdre ; ne se fier qu'au nom le laissait sortir sans un mot.
  const saisieCommencee = nom.trim().length > 0 || prenoms.trim().length > 0;

  const aQuelqueChose =
    saisieCommencee ||
    genre !== null ||
    trancheAge !== null ||
    superficie.trim().length > 0 ||
    anneeParcelle.trim().length > 0 ||
    productionEstimee.trim().length > 0 ||
    pratiquesRetenues.length > 0 ||
    delegationId !== null ||
    villeId !== null ||
    village.trim().length > 0 ||
    zoneCadastrale.trim().length > 0 ||
    points.length > 0 ||
    mesuresCollectees.length > 0;

  /** Empêche deux écritures concurrentes, et donc deux fiches créées. */
  const persistanceEnCours = useRef(false);
  /** Dernier état écrit : sans cela on réécrirait la fiche à chaque frappe. */
  const dernierEtatPersiste = useRef<string>('');

  // La fonction est rangée dans une référence, mise à jour à chaque rendu :
  // le minuteur ci-dessous peut ainsi appeler la version la plus fraîche sans
  // qu'on ait à relancer le minuteur à chaque caractère tapé.
  const persisterRef = useRef<() => Promise<void>>(async () => {});

  persisterRef.current = async () => {
    if (!saisieCommencee || saving || persistanceEnCours.current) return;

    const donnees = construireDonnees(StatutCollecte.BROUILLON);
    // `consentementDate` est réévaluée à chaque appel : la retirer de l'empreinte
    // évite de croire à un changement à chaque comparaison.
    const empreinte = JSON.stringify({
      ...donnees,
      producteur: { ...donnees.producteur, consentementDate: undefined },
    });
    if (empreinte === dernierEtatPersiste.current) return;

    persistanceEnCours.current = true;
    try {
      const cible = editParcelleId ?? idBrouillonAuto;
      if (cible) {
        await offlineStorage.updateCompleteCollecte({
          parcelleId: cible,
          producteur: donnees.producteur,
          parcelle: donnees.parcelle,
          placette: donnees.placette,
        });
      } else {
        const cree = await offlineStorage.saveCompleteCollecte(donnees);
        setIdBrouillonAuto(cree.parcelle.id);
      }
      dernierEtatPersiste.current = empreinte;
    } catch {
      // Échec silencieux, et c'est voulu : l'agent est en train d'écrire.
      // L'interrompre par une alerte pour un incident que la tentative suivante
      // corrigera sans doute serait plus nuisible que l'incident lui-même. Les
      // enregistrements explicites, eux, signalent bien leurs erreurs.
    } finally {
      persistanceEnCours.current = false;
    }
  };

  // Une seconde et demie sans frappe déclenche l'écriture. Assez pour ne pas
  // écrire à chaque caractère, assez court pour qu'une coupure ne coûte qu'une
  // poignée de secondes de saisie.
  useEffect(() => {
    if (!saisieCommencee) return;
    const minuteur = setTimeout(() => void persisterRef.current(), 1500);
    return () => clearTimeout(minuteur);
  });

  // Prévient l'écran parent : il faut confirmer avant de quitter l'onglet.
  useEffect(() => {
    // `aQuelqueChose` et non `saisieCommencee` : la confirmation doit se
    // déclencher dès qu'il y a quoi que ce soit à l'écran, pas seulement quand
    // un nom de producteur a été tapé.
    onSaisieEnCoursChange?.(aQuelqueChose);
    // Au démontage, la garde est levée : sans cela, revenir plus tard sur un
    // autre onglet déclencherait une confirmation pour une fiche déjà close.
    return () => onSaisieEnCoursChange?.(false);
  }, [aQuelqueChose, onSaisieEnCoursChange]);

  /**
   * Sortie du formulaire par le bouton d'en-tête. La saisie étant déjà
   * conservée, la question n'est pas « voulez-vous perdre vos données » mais
   * « voulez-vous vous arrêter là » — et la réponse doit dire où la retrouver.
   */
  const demanderFermeture = async () => {
    // Rien de saisi : on sort sans poser de question, il n'y a rien à perdre.
    if (!aQuelqueChose) {
      onEditDone?.();
      onNavigate('enquetes');
      return;
    }

    const ok = await confirmer({
      titre: 'Fermer la fiche ?',
      message: saisieCommencee
        ? 'Votre saisie est conservée en brouillon. Vous la retrouverez dans « Collectes » pour la compléter plus tard.'
        : 'Le nom du producteur n’est pas encore renseigné : sans lui, la fiche ne peut pas être conservée en brouillon et votre saisie sera perdue.',
      libelleConfirmer: 'Fermer',
      libelleAnnuler: 'Continuer la saisie',
      destructif: true,
    });
    if (!ok) return;

    // Une dernière écriture avant de partir : le minuteur n'a peut-être pas
    // encore couru depuis la dernière frappe.
    await persisterRef.current();
    onEditDone?.();
    onNavigate('enquetes');
  };

  const mesuresPourSP = mesuresCollectees.filter((m) => m.numeroSP === selectedSP);

  // Chaque changement d'étape ramène en haut : sans cela l'agent arrive au
  // milieu du bloc suivant, à la hauteur de défilement qu'il avait laissée.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });

    // La barre d'étapes suit : sans cela, passer à l'étape 5 laisse la puce
    // active hors de l'écran, et l'agent ne voit plus où il en est. Largeur
    // approchée d'une puce — inutile de mesurer au pixel près, il s'agit
    // seulement d'amener la bonne zone dans le champ de vision.
    const LARGEUR_PUCE = 96;
    stepsScrollRef.current?.scrollTo({
      x: Math.max(0, (currentStep - 2) * LARGEUR_PUCE),
      animated: true,
    });
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
        setZoneCadastrale(plc.zoneCadastrale ?? '');
        setChefEquipe(plc.chefEquipe ?? '');
        setPoints(plc.sommets ?? []);

        // Bloc D : les mesures, en conservant l'identifiant local de chacune —
        // c'est lui qui permettra de la modifier plutôt que d'en créer une
        // nouvelle. Les compteurs de la sous-placette ne sont PAS relus : ils
        // se recalculent à partir des mesures rechargées, et repartir de la
        // valeur stockée risquerait de figer un chiffre devenu faux.
        const mesures: MesureCollectee[] = [];
        for (const sp of plc.sousPlacettes ?? []) {
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
              hauteurFut: m.hauteurFut,
              hauteurTotale: m.hauteurTotale,
              etatSanitaire: m.etatSanitaire,
              maladieId: m.maladieId,
              maladieLibre: m.maladieLibre,
              photoMaladie: m.photoMaladie,
            });
          }
        }
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
        avatarUri={avatarAffichable(user)}
        // Fiche ouverte : le « + » n'aurait rien à ouvrir de plus. Il devient
        // la sortie, avec confirmation (voir `demanderFermeture`).
        actionPrincipale="fermer"
        onNewAction={demanderFermeture}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      {/* Barre d'étapes défilante : six libellés lisibles ne tiennent pas dans
          une largeur de téléphone sans être tronqués. Elle se déplace toute
          seule pour garder l'étape active en vue. */}
      <View style={styles.stepsWrapper}>
        <ScrollView
          ref={stepsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Marges par le `contentContainerStyle` et non par le style de la
          // ScrollView : posées sur cette dernière, elles rogneraient la zone
          // de défilement et les puces seraient coupées net aux bords. Ici
          // elles font partie du contenu, donc la première et la dernière puce
          // gardent leur respiration quel que soit le défilement.
          contentContainerStyle={[
            styles.stepsContainer,
            { paddingLeft: paddingHorizontal, paddingRight: paddingHorizontal },
          ]}
        >
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
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Titre de l'étape en cours. Fixe, lui : c'est le repère qui subsiste
            quand la puce active est sortie de l'écran. */}
        <View style={[styles.etapeBandeau, { paddingHorizontal }]}>
          <Text style={styles.etapeCompteur}>
            Étape {currentStep} sur {ETAPES.length}
          </Text>
          <Text style={styles.etapeTitre} numberOfLines={1}>
            {ETAPES.find((e) => e.step === currentStep)?.titre ?? ''}
          </Text>
        </View>
      </View>

      {/* Le clavier recouvrait le champ en cours de saisie. Deux moitiés à la
          correction, car aucune ne suffit seule : ici, iOS remonte le contenu
          au-dessus du clavier ; côté Android, c'est `softwareKeyboardLayoutMode`
          à « resize » dans app.json qui redimensionne la fenêtre — sans lui,
          aucun composant React ne peut compenser, le clavier se dessinant
          par-dessus l'application. */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
        // Sans cela, clavier ouvert, le premier appui sur un bouton ne fait que
        // refermer le clavier : l'agent doit appuyer deux fois.
        keyboardShouldPersistTaps="handled"
      >
        {/* BLOC A */}
        {currentStep === 1 && (
          <View style={styles.stepCard}>
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
                        <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                        <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {TRANCHE_AGE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Le numéro de pièce d'identité n'est plus demandé : une donnée
                d'identification qui ne sert à aucun traitement n'a pas à être
                relevée ni transportée. La colonne reste en base pour les fiches
                antérieures, elle n'est simplement plus alimentée. */}

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
            <Text style={styles.blocSub}>Superficie, production et pratiques culturales</Text>

            {/* Année choisie dans une liste plutôt que tapée : quatre chiffres au
                clavier laissaient passer 2106 pour 2016, et l'erreur ne se voyait
                qu'au contrôle de bornes. La liste descend de l'année en cours,
                les plantations récentes étant les plus souvent saisies. */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Année d'installation de la parcelle</Text>
              <SelectField
                value={anneeParcelle || null}
                options={anneesDisponibles}
                onChange={(v) => setAnneeParcelle(v ?? '')}
                placeholder="Choisir une année"
                title="Année d'installation"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Superficie (ha)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                placeholder="ex: 3.5"
                placeholderTextColor={colors.textMuted}
                value={superficie}
                onChangeText={(t) => setSuperficie(sanitizeDecimal(t))}
              />
            </View>

            {/* La production suit immédiatement la superficie : les deux se
                répondent, et l'agent les tient du producteur d'un même souffle. */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Estimation de la production</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="number-pad"
                placeholder="ex: 25"
                placeholderTextColor={colors.textMuted}
                value={productionEstimee}
                onChangeText={(t) => setProductionEstimee(sanitizeEntier(t))}
              />
              <Text style={styles.helperText}>
                Nombre de sacs par an : petite traite + grande traite cumulées.
              </Text>
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
                        <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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

            {/* Précision demandée quand « Aucune pratique » est cochée */}
            {pratiquesRetenues.includes(PratiqueRetenue.AUCUNE) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pratiques non listées *</Text>
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

            {/* Précision demandée quand « Autres » est cochée */}
            {pratiquesRetenues.includes(PratiqueRetenue.AUTRES) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Autres pratiques *</Text>
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
                          <Ionicons
                            name={complet ? 'checkmark-circle-outline' : entame ? 'ellipse-outline' : 'remove-circle-outline'}
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
                  <Ionicons name="clipboard-outline" size={14} color={colors.emeraldPrimary} />
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
                          <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                          <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                          <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                    // Trois chiffres au lieu de deux, et plus de plafond : un
                    // désherbage hebdomadaire dépasse déjà l'ancien maximum.
                    onChangeText={(t) => patchVolet({ nombreFoisParAn: sanitizeEntier(t, 3) })}
                  />
                </View>
              </View>
            )}

            <View style={styles.divider} />

            {/* Pas de saisie de l'état sanitaire ici : il est relevé sujet par
                sujet au Bloc D (état de santé, maladie du référentiel et photo
                de diagnostic obligatoire). Le redemander à la parcelle
                produisait une donnée déclarative redondante, et deux réponses
                possiblement contradictoires pour un même constat. */}

            {/* L'estimation de production vivait ici, en fin de bloc, loin de la
                superficie à laquelle elle se rapporte. Elle est remontée juste
                sous celle-ci. */}
          </View>
        )}

        {/* BLOC C */}
        {currentStep === 3 && (
          <View>
            <View style={styles.stepCard}>
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
                    <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
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
                            <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                            <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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

              {/* Type de cadastre : liste administrée depuis la console et mise
                  en cache. La zone se saisissait librement, ce qui produisait
                  autant d'orthographes que d'agents — rien de regroupable à la
                  restitution. La liste est masquée si elle est vide plutôt que
                  d'afficher un champ qu'on ne peut pas renseigner. */}
              {typesCadastre.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Type de cadastre <Text style={styles.optionalTag}>(facultatif)</Text>
                  </Text>
                  <SelectField
                    value={zoneCadastrale || null}
                    options={typesCadastre.map((t) => ({ key: t.nom, label: t.nom }))}
                    onChange={(v) => setZoneCadastrale(v ?? '')}
                    placeholder="Choisir un type"
                    title="Type de cadastre"
                  />
                </View>
              )}

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
                  <Ionicons name="calendar-outline" size={15} color={colors.emeraldPrimary} />
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
                    <Ionicons name="keypad-outline" size={15} color="#FFFFFF" />
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
                    especeKey: null,
                    especeAutre: '',
                  })
                }
              >
                <Ionicons name="cube-outline" size={14} color={isCacao ? '#FFF' : colors.textPrimary} />
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
                    etatSanitaire: EtatSanitaire.VIVANT,
                    maladieKey: null,
                    maladieAutre: '',
                    photoMaladie: null,
                  })
                }
              >
                <Ionicons name="sunny-outline" size={14} color={!isCacao ? '#FFF' : colors.textPrimary} />
                <Text style={[styles.typeBtnText, !isCacao && styles.typeBtnTextActive]}>
                  Arbre d'ombrage
                </Text>
              </TouchableOpacity>
            </View>

            {/* État de santé — juste après le choix du type de sujet, et non en
                fin de formulaire : c'est ce que l'agent constate en premier en
                arrivant devant le sujet, avant même de sortir son mètre. Il
                commande d'ailleurs la suite (maladie, photo de diagnostic). */}
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
                          <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" style={styles.chipCheck} />
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
                      Espèce hors liste — enregistrée comme émettrice d'ombre, puis proposée à
                      tous après validation par l'administration. Les arbres qui n'émettent pas
                      d'ombre se comptent séparément, au bloc suivant.
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

            {/* Les DEUX circonférences, toutes deux en centimètres. Elles se
                relèvent l'une après l'autre sur le même sujet : les demander en
                alternance dans un champ unique obligeait à n'en garder qu'une. */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Circonférences (cm)</Text>
              <View style={styles.deuxColonnes}>
                <View style={styles.colonne}>
                  <Text style={styles.rubriqueLabel}>À 30 cm du sol</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    placeholder="ex: 32"
                    placeholderTextColor={colors.textMuted}
                    value={draft.circo30}
                    onChangeText={(t) => patchDraft({ circo30: sanitizeDecimal(t) })}
                  />
                </View>
                <View style={styles.colonne}>
                  <Text style={styles.rubriqueLabel}>À 1,30 m</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    placeholder="ex: 28"
                    placeholderTextColor={colors.textMuted}
                    value={draft.circo130}
                    onChangeText={(t) => patchDraft({ circo130: sanitizeDecimal(t) })}
                  />
                </View>
              </View>
              <Text style={styles.helperText}>
                Minimum {LIMITES.circonference30cmCm.min} cm. Au-delà de{' '}
                {SEUIL_PHOTO_CIRCONFERENCE_CM} cm, une photo du sujet est demandée.
              </Text>
            </View>

            {/* Justification photo : n'apparaît que si le seuil est franchi.
                La valeur n'est jamais refusée — la photo distingue le sujet
                remarquable de la virgule oubliée. */}
            {circonferenceMaxSaisie > SEUIL_PHOTO_CIRCONFERENCE_CM && (
              <View style={styles.maladieBox}>
                <Text style={styles.inputLabel}>
                  Photo justificative * ({circonferenceMaxSaisie} cm)
                </Text>
                <Text style={styles.optionalTag}>
                  Cette circonférence sort de l'ordinaire. Une photo du sujet permettra de la
                  confirmer sans avoir à retourner sur place.
                </Text>
                {draft.photoCirconference ? (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: draft.photoCirconference }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoRetake} onPress={handlePhotoCirconference}>
                      <Ionicons name="refresh-outline" size={14} color={colors.emeraldPrimary} />
                      <Text style={styles.photoRetakeText}>Reprendre</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoBtn} onPress={handlePhotoCirconference}>
                    <Ionicons name="camera-outline" size={16} color={colors.emeraldPrimary} />
                    <Text style={styles.photoBtnText}>Photographier le sujet</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hauteurs (m)</Text>
              <View style={styles.deuxColonnes}>
                <View style={styles.colonne}>
                  <Text style={styles.rubriqueLabel}>Fût</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    placeholder="ex: 2.4"
                    placeholderTextColor={colors.textMuted}
                    value={draft.hauteurFut}
                    onChangeText={(t) => patchDraft({ hauteurFut: sanitizeDecimal(t) })}
                  />
                </View>
                <View style={styles.colonne}>
                  <Text style={styles.rubriqueLabel}>Totale</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    placeholder="ex: 4.5"
                    placeholderTextColor={colors.textMuted}
                    value={draft.hauteur}
                    onChangeText={(t) => patchDraft({ hauteur: sanitizeDecimal(t) })}
                  />
                </View>
              </View>
              <Text style={styles.helperText}>
                Le fût va du sol aux premières branches ; il ne peut pas dépasser la hauteur
                totale.
              </Text>
            </View>

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
                      <Ionicons name="refresh-outline" size={14} color={colors.emeraldPrimary} />
                      <Text style={styles.photoRetakeText}>Reprendre</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoBtn} onPress={handleCapturePhotoMaladie}>
                    <Ionicons name="camera-outline" size={16} color={colors.emeraldPrimary} />
                    <Text style={styles.photoBtnText}>Ajouter la photo (obligatoire)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.addMesureBtn} onPress={handleAddMesure}>
              <Ionicons name="add-circle-outline" size={16} color={colors.emeraldPrimary} />
              <Text style={styles.addMesureText}>
                Ajouter {isCacao ? 'ce cacaoyer' : 'cet arbre'} à SP{selectedSP}
              </Text>
            </TouchableOpacity>
            {isCacao && selectedSP !== 1 && (
              <Text style={styles.helperText}>{cacaoCountForSP}/3 cacaoyers (maximum SP2–SP6)</Text>
            )}

            {/* Comptages DÉDUITS des mesures, en lecture seule. Ils étaient
                tapés à la main et finissaient par contredire les relevés : un
                agent annonçait 120 cacaoyers puis en relevait 118, sans qu'on
                sache lequel croire. */}
            <View style={[styles.compteursRow, { marginTop: 16 }]}>
              <View style={styles.compteurCase}>
                <Text style={styles.compteurValeur}>
                  {compteursSP[selectedSP]?.cacaoVivants ?? 0}
                </Text>
                <Text style={styles.compteurLibelle}>cacaoyers vivants</Text>
              </View>
              <View style={styles.compteurCase}>
                <Text style={styles.compteurValeur}>{compteursSP[selectedSP]?.arbres ?? 0}</Text>
                <Text style={styles.compteurLibelle}>arbres d'ombrage</Text>
              </View>
            </View>
            <Text style={styles.helperText}>
              Comptés d'après les mesures enregistrées sur SP{selectedSP}. Les cacaoyers morts ou
              malades sont relevés mais n'entrent pas dans l'effectif vivant.
            </Text>

            {/* Accès au détail : la liste complète vit dans une fenêtre à part.
                Empilée ici, elle repoussait le formulaire de saisie hors de
                l'écran dès la dizaine de sujets. */}
            {mesuresPourSP.length > 0 && (
              <TouchableOpacity
                style={styles.addMesureBtn}
                onPress={() => setModaleMesuresOuverte(true)}
              >
                <Ionicons name="list-outline" size={16} color={colors.emeraldPrimary} />
                <Text style={styles.addMesureText}>
                  Voir et corriger les {mesuresPourSP.length} mesure(s) de SP{selectedSP}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Message d'erreur de validation (visible web + natif) */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* BLOC E — arbres n'émettant pas d'ombre */}
        {currentStep === 6 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocSub}>
              Les autres arbres présents sur la placette, recensés à part des arbres d'ombrage.
            </Text>

            {/* Le compte se fait tout seul : l'agent ajoute les arbres qu'il
                voit, le total suit. Lui demander en plus de saisir un nombre
                aurait rouvert la contradiction entre le chiffre annoncé et les
                sujets réellement recensés. */}
            <View style={[styles.compteursRow, { marginBottom: 16 }]}>
              <View style={styles.compteurCase}>
                <Text style={styles.compteurValeur}>{arbresNonEmetteurs.length}</Text>
                <Text style={styles.compteurLibelle}>
                  arbre{arbresNonEmetteurs.length > 1 ? 's' : ''} recensé
                  {arbresNonEmetteurs.length > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.compteurCase}>
                <Text style={styles.compteurValeur}>
                  {new Set(arbresNonEmetteurs.map((a) => a.espece ?? '—')).size}
                </Text>
                <Text style={styles.compteurLibelle}>espèce(s) différente(s)</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Espèce de l'arbre</Text>
              <SelectField
                title="Espèce de l'arbre"
                placeholder="Choisir dans la liste…"
                value={especeNonEmettrice}
                // Toutes les espèces sont proposées, pas seulement celles
                // marquées non émettrices : le référentiel importé les donne
                // toutes émettrices par défaut, et c'est l'agent devant l'arbre
                // qui sait ce qu'il voit. C'est la saisie DANS ce bloc qui vaut
                // classement, pas la fiche du référentiel.
                options={especeOptions}
                onChange={(key) => {
                  setEspeceNonEmettrice(key);
                  setEspeceNonEmettriceAutre('');
                }}
              />
              {especeNonEmettrice === CLE_AUTRE && (
                <>
                  <Text style={styles.optionalTag}>
                    Espèce hors liste — proposée à tous les agents après validation par
                    l'administration.
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nom de l'espèce"
                    placeholderTextColor={colors.textMuted}
                    value={especeNonEmettriceAutre}
                    onChangeText={setEspeceNonEmettriceAutre}
                  />
                </>
              )}
            </View>

            <TouchableOpacity style={styles.addMesureBtn} onPress={ajouterArbreNonEmetteur}>
              <Ionicons name="add-circle-outline" size={16} color={colors.emeraldPrimary} />
              <Text style={styles.addMesureText}>Ajouter cet arbre au recensement</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              L'espèce reste sélectionnée après l'ajout : plusieurs arbres de la même essence
              s'enregistrent d'un appui chacun.
            </Text>

            {/* Récapitulatif groupé par espèce : c'est la lecture utile — non
                pas « quarante lignes », mais « douze fromagers, huit tecks ». */}
            {arbresNonEmetteurs.length > 0 && (
              <View style={styles.mesuresList}>
                <Text style={styles.mesuresListTitle}>Recensement par espèce</Text>
                {Object.entries(
                  arbresNonEmetteurs.reduce<Record<string, number>>((acc, a) => {
                    const nom = a.espece ?? 'Espèce non précisée';
                    acc[nom] = (acc[nom] ?? 0) + 1;
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([nom, nombre]) => (
                    <View key={nom} style={styles.ligneMesure}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ligneMesureTitre}>{nom}</Text>
                        <Text style={styles.ligneMesureDetail}>
                          {nombre} arbre{nombre > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => retirerUnArbreNonEmetteur(nom)}
                        accessibilityLabel={`Retirer un ${nom}`}
                        style={styles.ligneMesureAction}
                      >
                        <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}

        {/* ÉTAPE 7 — Validation. Le récapitulatif de ce qui manque et les deux
            actions d'enregistrement vivent ici, et non au pied du Bloc D : cette
            page ne sert qu'à décider, sans avoir à défiler une longue saisie. */}
        {currentStep === 7 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocSub}>
              {manquants.length === 0
                ? 'La fiche est complète. Vous pouvez la soumettre.'
                : 'Vérifiez ce qui manque, puis choisissez comment enregistrer.'}
            </Text>

            {manquants.length === 0 ? (
              <View style={styles.completeBox}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.emeraldPrimary} />
                <Text style={styles.completeTexte}>
                  Toutes les informations requises sont renseignées.
                </Text>
              </View>
            ) : (
              <View style={styles.manquantsBox}>
                <View style={styles.manquantsHead}>
                  <Ionicons name="warning-outline" size={15} color={colors.warning} />
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

            {/* Deux actions explicites : l'agent décide, rien n'est choisi à sa place. */}
            <View style={styles.actionsFin}>
              <TouchableOpacity
                style={[styles.draftBtn, saving && styles.saveBtnDisabled]}
                onPress={() => handleSave(StatutCollecte.BROUILLON)}
                disabled={saving}
              >
                <Ionicons name="save-outline" size={17} color={colors.textPrimary} />
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
                <Ionicons name="checkmark-outline" size={18} color={colors.textLight} />
                <Text style={styles.saveBtnText}>
                  {saving
                    ? 'Enregistrement…'
                    : modeEdition
                      ? 'Compléter et soumettre'
                      : 'Soumettre la collecte'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.actionsFinAide}>
                Un brouillon reste sur votre appareil. Une collecte soumise part au
                serveur et n'est plus modifiable depuis le mobile.
              </Text>
            </View>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.bottomBarNav}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => setCurrentStep((prev) => (prev - 1) as never)}
            >
              <Ionicons name="arrow-back-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.prevBtnText}>Précédent</Text>
            </TouchableOpacity>
          )}

          {currentStep < DERNIERE_ETAPE && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
              <Text style={styles.nextBtnText}>
                {currentStep === DERNIERE_ETAPE - 1 ? 'Valider la collecte' : 'Étape suivante'}
              </Text>
              <Ionicons name="arrow-forward-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <ModaleMesures
        visible={modaleMesuresOuverte}
        onClose={() => setModaleMesuresOuverte(false)}
        numeroSP={selectedSP}
        mesures={mesuresCollectees}
        onSupprimer={supprimerMesure}
        styles={styles}
      />
    </View>
  );
};

/* -------------------------------------------------- Relecture des mesures */

/**
 * Fenêtre de relecture des sujets relevés sur une sous-placette.
 *
 * Les mesures sont REGROUPÉES par nature — cacaoyers par état sanitaire, puis
 * arbres d'ombrage — et non listées dans l'ordre de saisie. Un agent qui
 * cherche « le cacaoyer mort pourri que je viens d'enregistrer » le trouve
 * dans sa catégorie, au lieu de parcourir quarante lignes identiques.
 *
 * La liste vit dans une fenêtre plutôt que dans la page : empilée sous le
 * formulaire, elle repoussait la saisie hors de l'écran dès la dizaine de
 * sujets, et l'agent devait remonter à chaque ajout.
 */
function ModaleMesures({
  visible,
  onClose,
  numeroSP,
  mesures,
  onSupprimer,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  numeroSP: number;
  mesures: MesureCollectee[];
  onSupprimer: (indexGlobal: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  // L'index d'origine est conservé : c'est lui qui désigne la mesure à retirer
  // dans la liste complète, l'affichage étant réordonné.
  const avecIndex = mesures
    .map((m, indexGlobal) => ({ m, indexGlobal }))
    .filter(({ m }) => m.numeroSP === numeroSP);

  const groupes: { titre: string; lignes: typeof avecIndex }[] = [
    ...Object.values(EtatSanitaire).map((etat) => ({
      titre: `Cacaoyers — ${ETAT_SANITAIRE_LABELS[etat]}`,
      lignes: avecIndex.filter(
        ({ m }) => m.typeSujet === TypeSujet.CACAO && m.etatSanitaire === etat,
      ),
    })),
    {
      titre: "Arbres d'ombrage",
      lignes: avecIndex.filter(({ m }) => m.typeSujet !== TypeSujet.CACAO),
    },
  ].filter((g) => g.lignes.length > 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modaleFond}>
        <View style={styles.modaleCarte}>
          <View style={styles.modaleEntete}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modaleTitre}>Mesures de SP{numeroSP}</Text>
              <Text style={styles.modaleSousTitre}>
                {avecIndex.length} sujet{avecIndex.length > 1 ? 's' : ''} relevé
                {avecIndex.length > 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fermer">
              <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modaleCorps} showsVerticalScrollIndicator>
            {groupes.map((g) => (
              <View key={g.titre} style={styles.groupeMesures}>
                <Text style={styles.groupeTitre}>
                  {g.titre} ({g.lignes.length})
                </Text>
                {g.lignes.map(({ m, indexGlobal }) => (
                  <View key={indexGlobal} style={styles.ligneMesure}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ligneMesureTitre}>
                        {m.typeSujet === TypeSujet.CACAO ? 'Cacaoyer' : m.espece || 'Arbre'}
                      </Text>
                      <Text style={styles.ligneMesureDetail}>
                        {[
                          m.circonference30cm ? `C30 ${m.circonference30cm} cm` : null,
                          m.circonferenceDBH ? `C1,30 ${m.circonferenceDBH} cm` : null,
                          m.hauteurFut ? `fût ${m.hauteurFut} m` : null,
                          m.hauteurTotale ? `haut. ${m.hauteurTotale} m` : null,
                        ]
                          .filter(Boolean)
                          .join(' • ') || 'Aucune dimension renseignée'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onSupprimer(indexGlobal)}
                      accessibilityLabel="Supprimer cette mesure"
                      style={styles.ligneMesureAction}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}

            {groupes.length === 0 && (
              <Text style={styles.helperText}>Aucune mesure enregistrée sur cette sous-placette.</Text>
            )}
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
