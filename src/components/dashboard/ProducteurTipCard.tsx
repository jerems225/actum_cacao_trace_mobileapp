import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';

interface ProducteurTipCardProps {
  title?: string;
  description?: string;
  onPressAction?: () => void;
}

export const ProducteurTipCard: React.FC<ProducteurTipCardProps> = ({
  title = 'Accompagnement du producteur',
  description = "Relevez l'état sanitaire des plants et délimitez la parcelle (4 sommets GPS) pour un meilleur suivi et une production optimisée du producteur.",
  onPressAction,
}) => {
  const { cardBorderRadius } = useResponsive();

  return (
    <View style={[styles.card, { borderRadius: cardBorderRadius }]}>
      <Image
        source={require('../../../assets/images/cacao_pod.png')}
        style={styles.illustrationImage}
      />
      <View style={styles.contentSection}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Feather name="user-check" size={14} color={colors.emeraldPrimary} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>

        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={onPressAction}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>Voir les producteurs</Text>
          <Feather name="chevron-right" size={16} color={colors.emeraldPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  illustrationImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  contentSection: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
});
