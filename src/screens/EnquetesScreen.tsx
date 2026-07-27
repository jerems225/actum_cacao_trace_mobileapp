import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { SkeletonList } from '../components/common/Skeleton';
import { colors, useResponsive } from '../theme';
import type { Responsive } from '../theme/responsive';
import { offlineStorage } from '../services/storage';
import { avatarAffichable, type UserProfile } from '../services/auth';
import type { ParcelleLocal, PlacetteLocal, TabType } from '../types';
import { formatRole, StatutCollecte, STATUT_COLLECTE_LABELS } from '../types';

/**
 * Filtres de la liste des collectes.
 * Le filtre « Géolocalisées » a été retiré : les 4 sommets GPS sont exigés pour
 * soumettre, donc toute collecte soumise l'est nécessairement — le filtre
 * doublonnait « Soumises » sans rien apprendre.
 */
type FiltreParcelle = 'all' | 'brouillon' | 'soumise';

interface EnquetesScreenProps {
  onNavigate?: (tab: TabType) => void;
  /** Ouvre le wizard prérempli sur ce brouillon (reprise pour complétion). */
  onEditCollecte?: (parcelleId: string) => void;
  /** Fiche à déplier à l'arrivée sur l'écran (venue d'une notification). */
  ouvrirParcelleId?: string | null;
  /** Signale que la fiche demandée a été ouverte, pour ne pas la rouvrir. */
  onParcelleOuverte?: () => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

export const EnquetesScreen: React.FC<EnquetesScreenProps> = ({
  onNavigate,
  onEditCollecte,
  ouvrirParcelleId,
  onParcelleOuverte,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const responsive = useResponsive();
  const { paddingHorizontal, isTablet, cardColumns, contentStyle } = responsive;
  // Recalculée seulement quand les dimensions changent (rotation, tablette).
  const styles = useMemo(() => createStyles(responsive), [responsive]);
  const [loading, setLoading] = useState(true);
  const [parcelles, setParcelles] = useState<ParcelleLocal[]>([]);
  const [placettes, setPlacettes] = useState<PlacetteLocal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Le filtre « Alertes Maladie » s'appuyait sur `maladiesObservees`, champ
  // déprécié depuis que l'état sanitaire est relevé par sujet au Bloc D : il ne
  // ramenait plus rien. Remplacé par les filtres de cycle de vie, qui répondent
  // à la vraie question du terrain : qu'est-ce qu'il me reste à finir ?
  const [selectedFilter, setSelectedFilter] = useState<FiltreParcelle>('all');
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleLocal | null>(null);

  // Plus d'édition en ligne ici : la correction d'un brouillon passe par le
  // parcours de saisie complet, prérempli (bouton « Compléter la fiche »). Un
  // second formulaire partiel divergeait du wizard — il écrivait encore
  // `maladiesObservees`, champ désormais déprécié.
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Fiche demandée par une notification : on attend que les données soient
  // chargées, sinon la parcelle ne serait pas encore trouvable.
  useEffect(() => {
    if (!ouvrirParcelleId || loading) return;
    const cible = parcelles.find((p) => p.id === ouvrirParcelleId);
    if (cible) setSelectedParcelle(cible);
    onParcelleOuverte?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirParcelleId, loading, parcelles]);

  const loadData = async () => {
    // Le nom du producteur est dénormalisé sur la parcelle (`producteurNom`) :
    // l'écran n'a donc pas besoin de charger la liste des producteurs.
    const [pList, plcList] = await Promise.all([
      offlineStorage.getParcelles(),
      offlineStorage.getPlacettes(),
    ]);
    setParcelles(pList);
    setPlacettes(plcList);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getPlacetteForParcelle = (parcelleId: string) => {
    return placettes.find((plc) => plc.parcelleId === parcelleId);
  };

  /**
   * Lieu de la collecte, en n'assemblant que les parties réellement renseignées.
   * L'ancienne interpolation directe affichait « undefined, Abengourou » quand le
   * village n'avait pas été saisi — un brouillon en cours, cas parfaitement normal.
   */
  const lieuCollecte = (placette?: PlacetteLocal): string => {
    if (!placette) return 'Lieu non renseigné';
    const parties = [placette.village, placette.ville, placette.delegationRegionale]
      .map((v) => v?.trim())
      .filter((v): v is string => !!v);
    return parties.length ? parties.join(' · ') : 'Lieu non renseigné';
  };

  /** Une parcelle est considérée géolocalisée si sa placette possède ses 4 sommets GPS. */
  const isGeolocalisee = (parcelleId: string) => {
    const plc = getPlacetteForParcelle(parcelleId);
    return !!plc && plc.sommets.length === 4;
  };

  /**
   * Un brouillon est la seule fiche encore modifiable depuis le terrain : une
   * collecte soumise est verrouillée, sa correction relève de l'administration.
   * Les collectes antérieures au statut (valeur absente) sont donc traitées comme
   * soumises — elles l'ont été sous un flux qui exigeait une fiche complète.
   */
  const estBrouillon = (p: ParcelleLocal) => p.statutCollecte === StatutCollecte.BROUILLON;

  const filteredParcelles = parcelles.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !(p.producteurNom || '').toLowerCase().includes(q)) return false;

    if (selectedFilter === 'brouillon') return estBrouillon(p);
    if (selectedFilter === 'soumise') return !estBrouillon(p);
    return true;
  });

