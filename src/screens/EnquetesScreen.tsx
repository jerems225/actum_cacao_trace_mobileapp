import React, { useEffect, useState } from 'react';
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
import { offlineStorage } from '../services/storage';
import type { UserProfile } from '../services/auth';
import type { ParcelleLocal, ProducteurLocal, PlacetteLocal, TabType } from '../types';
import { formatRole } from '../types';

interface EnquetesScreenProps {
  onNavigate?: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

export const EnquetesScreen: React.FC<EnquetesScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const { paddingHorizontal, isTablet, cardColumns, contentStyle } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [parcelles, setParcelles] = useState<ParcelleLocal[]>([]);
  const [producteurs, setProducteurs] = useState<ProducteurLocal[]>([]);
  const [placettes, setPlacettes] = useState<PlacetteLocal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'geolocalisees' | 'maladies'>('all');
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleLocal | null>(null);

  // --- État d'édition (modification + persistance) ---
  const [editMode, setEditMode] = useState(false);
  const [editSuperficie, setEditSuperficie] = useState('');
  const [editMaladies, setEditMaladies] = useState('');
  const [editProduction, setEditProduction] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pList = await offlineStorage.getParcelles();
    const prodList = await offlineStorage.getProducteurs();
    const plcList = await offlineStorage.getPlacettes();
    setParcelles(pList);
    setProducteurs(prodList);
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

  /** Une parcelle est considérée géolocalisée si sa placette possède ses 4 sommets GPS. */
  const isGeolocalisee = (parcelleId: string) => {
    const plc = getPlacetteForParcelle(parcelleId);
    return !!plc && plc.sommets.length === 4;
  };

  const filteredParcelles = parcelles.filter((p) => {
    const matchesSearch =
      (p.producteurNom || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.maladiesObservees || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFilter === 'maladies') return !!p.maladiesObservees;
    if (selectedFilter === 'geolocalisees') return isGeolocalisee(p.id);
    return true;
  });

  const openParcelle = (parcelle: ParcelleLocal) => {
    setSelectedParcelle(parcelle);
    setEditMode(false);
    setEditSuperficie(parcelle.superficie != null ? String(parcelle.superficie) : '');
    setEditMaladies(parcelle.maladiesObservees || '');
    setEditProduction(parcelle.productionEstimee != null ? String(parcelle.productionEstimee) : '');
  };

  const handleSaveEdit = async () => {
    if (!selectedParcelle) return;
    setSavingEdit(true);
    const parseNum = (v: string): number | undefined => {
      const n = parseFloat(v.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };
    const updated = await offlineStorage.updateParcelle(selectedParcelle.id, {
      superficie: parseNum(editSuperficie),
      maladiesObservees: editMaladies.trim() || undefined,
      productionEstimee: parseNum(editProduction),
    });
    setSavingEdit(false);
    if (updated) {
      await loadData();
      setSelectedParcelle(updated);
      setEditMode(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Producteurs & Parcelles"
        subtitle="Répertoire des producteurs et parcelles géoréférencées"
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={user?.avatarUri}
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

        {/* Pilules de Filtres */}
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
              Toutes ({parcelles.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'geolocalisees' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('geolocalisees')}
          >
            <Text style={[styles.filterText, selectedFilter === 'geolocalisees' && styles.filterTextActive]}>
              Géolocalisées
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'maladies' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('maladies')}
          >
            <Text style={[styles.filterText, selectedFilter === 'maladies' && styles.filterTextActive]}>
              Alertes Maladie
            </Text>
          </TouchableOpacity>
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
                <View style={styles.cardHeader}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>
                      {(parcelle.producteurNom || 'P')[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>
                      {parcelle.producteurNom || 'Producteur Cacao'}
                    </Text>
                    <Text style={styles.prodSub}>
                      {placette ? `${placette.village}, ${placette.delegationRegionale}` : 'Côte d\'Ivoire'}
                    </Text>
                  </View>

                  {isGeolocalisee(parcelle.id) ? (
                    <View style={styles.badgeConforme}>
                      <Feather name="shield" size={10} color={colors.emeraldPrimary} />
                      <Text style={styles.badgeConformeText}>Géolocalisée</Text>
                    </View>
                  ) : (
                    <View style={[styles.badgeConforme, styles.badgeConformePending]}>
                      <Feather name="clock" size={10} color={colors.warning} />
                      <Text style={[styles.badgeConformeText, { color: colors.warning }]}>
                        {parcelle.synced ? 'En cours' : 'Non sync.'}
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

                {parcelle.maladiesObservees && (
                  <View style={styles.alertBox}>
                    <Feather name="alert-triangle" size={12} color={colors.warning} />
                    <Text style={styles.alertText} numberOfLines={1}>
                      {parcelle.maladiesObservees}
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
                {editMode ? 'Modifier la Parcelle' : 'Fiche du producteur'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedParcelle(null)}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedParcelle && !editMode && (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.detailLabel}>Producteur</Text>
                <Text style={styles.detailValue}>{selectedParcelle.producteurNom || '—'}</Text>

                <Text style={styles.detailLabel}>Superficie Totale</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.superficie != null ? `${selectedParcelle.superficie} Hectares` : '—'}
                </Text>

                <Text style={styles.detailLabel}>Pratiques Culturales (Entretien)</Text>
                <Text style={styles.detailValue}>{selectedParcelle.typeEntretien || '—'}</Text>

                <Text style={styles.detailLabel}>État Sanitaire & Maladies</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.maladiesObservees || 'Aucune maladie observée'}
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

                <Text style={styles.detailLabel}>Statut de synchronisation</Text>
                <Text style={styles.detailValue}>
                  {selectedParcelle.synced ? 'Synchronisé ✓' : 'En attente de synchronisation'}
                </Text>
              </ScrollView>
            )}

            {selectedParcelle && editMode && (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.detailLabel}>Superficie (ha)</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="decimal-pad"
                  value={editSuperficie}
                  onChangeText={setEditSuperficie}
                  placeholder="ex: 3.5"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.detailLabel}>Maladies & Attaques observées</Text>
                <TextInput
                  style={styles.editInput}
                  value={editMaladies}
                  onChangeText={setEditMaladies}
                  placeholder="ex: Swollen Shoot"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.detailLabel}>Production estimée (kg/an)</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  value={editProduction}
                  onChangeText={setEditProduction}
                  placeholder="ex: 1400"
                  placeholderTextColor={colors.textMuted}
                />
              </ScrollView>
            )}

            {editMode ? (
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.closeBtn, styles.cancelBtn]}
                  onPress={() => setEditMode(false)}
                  disabled={savingEdit}
                >
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.closeBtn, { flex: 1 }, savingEdit && { opacity: 0.6 }]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  <Text style={styles.closeBtnText}>
                    {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.closeBtn, styles.cancelBtn]}
                  onPress={() => setSelectedParcelle(null)}
                >
                  <Text style={styles.cancelBtnText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.closeBtn, { flex: 1 }]}
                  onPress={() => setEditMode(true)}
                >
                  <Feather name="edit-2" size={15} color={colors.textLight} />
                  <Text style={styles.closeBtnText}>  Modifier</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 13.5,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterPillActive: {
    backgroundColor: colors.forestDark,
    borderColor: colors.forestDark,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.textLight,
    fontWeight: '700',
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
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  prodSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeConforme: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBadge,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgeConformeText: {
    color: colors.emeraldPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeConformePending: {
    backgroundColor: colors.warningBg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  alertText: {
    color: colors.warning,
    fontSize: 11,
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 12,
  },
  detailValue: {
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 14,
  },
  editInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 4,
  },
});
