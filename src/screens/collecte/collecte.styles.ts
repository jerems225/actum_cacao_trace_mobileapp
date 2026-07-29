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
  stepsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 6,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
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
    gap: scale(6),
    // Un groupe de champ ne doit jamais élargir son parent.
    minWidth: 0,
  },
  inputLabel: {
    fontSize: scale(12),
    lineHeight: scale(17),
    fontWeight: '700',
    color: colors.textPrimary,
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
    marginTop: 2,
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
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: colors.forestDark,
    borderColor: colors.forestDark,
  },
  typeBtnText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.textPrimary,
    // « Arbre d'ombrage » sur petit écran : le texte se resserre au lieu de
    // faire grossir le bouton au-delà de sa moitié de largeur.
    flexShrink: 1,
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
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 14,
    gap: 4,
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