  // Compteurs affichés sur les pilules : l'agent voit d'un coup d'œil ce qui
  // reste à finir, sans avoir à changer de filtre pour le découvrir.
  const nbBrouillons = parcelles.filter(estBrouillon).length;
  const nbSoumises = parcelles.length - nbBrouillons;

  const FILTRES: { cle: FiltreParcelle; libelle: string; compte: number }[] = [
    { cle: 'all', libelle: 'Toutes', compte: parcelles.length },
    { cle: 'brouillon', libelle: 'Brouillons', compte: nbBrouillons },
    { cle: 'soumise', libelle: 'Soumises', compte: nbSoumises },
  ];

  const openParcelle = (parcelle: ParcelleLocal) => setSelectedParcelle(parcelle);

  return (
    <View style={styles.container}>
      <Header
        title="Liste des collectes"
        // Sous-titre resserré : il annonce ce que l'écran permet de faire, au
        // lieu de paraphraser le titre.
        subtitle={
          nbBrouillons > 0
            ? `${parcelles.length} fiche${parcelles.length > 1 ? 's' : ''} • ${nbBrouillons} à compléter`
            : `${parcelles.length} fiche${parcelles.length > 1 ? 's' : ''} enregistrée${parcelles.length > 1 ? 's' : ''}`
        }
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={avatarAffichable(user)}
        onNewAction={onNavigate ? () => onNavigate('collecte') : undefined}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.emeraldPrimary]}
          />
        }
      >
        {/* Barre de Recherche et Filtres */}
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un producteur, village ou maladie..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pilules de filtres — le compteur figure sur la pilule elle-même */}
        <View style={styles.filtersRow}>
          {FILTRES.map((f) => {
            const actif = selectedFilter === f.cle;
            return (
              <TouchableOpacity
                key={f.cle}
                style={[styles.filterPill, actif && styles.filterPillActive]}
                onPress={() => setSelectedFilter(f.cle)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, actif && styles.filterTextActive]}>
                  {f.libelle}
                </Text>
                {f.compte !== undefined && (
                  <View style={[styles.filterCompte, actif && styles.filterCompteActif]}>
                    <Text style={[styles.filterCompteTexte, actif && styles.filterCompteTexteActif]}>
                      {f.compte}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Grille responsive de parcelles (Single column phone, double column tablet) */}
        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <View style={[styles.parcellesGrid, isTablet && styles.parcellesGridTablet]}>
            {filteredParcelles.map((parcelle) => {
              const placette = getPlacetteForParcelle(parcelle.id);
              return (
              <TouchableOpacity
                key={parcelle.id}
                style={[
                  styles.parcelleCard,
                  isTablet && { width: cardColumns >= 3 ? '31.5%' : '48%' },
                ]}
                onPress={() => openParcelle(parcelle)}
                activeOpacity={0.85}
              >
                {/* Identité seule sur sa ligne : le nom dispose de toute la
                    largeur au lieu d'être comprimé par les badges. */}
                <View style={styles.cardHeader}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>
                      {(parcelle.producteurNom || 'P').trim()[0]?.toUpperCase() ?? 'P'}
                    </Text>
                  </View>
                  <View style={styles.cardIdentite}>
                    <Text style={styles.prodName} numberOfLines={1}>
                      {parcelle.producteurNom || 'Producteur sans nom'}
                    </Text>
                    <Text style={styles.prodSub} numberOfLines={1}>
                      {lieuCollecte(placette)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </View>

                {/* Badges sur leur propre rangée, qui se replie : trois badges ne
                    tiennent pas à côté d'un nom sur un écran de téléphone. */}
                <View style={styles.badgesRow}>
                  {/* Statut de collecte : gris ardoise pour un brouillon (travail
                      en cours, pas une alerte), vert pour une fiche soumise. */}
                  {estBrouillon(parcelle) ? (
                    <View style={[styles.badgeConforme, styles.badgeDraft]}>
                      <Feather name="edit-3" size={10} color={colors.draftText} />
                      <Text style={[styles.badgeConformeText, { color: colors.draftText }]}>
                        {STATUT_COLLECTE_LABELS[StatutCollecte.BROUILLON]}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.badgeConforme}>
                      <Feather name="check-circle" size={10} color={colors.emeraldPrimary} />
                      <Text style={styles.badgeConformeText}>
                        {STATUT_COLLECTE_LABELS[StatutCollecte.SOUMISE]}
                      </Text>
                    </View>
                  )}

                  {/* Le repère GPS ne se signale que s'il MANQUE quelque chose :
                      les 4 sommets étant exigés pour soumettre, l'afficher sur
                      une fiche complète n'apprendrait rien. */}
                  {!isGeolocalisee(parcelle.id) && (
                    <View style={[styles.badgeConforme, styles.badgeDraft]}>
                      <Feather name="map-pin" size={10} color={colors.draftText} />
                      <Text style={[styles.badgeConformeText, { color: colors.draftText }]}>
                        GPS {placette ? placette.sommets.length : 0}/4
                      </Text>
                    </View>
                  )}

                  {/* La synchronisation est un état technique : elle se signale
                      seulement quand elle est en attente, et en gris. */}
                  {!parcelle.synced && (
                    <View style={[styles.badgeConforme, styles.badgeDraft]}>
                      <Feather name="upload-cloud" size={10} color={colors.draftText} />
                      <Text style={[styles.badgeConformeText, { color: colors.draftText }]}>
                        À synchroniser
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Superficie</Text>
                    <Text style={styles.infoValue}>{parcelle.superficie || 'N/A'} ha</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Sommets GPS</Text>
                    <Text style={styles.infoValue}>
                      {placette ? `${placette.sommets.length}/4 points` : '0/4 points'}
                    </Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Production Est.</Text>
                    <Text style={styles.infoValue}>
                      {parcelle.productionEstimee != null ? `${parcelle.productionEstimee} kg/an` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Rappel d'action sur un brouillon, en gris : c'est une
                    invitation à finir, pas une alerte sanitaire. */}
                {estBrouillon(parcelle) && (
                  <View style={styles.rappelBox}>
                    <Feather name="corner-down-right" size={12} color={colors.draftText} />
                    <Text style={styles.rappelText} numberOfLines={1}>
                      Fiche à compléter puis soumettre
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Détails de la Parcelle */}
      <Modal
        visible={!!selectedParcelle}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedParcelle(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Fiche du producteur
              </Text>
              <TouchableOpacity onPress={() => setSelectedParcelle(null)}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedParcelle && (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.detailLabel}>Producteur</Text>
                <Text style={styles.detailValue}>{selectedParcelle.producteurNom || '—'}</Text>

                <Text style={styles.detailLabel}>Superficie Totale</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.superficie != null ? `${selectedParcelle.superficie} Hectares` : '—'}
                </Text>

                <Text style={styles.detailLabel}>Pratiques culturales déclarées</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.pratiquesRetenues?.length
                    ? selectedParcelle.pratiquesRetenues.join(' • ')
                    : '—'}
                </Text>

                <Text style={styles.detailLabel}>Production estimée</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.productionEstimee != null
                    ? `${selectedParcelle.productionEstimee} kg/an`
                    : '—'}
                </Text>

                <Text style={styles.detailLabel}>Géoréférencement</Text>
                <Text style={styles.detailValue}>
                  {(() => {
                    const plc = getPlacetteForParcelle(selectedParcelle.id);
                    const n = plc ? plc.sommets.length : 0;
                    return `${n}/4 sommets GPS capturés`;
                  })()}
                </Text>

                {/* Deux axes distincts, volontairement séparés : le statut
                    métier (brouillon / soumise) et l'état technique d'envoi. */}
                <Text style={styles.detailLabel}>Statut de la collecte</Text>
                <Text style={styles.detailValue}>
                  {estBrouillon(selectedParcelle)
                    ? 'Brouillon — à compléter puis soumettre'
                    : 'Soumise — non modifiable depuis le mobile'}
                </Text>

                <Text style={styles.detailLabel}>Statut de synchronisation</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.synced ? 'Synchronisé ✓' : 'En attente de synchronisation'}
                </Text>
              </ScrollView>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.closeBtn, styles.cancelBtn]}
                onPress={() => setSelectedParcelle(null)}
              >
                <Text style={styles.cancelBtnText}>Fermer</Text>
              </TouchableOpacity>
                {/* Le bouton « Modifier » n'apparaît que sur un brouillon : une
                    fiche soumise est verrouillée pour le terrain. Le message
                    explique où aller plutôt que de laisser l'agent buter. */}
                {selectedParcelle && estBrouillon(selectedParcelle) ? (
                  // Reprise dans le parcours de saisie complet, prérempli : c'est
                  // le seul moyen de compléter les sommets GPS ou l'identité du
                  // producteur, que la modale ne couvre pas.
                  <TouchableOpacity
                    style={[styles.closeBtn, { flex: 1 }]}
                    onPress={() => {
                      const id = selectedParcelle.id;
                      setSelectedParcelle(null);
                      onEditCollecte?.(id);
                    }}
                  >
                    <Feather name="edit-2" size={15} color={colors.textLight} />
                    <Text style={styles.closeBtnText}>  Compléter la fiche</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.verrouBox, { flex: 1 }]}>
                    <Feather name="lock" size={13} color={colors.textSecondary} />
                    <Text style={styles.verrouTexte}>
                      Collecte soumise — correction via l'administration
                    </Text>
                  </View>
                )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Fabrique et non feuille figée : les tailles de texte suivent la classe
// d'appareil via scale() (voir theme/responsive.ts), et le composant la
// recalcule seulement à la rotation grâce au useMemo.
const createStyles = ({ scale }: Responsive) =>
  StyleSheet.create({
  // Remplace le bouton « Modifier » sur une collecte soumise : même emprise,
  // pour que la disposition du pied de modale ne bouge pas.
  verrouBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  verrouTexte: {
    flex: 1,
    fontSize: scale(11.5),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: scale(13.5),
  },
  filtersRow: {
    flexDirection: 'row',
    // Quatre pilules : elles se replient au lieu de sortir de l'écran.
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxWidth: '100%',
  },
  filterPillActive: {
    backgroundColor: colors.forestDark,
    borderColor: colors.forestDark,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: scale(12),
    fontWeight: '600',
    flexShrink: 1,
  },
  filterTextActive: {
    color: colors.textLight,
    fontWeight: '700',
  },
  // Compteur intégré à la pilule : chiffre discret, pas une pastille de couleur.
  filterCompte: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
  },
  filterCompteActif: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  filterCompteTexte: {
    fontSize: scale(10.5),
    fontWeight: '800',
    color: colors.textSecondary,
  },
  filterCompteTexteActif: {
    color: colors.textLight,
  },
  parcellesGrid: {
    gap: 12,
  },
  parcellesGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  parcelleCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.forestDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  parcelleCardTablet: {
    width: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Bloc identité : `minWidth: 0` autorise la troncature du nom au lieu de
  // laisser la ligne s'élargir hors de la carte.
  cardIdentite: {
    flex: 1,
    minWidth: 0,
  },
  // Badges sur leur propre rangée, alignés sous l'identité, qui se replie.
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
    // L'initiale ne doit jamais être écrasée par le texte voisin.
    flexShrink: 0,
  },
  avatarMiniText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: scale(14),
  },
  prodName: {
    fontSize: scale(14),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  prodSub: {
    fontSize: scale(11),
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeConforme: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBadge,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgeConformeText: {
    color: colors.emeraldPrimary,
    fontSize: scale(10),
    lineHeight: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  // Badge d'état neutre : brouillon, en attente de synchro… rien d'alarmant.
  badgeDraft: {
    backgroundColor: colors.draftBg,
    borderWidth: 1,
    borderColor: colors.draftBorder,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  // Trois indicateurs qui se partagent la largeur et se replient si les libellés
  // s'allongent, plutôt qu'un space-between qui les tassait aux extrémités.
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    gap: 2,
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: scale(10.5),
    lineHeight: 14,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: scale(13),
    lineHeight: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rappelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.draftBg,
    borderWidth: 1,
    borderColor: colors.draftBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  rappelText: {
    color: colors.draftText,
    fontSize: scale(11),
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: scale(18),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  detailLabel: {
    fontSize: scale(11),
    color: colors.textMuted,
    marginTop: 12,
  },
  detailValue: {
    fontSize: scale(14),
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    flexDirection: 'row',
    backgroundColor: colors.forestDark,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  closeBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: scale(14),
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cancelBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: scale(14),
  },
  });

