import { StyleSheet } from 'react-native';

import { colors } from '../../theme';
import type { Responsive } from '../../theme/responsive';

// ============================================================================
// Styles — fabrique dépendante du responsive
// ----------------------------------------------------------------------------
// Fabrique et non feuille figée : tailles de texte, marges et rayons suivent la
// classe d'appareil via `scale()` (voir theme/responsive.ts). Une feuille statique
// donnait un texte tassé sur petit téléphone et perdu sur tablette. Recalculée
// seulement à la rotation ou au redimensionnement, grâce au useMemo du composant.
//
// Règle anti-débordement : tout conteneur en ligne reçoit `minWidth: 0`, et tout
// texte potentiellement long reçoit `flex: 1` + `flexShrink: 1`. Sans cela, un
// libellé comme « Désherbage chimique (produit phytosanitaire) » pousse sa puce
// hors de la carte au lieu de passer à la ligne.
// ============================================================================

const createStyles = ({ scale, isTablet, isSmallPhone }: Responsive) => {
  // Respiration intérieure des cartes : serrée sur petit écran, généreuse sur
  // tablette où la largeur ne manque pas.
  const cardPadding = isTablet ? 24 : isSmallPhone ? 15 : 18;
  // Espace au-dessus d'un titre de section : sépare franchement deux sujets.
  const avantTitre = scale(isSmallPhone ? 16 : 20);

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  /** Enveloppe : barre défilante + bandeau de titre, sur le même fond. */
  stepsWrapper: {
    backgroundColor: colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  stepsContainer: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  stepItem: {
    // Plus de `flex: 1` : la barre défile, chaque puce prend la largeur de son
    // libellé. À six onglets partagés en parts égales, « Producteur » et
    // « Mesures » se tronquaient sur un écran étroit.
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
  },
  /* Bandeau de titre : fixe sous la barre défilante. Il porte le repère que la
     puce active ne garantit plus une fois sortie de l'écran. */
  etapeBandeau: {
    paddingBottom: 10,
  },
  etapeCompteur: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etapeTitre: {
    fontSize: scale(15),
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  stepActive: {
    backgroundColor: colors.forestDark,
  },
  stepDone: {
    backgroundColor: colors.mintBadge,
    borderWidth: 1,
    borderColor: colors.emeraldPrimary,
  },
  stepText: {
    fontSize: scale(10.5),
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepTextActive: {
    color: colors.textLight,
    fontWeight: '700',
  },
  stepTextDone: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
  },
  /** Enveloppe d'évitement du clavier : occupe la hauteur restante. */
  flex1: {
    flex: 1,
  },
  /** Deux champs côte à côte (les circonférences, les hauteurs). */
  deuxColonnes: {
    flexDirection: 'row',
    gap: 10,
  },
  colonne: {
    flex: 1,
    minWidth: 0,
  },
  /* Compteurs déduits des mesures — présentés comme un résultat, pas comme un
     champ : ni bordure de saisie ni fond blanc, pour qu'on ne cherche pas à y
     taper une valeur. */
  compteursRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compteurCase: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.mintBadge,
  },
  compteurValeur: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.emeraldPrimary,
  },
  compteurLibelle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  /* Fenêtre de relecture des mesures */
  modaleFond: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modaleCarte: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Bornée en hauteur : la fenêtre ne doit jamais couvrir tout l'écran, on
    // doit continuer de voir qu'il y a une page derrière.
    maxHeight: '80%',
    paddingBottom: 8,
  },
  modaleEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modaleTitre: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modaleSousTitre: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modaleCorps: {
    paddingHorizontal: 18,
  },
  groupeMesures: {
    marginTop: 16,
  },
  groupeTitre: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  ligneMesure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundCard,
    marginBottom: 6,
  },
  ligneMesureTitre: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ligneMesureDetail: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ligneMesureAction: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  stepCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: isTablet ? 24 : 20,
    padding: cardPadding,
    marginBottom: scale(18),
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Garde-fou : la carte ne dépasse jamais la largeur disponible, quel que
    // soit le contenu qu'on y place ensuite.
    overflow: 'hidden',
  },
  // Titre de bloc : `lineHeight` explicite pour que les majuscules accentuées
  // (É, À) ne soient pas rognées, et respiration nette avant le sous-titre.
  blocTitle: {
    fontSize: scale(16),
    lineHeight: scale(22),
    fontWeight: '800',
    color: colors.forestDark,
  },
  blocSub: {
    fontSize: scale(12),
    lineHeight: scale(17),
    color: colors.textSecondary,
    marginTop: scale(3),
    marginBottom: scale(18),
  },
  inputGroup: {
    marginBottom: scale(14),
    // 6 collait le titre à son champ : à cette distance, le libellé se lit comme
    // faisant partie de la bordure de saisie plutôt que comme la question posée.
    gap: scale(9),
    // Un groupe de champ ne doit jamais élargir son parent.
    minWidth: 0,
  },
  inputLabel: {
    fontSize: scale(12),
    lineHeight: scale(17),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  /**
   * Titre d'un ensemble qui n'est PAS un `inputGroup` — sélecteur de
   * sous-placette, sélecteur de nature du sujet.
   *
   * Ces titres étaient de simples `inputLabel` posés juste avant leur contrôle :
   * sans le `gap` de l'`inputGroup` pour les espacer, ils venaient buter contre
   * les puces. L'espacement est donc porté par le style, et non par la structure.
   */
  labelBloc: {
    fontSize: scale(12),
    lineHeight: scale(17),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: scale(9),
  },
  /**
   * Titre d'un second champ dans un même encadré (ex. « Photo de diagnostic »
   * sous « Maladie »). Remplace un `marginTop` écrit à la main dans le JSX, qui
   * échappait au facteur d'échelle et restait donc identique sur tablette.
   */
  labelSuivant: {
    fontSize: scale(12),
    lineHeight: scale(17),
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: scale(14),
    marginBottom: scale(9),
  },
  optionalTag: {
    fontSize: scale(11),
    fontWeight: '500',
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: scale(10),
    marginBottom: scale(16),
  },
  sectionMini: {
    fontSize: scale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: avantTitre,
    marginBottom: scale(12),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 4,
  },
  dateIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    fontSize: scale(11),
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateValue: {
    fontSize: scale(15),
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  autoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.mintBadge,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  autoPillText: {
    fontSize: scale(9.5),
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.emeraldPrimary,
  },
  textInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: scale(14),
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  helperText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stepBadgeText: {
    fontSize: scale(11),
    fontWeight: '900',
    color: colors.emeraldPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    // Décollé de son titre : les puces d'état sanitaire venaient buter sous
    // « État de santé », qu'on lisait alors comme la première puce de la série.
    marginTop: scale(3),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(13),
    paddingVertical: scale(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundLight,
    // Une puce au libellé long (« Plantes parasitaires (loranthacées,
    // épiphytes) ») s'arrête au bord de la carte et passe à la ligne, au lieu de
    // déborder : c'est `maxWidth` qui autorise le retour à la ligne du texte.
    maxWidth: '100%',
    flexShrink: 1,
  },
  chipActive: {
    backgroundColor: colors.emeraldPrimary,
    borderColor: colors.emeraldPrimary,
  },
  chipCheck: {
    marginRight: 5,
  },
  chipText: {
    fontSize: scale(13),
    lineHeight: scale(18),
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  emptyRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyRefText: {
    flex: 1,
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  numeroCard: {
    marginTop: 6,
    borderRadius: 18,
    padding: 16,
    shadowColor: colors.forestDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  numeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  numeroIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroCardLabel: {
    flex: 1,
    fontSize: scale(12),
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
  },
  apercuPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  apercuPillText: {
    fontSize: scale(9.5),
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  numeroCardValue: {
    // « D-ABJ-ABJ-001 » avec un interlettrage large sortait de la carte sur les
    // petits écrans : la taille et l'interlettrage cèdent avant la mise en page.
    fontSize: scale(isSmallPhone ? 21 : 26),
    fontWeight: '900',
    letterSpacing: isSmallPhone ? 0.5 : 2,
    color: '#FFFFFF',
  },
  numeroCardHint: {
    marginTop: 6,
    fontSize: scale(11.5),
    color: 'rgba(255,255,255,0.8)',
  },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBadge,
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 12,
  },
  consentTitle: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: scale(13),
  },
  consentText: {
    color: colors.textSecondary,
    fontSize: scale(11),
    marginTop: 2,
    lineHeight: 15,
  },
  // --- Pratiques culturales (B4) : détail par volet ---
  // Le détail est encadré et légèrement détaché du reste du bloc B : l'agent voit
  // d'un coup d'œil où commence et où finit la colonne du tableau papier.
  voletBloc: {
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  voletEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  voletEnteteTitre: {
    fontSize: scale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  voletEnteteCompteur: {
    fontSize: scale(11),
    fontWeight: '700',
    color: colors.emeraldPrimary,
  },
  voletTabs: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  voletTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: scale(8),
    paddingHorizontal: scale(10),
    borderRadius: 10,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Trois onglets qui se partagent la largeur sans jamais la dépasser.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: scale(96),
    minWidth: 0,
  },
  voletTabActive: {
    backgroundColor: colors.emeraldPrimary,
    borderColor: colors.emeraldPrimary,
  },
  voletTabText: {
    fontSize: scale(12.5),
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  voletTabTextActive: { color: colors.textLight },
  // Bandeau d'identité : répond en permanence à « quelle colonne je remplis ? ».
  voletBandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: colors.mintBadge,
    borderLeftWidth: 3,
    borderLeftColor: colors.emeraldPrimary,
  },
  voletBandeauTexte: {
    flex: 1,
    fontSize: scale(12),
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.emeraldPrimary,
  },
  // Le rang ne se comprime pas : c'est le nom du volet qui cède la place.
  voletBandeauRang: { fontSize: scale(11), color: colors.textSecondary, flexShrink: 0 },
  // Libellé de rubrique = ligne du tableau papier (Types, Agents, Fréquence…).
  rubriqueLabel: {
    fontSize: scale(12.5),
    lineHeight: scale(17),
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: scale(16),
    marginBottom: scale(8),
  },

  spSelector: {
    flexDirection: 'row',
    gap: scale(6),
    marginBottom: scale(16),
    flexWrap: 'wrap',
  },
  spButton: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(10),
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Les 6 sous-placettes se répartissent la largeur et se replient sur deux
    // rangées régulières plutôt que de dépasser à droite.
    flexGrow: 1,
    flexBasis: scale(60),
    minWidth: scale(52),
  },
  spButtonActive: {
    backgroundColor: colors.emeraldPrimary,
    borderColor: colors.emeraldPrimary,
  },
  spText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  spTextActive: {
    color: colors.textLight,
  },
  /**
   * Sélecteur de nature du sujet — TROIS catégories depuis que les « autres
   * arbres » ont rejoint le Bloc D.
   *
   * Même parti que `spSelector` : les puces se REPLIENT au lieu de se comprimer.
   * À trois `flex: 1` sur une seule rangée, chaque puce tombait à un tiers de la
   * largeur, et « Arbre d'ombrage » s'y tronquait sur un petit téléphone. Ici
   * elles gardent une largeur lisible et passent à la rangée suivante quand
   * l'écran ne suit plus — deux puis une, plutôt que trois illisibles.
   */
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(6),
  },
  typeBtn: {
    // Icône AU-DESSUS du libellé : en ligne, elle prenait sur la largeur du
    // texte, qui est précisément ce qui manquait. En colonne, le libellé
    // dispose de toute la puce.
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    paddingVertical: scale(11),
    paddingHorizontal: scale(8),
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Se partagent la largeur à parts égales, avec un plancher qui déclenche le
    // repli plutôt que la troncature.
    flexGrow: 1,
    flexBasis: scale(92),
    minWidth: scale(86),
  },
  typeBtnActive: {
    backgroundColor: colors.forestDark,
    borderColor: colors.forestDark,
  },
  typeBtnText: {
    fontSize: scale(11.5),
    lineHeight: scale(15),
    fontWeight: '700',
    color: colors.textPrimary,
    // Centré, et deux lignes autorisées dans le composant : « Arbre d'ombrage »
    // passe à la ligne proprement sous son icône au lieu d'être tronqué.
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  typeBtnTextActive: {
    color: colors.textLight,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  segmentBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: colors.emeraldPrimary,
  },
  segmentText: {
    fontSize: scale(13),
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  maladieBox: {
    backgroundColor: '#FEF3F2',
    borderRadius: 14,
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: scale(14),
    // 4 collait « Maladie * » à sa liste déroulante et « Photo justificative »
    // à son bouton, dans le bloc le plus dense de l'écran.
    gap: scale(8),
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.mintBadge,
    borderWidth: 1,
    borderColor: colors.emeraldPrimary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  photoBtnText: {
    fontSize: scale(13),
    fontWeight: '800',
    color: colors.emeraldPrimary,
    flexShrink: 1,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
  },
  photoRetake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoRetakeText: {
    fontSize: scale(13),
    fontWeight: '700',
    color: colors.emeraldPrimary,
  },
  addMesureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintBadge,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  addMesureText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: scale(13),
    // Le libellé de correction est plus long que celui d'ajout : il se resserre
    // plutôt que de pousser l'icône hors du bouton.
    flexShrink: 1,
  },
  /* En correction, l'action porte une bordure : le bouton reste au même endroit
     avec le même poids visuel, mais on voit qu'il ne fait plus la même chose. */
  addMesureBtnEdition: {
    borderWidth: 1.5,
    borderColor: colors.emeraldPrimary,
  },
  /* Bandeau de correction, en tête du formulaire. Un formulaire prérempli sans
     un mot laisse croire à une saisie neuve — et « Ajouter » à un doublon. */
  editionBandeau: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.mintBadge,
    borderRadius: 12,
    padding: scale(12),
    marginBottom: 14,
  },
  editionBandeauTexte: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.emeraldPrimary,
    lineHeight: scale(17),
  },
  /* Sortie de la correction : discrète, en texte. Elle ne doit pas rivaliser
     avec l'action d'enregistrement, mais rester atteignable. */
  annulerEditionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  annulerEditionTexte: {
    flexShrink: 1,
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  /* Accès à la liste des sujets relevés. En pleine couleur, à la différence de
     l'ajout : la liste était introuvable, reléguée en pied de formulaire dans le
     même vert pâle que tout le reste. */
  voirMesuresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.emeraldPrimary,
    paddingVertical: 12,
    paddingHorizontal: scale(14),
    borderRadius: 12,
    marginTop: 12,
  },
  voirMesuresTexte: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: colors.textLight,
    fontWeight: '800',
    fontSize: scale(12.5),
  },
  /* --- Onglet Comptage : une carte par sous-placette --- */
  comptageCarte: {
    marginTop: 14,
    padding: scale(14),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundLight,
  },
  comptageEntete: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  comptageTitre: {
    fontSize: scale(15),
    fontWeight: '900',
    color: colors.textPrimary,
  },
  comptageSousTitre: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: scale(11.5),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  comptageLignes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  comptageLigne: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundCard,
  },
  comptageChiffre: {
    fontSize: scale(19),
    fontWeight: '900',
    color: colors.emeraldPrimary,
  },
  comptageEtiquette: {
    fontSize: scale(10),
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  /* Incohérence signalée sans blocage : l'agent est peut-être en train de taper
     son nombre, et l'interrompre au deuxième chiffre serait pénible. */
  comptageAlerte: {
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.warning,
    marginTop: 4,
  },
  mesuresList: {
    marginTop: 16,
    gap: 8,
  },
  mesuresListTitle: {
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mesureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: 10,
    gap: 8,
    // Le récapitulatif d'une mesure peut être long : il passe à la ligne dans
    // sa pastille plutôt que de sortir de la carte.
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mesureChipText: {
    fontSize: scale(12),
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: scale(12.5),
    fontWeight: '600',
    flex: 1,
  },
  bottomBarNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  prevBtnText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.emeraldPrimary,
    gap: 6,
  },
  nextBtnText: {
    fontWeight: '800',
    color: colors.textLight,
    fontSize: scale(14),
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.forestDark,
    gap: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontWeight: '800',
    color: colors.textLight,
    fontSize: scale(14),
    flexShrink: 1,
  },

  // --- Fin de saisie : ce qui manque, puis les deux actions ---
  // Encadré d'avertissement et non d'erreur : il informe, il n'interdit pas.
  manquantsBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    // Liseré assagi : le cadre délimite sans cerner de couleur vive.
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: scale(13),
    marginBottom: scale(12),
    gap: 3,
  },
  manquantsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  manquantsTitre: {
    flex: 1,
    fontSize: scale(12.5),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  manquantsLigne: {
    fontSize: scale(12),
    lineHeight: scale(18),
    color: colors.textSecondary,
  },
  manquantsAide: {
    marginTop: 6,
    fontSize: scale(11.5),
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  // Pendant vert de `manquantsBox` : même gabarit, message inverse.
  completeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.mintBadge,
    borderWidth: 1,
    borderColor: colors.mintSoft,
    borderRadius: 12,
    padding: scale(13),
    marginBottom: scale(12),
  },
  completeTexte: {
    flex: 1,
    fontSize: scale(12.5),
    lineHeight: scale(18),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionsFin: {
    gap: scale(10),
    marginTop: scale(4),
  },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: scale(14),
    borderRadius: 14,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  draftBtnText: {
    fontSize: scale(13.5),
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  actionsFinAide: {
    fontSize: scale(11),
    color: colors.textMuted,
    textAlign: 'center',
  },
  });
};

/** Feuille de styles de la saisie de collecte, dérivée du responsive. */
export type CollecteStyles = ReturnType<typeof createStyles>;

export { createStyles };
