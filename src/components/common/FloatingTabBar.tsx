import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsive, useTheme } from '../../theme';
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
  const { palette } = useTheme();

  // L'onglet carte a été retiré du menu. L'écran existe toujours
  // (`CarteScreen`) mais n'est plus atteignable depuis la barre : la cartographie
  // relève de la restitution, côté administration, pas de la saisie terrain.
  const tabs: Array<{ id: TabType; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { id: 'home', label: 'Accueil', icon: 'grid' },
    { id: 'enquetes', label: 'Collectes', icon: 'layers' },
    { id: 'collecte', label: 'Saisir', icon: 'plus-circle' },
    { id: 'sync', label: 'Envoi', icon: 'upload-cloud' },
    { id: 'parametres', label: 'Réglages', icon: 'sliders' },
  ];

  return (
    <View style={[styles.wrapper, { bottom: tabBarBottomInset }]}>
      <View
        style={[
          styles.container,
          { backgroundColor: palette.backgroundCard, borderColor: palette.borderLight },
          isTablet && styles.containerTablet,
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              // `flex: 1` : à cinq onglets, une largeur fixe débordait de la
              // carte sur les petits téléphones. Chacun prend sa part.
              style={[
                styles.tabButton,
                isActive && { backgroundColor: palette.pillBlack },
              ]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
            >
              <View style={styles.iconContainer}>
                <Feather
                  name={tab.icon}
                  size={20}
                  color={isActive ? palette.textLight : palette.textMuted}
                />
                {tab.id === 'sync' && pendingSyncCount > 0 && (
                  <View style={[styles.badgeDot, { backgroundColor: palette.error }]}>
                    <Text style={styles.badgeText}>{pendingSyncCount}</Text>
                  </View>
                )}
              </View>
              {isTablet && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: isActive ? palette.textLight : palette.textMuted },
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
    // `alignSelf` + largeur pleine : la barre occupe la place disponible et
    // répartit les onglets, au lieu de grandir avec leur contenu.
    alignSelf: 'stretch',
    maxWidth: 480,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    gap: 4,
  },
  containerTablet: {
    maxWidth: 620,
    paddingHorizontal: 12,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  badgeDot: {
    position: 'absolute',
    top: -6,
    right: -8,
    // Compteur de collectes à envoyer : rouge sobre, comme les autres compteurs.
    // La teinte vient de la palette active (elle se désature en thème sombre).
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
