import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  badgeText?: string;
  iconName: keyof typeof Feather.glyphMap;
  variant?: 'light' | 'dark' | 'mint';
  subtitle?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  badgeText,
  iconName,
  variant = 'light',
  subtitle,
}) => {
  const { cardBorderRadius } = useResponsive();

  const isDark = variant === 'dark';
  const isMint = variant === 'mint';

  const containerBg = isDark
    ? colors.forestCard
    : isMint
    ? colors.mintBadge
    : colors.backgroundCard;

  const textColor = isDark ? colors.textLight : colors.textPrimary;
  const subtitleColor = isDark ? colors.mintSoft : colors.textSecondary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: containerBg, borderRadius: cardBorderRadius },
        !isDark && styles.cardShadow,
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : isMint
                ? 'rgba(30, 107, 76, 0.15)'
                : 'rgba(30, 107, 76, 0.08)',
            },
          ]}
        >
          <Feather
            name={iconName}
            size={18}
            color={isDark ? colors.mintSoft : colors.emeraldPrimary}
          />
        </View>

        {badgeText && (
          <View style={[styles.badge, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
              {badgeText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.contentSection}>
        <Text style={[styles.title, { color: subtitleColor }]}>{title}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: textColor }]}>{value}</Text>
          {unit && <Text style={[styles.unit, { color: subtitleColor }]}>{unit}</Text>}
        </View>
        {subtitle && <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardShadow: {
    shadowColor: colors.forestDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: colors.mintBadge,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDark: {
    backgroundColor: 'rgba(72, 196, 143, 0.2)',
  },
  badgeText: {
    color: colors.emeraldPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextDark: {
    color: colors.mintSoft,
  },
  contentSection: {
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
