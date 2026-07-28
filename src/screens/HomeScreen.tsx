import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { ProducteurTipCard } from '../components/dashboard/ProducteurTipCard';
import { SkeletonCard, SkeletonMetric, SkeletonList } from '../components/common/Skeleton';
import { colors, useResponsive } from '../theme';
import { offlineStorage } from '../services/storage';
import { avatarAffichable, type UserProfile } from '../services/auth';
import type { TabType, ParcelleLocal } from '../types';
import { formatRole } from '../types';

interface HomeScreenProps {
  onNavigate: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const { paddingHorizontal, contentStyle } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalParcelles: 0,
    totalProducteurs: 0,
    superficieTotale: 0,
    pendingSyncCount: 0,
    productionTotale: 0,
    totalMesures: 0,
    tauxPlantsSains: 0,
    alertesSanitaires: 0,
  });
  const [recentParcelles, setRecentParcelles] = useState<ParcelleLocal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const s = await offlineStorage.getStats();
    setStats(s);
    const parcelles = await offlineStorage.getParcelles();
    // Section « Récents » : on limite aux 5 dernières parcelles (tri décroissant
    // déjà assuré par le repository).
    setRecentParcelles(parcelles.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header
        title="CacaoTrace"
        subtitle="Vous contrôlez la Traçabilité & l'Inventaire"
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={avatarAffichable(user)}
        onNewAction={() => onNavigate('collecte')}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.emeraldPrimary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 16 }}>
            <SkeletonCard />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonMetric />
              <SkeletonMetric />
            </View>
            <SkeletonList count={3} />
          </View>
        ) : (
          <>
            {/* SECTION ACTIVITÉ RÉCENTE (en haut) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Producteurs & inventaires récents</Text>
              <TouchableOpacity onPress={() => onNavigate('enquetes')}>
                <Text style={styles.seeAllText}>Voir Tout</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.activityList}>
              {recentParcelles.map((parcelle) => (
                <TouchableOpacity
                  key={parcelle.id}
                  style={styles.activityCard}
                  onPress={() => onNavigate('enquetes')}
                  activeOpacity={0.8}
                >
                  <View style={styles.activityIconBox}>
                    <Ionicons name="layers-outline" size={18} color={colors.emeraldPrimary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{parcelle.producteurNom || 'Producteur'}</Text>
                    <Text style={styles.activitySubtitle}>
                      {parcelle.typeEntretien || 'Parcelle cacaoyère'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.activityAmount}>
                      {parcelle.superficie != null ? `${parcelle.superficie} ha` : '—'}
                    </Text>
                    <Text style={styles.activityDate}>
                      {parcelle.anneeParcelle || '—'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* CARTE HERO FINANCIÈRE / SUPERFICIE */}
            <View style={styles.heroCard}>
              <Text style={styles.heroSubLabel}>Superficie totale suivie</Text>

              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>{stats.superficieTotale}</Text>
                <Text style={styles.heroUnit}>Hectares</Text>
              </View>

              {/* Graphique de Tendance */}
              <View style={styles.chartContainer}>
                <View style={styles.chartDashedLine} />
                <View style={styles.chartBadgePill}>
                  <Text style={styles.chartBadgeText}>{stats.tauxPlantsSains}% sains</Text>
                </View>
                <View style={styles.chartPolylineSimulated} />
                <View style={styles.chartMonthsRow}>
                  <Text style={styles.chartMonthText}>Jan</Text>
                  <Text style={styles.chartMonthText}>Fév</Text>
                  <Text style={styles.chartMonthText}>Mar</Text>
                  <Text style={styles.chartMonthText}>Avr</Text>
                  <Text style={styles.chartMonthText}>Mai</Text>
                </View>
              </View>

              {/* Cartes jumelles en bas du Hero */}
              <View style={styles.heroTwinCardsRow}>
                <View style={styles.twinCard}>
                  <View style={styles.twinHeader}>
                    <Text style={styles.twinTitle}>Parcelles suivies</Text>
                    <Ionicons name="layers-outline" size={14} color={colors.emeraldPrimary} />
                  </View>
                  <Text style={styles.twinValue}>{stats.totalParcelles}</Text>
                </View>

                <View style={styles.twinCard}>
                  <View style={styles.twinHeader}>
                    <Text style={styles.twinTitle}>Production estimée</Text>
                    <Ionicons name="trending-up-outline" size={14} color={colors.emeraldPrimary} />
                  </View>
                  <Text style={styles.twinValue}>{stats.productionTotale} kg/an</Text>
                </View>
              </View>
            </View>

            {/* WIDGET OBJECTIF & JAUGE */}
            <View style={styles.targetWidget}>
              <View style={styles.targetTopRow}>
                <Text style={styles.targetTitle}>État sanitaire des plants de cacao</Text>
                {/* Renvoyait vers l'onglet carte, retiré du menu : on pointe
                    désormais vers la liste des collectes, seule vue accessible. */}
                <TouchableOpacity onPress={() => onNavigate('enquetes')}>
                  <Text style={styles.seeAllText}>Voir les collectes</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.targetMainValue}>{stats.tauxPlantsSains}% de plants sains</Text>
              <Text style={styles.targetSubtext}>
                {stats.alertesSanitaires} parcelle{stats.alertesSanitaires > 1 ? 's' : ''} en alerte •{' '}
                {stats.totalMesures} mesure{stats.totalMesures > 1 ? 's' : ''} relevée{stats.totalMesures > 1 ? 's' : ''}
              </Text>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${stats.tauxPlantsSains}%` }]} />
              </View>

              <View style={styles.accentPillBanner}>
                <Ionicons name="pulse-outline" size={14} color="#FFF" />
                <Text style={styles.accentPillText}>
                  Suivi sanitaire pour une meilleure production cacaoyère 🌱
                </Text>
              </View>
            </View>

            {/* Accompagnement du producteur */}
            <ProducteurTipCard onPressAction={() => onNavigate('enquetes')} />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  heroSubLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chartContainer: {
    height: 90,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 16,
  },
  chartDashedLine: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    height: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  chartBadgePill: {
    position: 'absolute',
    top: 18,
    right: '35%',
    backgroundColor: colors.emeraldPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  chartBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  chartPolylineSimulated: {
    height: 45,
    borderBottomWidth: 3,
    borderColor: colors.emeraldPrimary,
    borderRadius: 12,
  },
  chartMonthsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  chartMonthText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  heroTwinCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  twinCard: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  twinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  twinTitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  twinValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  targetWidget: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  targetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  targetTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  targetMainValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  targetSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.backgroundLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.emeraldPrimary,
    borderRadius: 4,
  },
  accentPillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.emeraldPrimary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 8,
  },
  accentPillText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emeraldPrimary,
  },
  activityList: {
    gap: 10,
    marginBottom: 20,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  activityIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  activitySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  activityDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
