import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';
import type { PointGPS } from '../../types';

interface CompassGPSGaugeProps {
  sommets: PointGPS[];
  activeSommetOrdre: number;
  onCaptureSommet: (ordre: number) => void;
  areaInHectares?: number;
}

export const CompassGPSGauge: React.FC<CompassGPSGaugeProps> = ({
  sommets,
  activeSommetOrdre,
  onCaptureSommet,
  areaInHectares = 0,
}) => {
  const { cardBorderRadius } = useResponsive();

  const getSommetStatus = (ordre: number) => {
    return sommets.find((s) => s.ordreSommet === ordre);
  };

  return (
    <View style={[styles.card, { borderRadius: cardBorderRadius }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Relevé des 4 Sommets GPS</Text>
          <Text style={styles.subtitle}>Placette Principale — Bornes Côte d'Ivoire</Text>
        </View>

        <View style={styles.areaBadge}>
          <Ionicons name="layers-outline" size={12} color={colors.emeraldPrimary} />
          <Text style={styles.areaText}>{areaInHectares > 0 ? `${areaInHectares} ha` : 'Polygone'}</Text>
        </View>
      </View>

      {/* Visualisation des 4 sommets */}
      <View style={styles.gaugeContainer}>
        <View style={styles.circleOuter}>
          <View style={styles.circleInner}>
            <Ionicons name="navigate-outline" size={32} color={colors.mintSoft} />
            <Text style={styles.gaugeText}>
              {sommets.length}/4 Sommets
            </Text>
            <Text style={styles.gaugeSubtext}>Précision &lt; 3.5 m</Text>
          </View>
        </View>
      </View>

      {/* Boutons de sélection/capture des sommets S1 à S4 */}
      <View style={styles.sommetsGrid}>
        {[1, 2, 3, 4].map((ordre) => {
          const point = getSommetStatus(ordre);
          const isCaptured = !!point;
          const isActive = activeSommetOrdre === ordre;

          return (
            <TouchableOpacity
              key={ordre}
              style={[
                styles.sommetButton,
                isCaptured && styles.sommetCaptured,
                isActive && styles.sommetActive,
              ]}
              onPress={() => onCaptureSommet(ordre)}
              activeOpacity={0.8}
            >
              <View style={styles.sommetTop}>
                <Text
                  style={[
                    styles.sommetLabel,
                    isCaptured && styles.textLight,
                    isActive && styles.textActive,
                  ]}
                >
                  Sommet S{ordre}
                </Text>
                <Ionicons
                  name={isCaptured ? 'checkmark-circle-outline' : 'locate-outline'}
                  size={14}
                  color={isCaptured ? colors.mintSoft : colors.textSecondary}
                />
              </View>

              {point ? (
                <Text style={styles.sommetCoords}>
                  {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                </Text>
              ) : (
                <Text style={styles.sommetPending}>Toucher pour capturer</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.forestCard,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 16,
  },
  subtitle: {
    color: colors.mintSoft,
    fontSize: 12,
    marginTop: 2,
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(72, 196, 143, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  areaText: {
    color: colors.mintSoft,
    fontWeight: '700',
    fontSize: 12,
  },
  gaugeContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  circleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(72, 196, 143, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 38, 29, 0.4)',
  },
  circleInner: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(30, 107, 76, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  gaugeText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 4,
  },
  gaugeSubtext: {
    color: colors.mintSoft,
    fontSize: 10,
  },
  sommetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  sommetButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sommetCaptured: {
    backgroundColor: 'rgba(30, 107, 76, 0.6)',
    borderColor: colors.mintLight,
  },
  sommetActive: {
    borderColor: colors.mintSoft,
    borderWidth: 2,
  },
  sommetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sommetLabel: {
    color: colors.mintSoft,
    fontWeight: '700',
    fontSize: 12,
  },
  textLight: {
    color: colors.textLight,
  },
  textActive: {
    color: colors.mintSoft,
  },
  sommetCoords: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  sommetPending: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
});
