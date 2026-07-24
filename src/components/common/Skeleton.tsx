import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width as number | `${number}%`,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  return (
    <View style={[styles.cardContainer, style]}>
      <View style={styles.rowBetween}>
        <Skeleton width={130} height={20} borderRadius={10} />
        <Skeleton width={24} height={24} borderRadius={12} />
      </View>
      <View style={{ marginVertical: 12 }}>
        <Skeleton width={90} height={14} borderRadius={6} />
        <Skeleton width={160} height={36} borderRadius={8} style={{ marginTop: 8 }} />
      </View>
      <Skeleton width="100%" height={10} borderRadius={5} />
    </View>
  );
};

export const SkeletonMetric: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  return (
    <View style={[styles.metricCard, style]}>
      <View style={styles.rowBetween}>
        <Skeleton width={90} height={12} borderRadius={6} />
        <Skeleton width={28} height={28} borderRadius={14} />
      </View>
      <Skeleton width={70} height={24} borderRadius={8} style={{ marginTop: 10 }} />
      <Skeleton width={100} height={12} borderRadius={6} style={{ marginTop: 6 }} />
    </View>
  );
};

export const SkeletonListItem: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  return (
    <View style={[styles.listItem, style]}>
      <Skeleton width={42} height={42} borderRadius={14} />
      <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
        <Skeleton width="60%" height={16} borderRadius={6} />
        <Skeleton width="40%" height={12} borderRadius={4} />
      </View>
      <Skeleton width={50} height={18} borderRadius={8} />
    </View>
  );
};

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonListItem key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: '#E2E8F0',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  listContainer: {
    gap: 10,
  },
});
