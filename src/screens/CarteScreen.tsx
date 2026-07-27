import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { colors, useResponsive } from '../theme';
import { offlineStorage } from '../services/storage';
import type { UserProfile } from '../services/auth';
import type { PlacetteLocal, TabType, PointGPS } from '../types';
import { formatRole, TypePoint } from '../types';

/** Ne garde que les sommets (S) — exclut milieux Mi/Mc — pour le polygone. */
const isSommet = (s: PointGPS) =>
  s.typePoint !== TypePoint.MILIEU_INTERMEDIAIRE && s.typePoint !== TypePoint.MILIEU_CENTRAL;

interface CarteScreenProps {
  onNavigate?: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

export const CarteScreen: React.FC<CarteScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const { paddingHorizontal, isTablet } = useResponsive();
  const [placettes, setPlacettes] = useState<PlacetteLocal[]>([]);
  const [selectedPlacette, setSelectedPlacette] = useState<PlacetteLocal | null>(null);

  useEffect(() => {
    loadPlacettes();
  }, []);

  const loadPlacettes = async () => {
    const list = await offlineStorage.getPlacettes();
    setPlacettes(list);
    // Conserve la placette sélectionnée si elle existe toujours, sinon la 1re.
    setSelectedPlacette((prev) => {
      if (prev) {
        const still = list.find((p) => p.id === prev.id);
        if (still) return still;
      }
      return list.length > 0 ? list[0] : null;
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Carte SIG & Parcelles"
        subtitle="Visualisation géoréférencée des polygones de parcelles"
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={user?.avatarUri}
        onNewAction={onNavigate ? () => onNavigate('collecte') : undefined}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <View style={styles.mapCanvas}>
        {/* Image de Carte Satellite SIG d'arrière-plan */}
        <Image
          source={require('../../assets/images/map_satellite.png')}
          style={styles.mapBackgroundImage}
        />

        <View style={styles.mapOverlayContainer}>
          {/* Overlay Polyline de la parcelle sélectionnée */}
          {selectedPlacette && (
            <View style={styles.polygonSimulated}>
              <Text style={styles.polygonLabel}>{selectedPlacette.numeroPlacette}</Text>
              <Text style={styles.polygonSub}>
                {selectedPlacette.sommets.filter(isSommet).length}/4 sommets validés (EPSG:4326)
              </Text>

              {/* Sommets GPS */}
              {selectedPlacette.sommets.filter(isSommet).map((s) => (
                <View key={s.ordreSommet} style={styles.vertexMarker}>
                  <Text style={styles.vertexText}>S{s.ordreSommet}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Calques & Contrôles SIG */}
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.mapControlBtn}>
              <Feather name="layers" size={18} color={colors.forestDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapControlBtn}>
              <Feather name="crosshair" size={18} color={colors.forestDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapControlBtn}>
              <Feather name="zoom-in" size={18} color={colors.forestDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.legendBadge}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Parcelle géoréférencée — San-Pédro (Soubré)</Text>
          </View>
        </View>
      </View>

      {/* Barre inférieure de sélection des placettes */}
      <View style={[styles.bottomTray, { paddingHorizontal }]}>
        <View style={styles.trayHeader}>
          <Text style={styles.trayTitle}>Placettes Géoréférencées ({placettes.length})</Text>
          <TouchableOpacity
            style={styles.trayRefreshBtn}
            onPress={loadPlacettes}
            accessibilityLabel="Rafraîchir les placettes"
          >
            <Feather name="refresh-cw" size={16} color={colors.emeraldPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayScroll}>
          {placettes.map((plc) => (
            <TouchableOpacity
              key={plc.id}
              style={[
                styles.trayCard,
                selectedPlacette?.id === plc.id && styles.trayCardSelected,
              ]}
              onPress={() => setSelectedPlacette(plc)}
            >
              <Feather name="shield" size={16} color={selectedPlacette?.id === plc.id ? colors.mintSoft : colors.emeraldPrimary} />
              <View>
                <Text style={[styles.trayCardTitle, selectedPlacette?.id === plc.id && styles.textLight]}>
                  {plc.numeroPlacette}
                </Text>
                <Text style={[styles.trayCardSub, selectedPlacette?.id === plc.id && styles.textLightSub]}>
                  {plc.village || 'San-Pédro'} • {plc.sommets.filter(isSommet).length} sommets
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  mapCanvas: {
    flex: 1,
    position: 'relative',
  },
  mapBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapOverlayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 38, 29, 0.4)',
  },
  polygonSimulated: {
    width: '80%',
    height: 220,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 2,
    borderColor: '#34D399',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  polygonLabel: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 20,
  },
  polygonSub: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 4,
  },
  vertexMarker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.emeraldPrimary,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vertexText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 8,
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 4,
  },
  legendBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  legendText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomTray: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 80,
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  trayRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayScroll: {
    gap: 10,
  },
  trayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  trayCardSelected: {
    backgroundColor: colors.pillBlack,
    borderColor: colors.pillBlack,
  },
  trayCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trayCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  textLight: {
    color: '#FFF',
  },
  textLightSub: {
    color: '#A7F3D0',
  },
});
