import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';
import type { TabType } from '../../types';

interface FloatingTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingSyncCount?: number;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabChange,
  pendingSyncCount = 0,
}) => {
  const { isTablet, tabBarBottomInset } = useResponsive();

  // L'onglet carte a été retiré du menu. L'écran existe toujours
  // (`CarteScreen`) mais n'est plus atteignable depuis la barre : la cartographie
  // relève de la restitution, côté administration, pas de la saisie terrain.
  const tabs: Array<{ id: TabType; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { id: 'home', label: 'Accueil', icon: 'grid' },
    { id: 'enquetes', label: 'Collectes', icon: 'layers' },
    { id: 'collecte', label: 'Saisir', icon: 'plus-circle' },
    { id: 'sync', label: 'Envoi', icon: 'upload-cloud' },
  ];

  return (
    <View style={[styles.wrapper, { bottom: tabBarBottomInset }]}>
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.85}
            >
              <View style={styles.iconContainer}>
                <Feather
                  name={tab.icon}
                  size={20}
                  color={isActive ? '#FFF' : colors.textMuted}
                />
                {tab.id === 'sync' && pendingSyncCount > 0 && (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeText}>{pendingSyncCount}</Text>
                  </View>
                )}
              </View>
              {isTablet && (
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? '#FFF' : colors.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    gap: 6,
  },
  containerTablet: {
    maxWidth: 620,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: colors.pillBlack,
  },
  iconContainer: {
    position: 'relative',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeDot: {
    position: 'absolute',
    top: -6,
    right: -8,
    // Compteur de collectes à envoyer : rouge sobre, comme les autres compteurs.
    backgroundColor: colors.error,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
