import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNewAction?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  unreadCount?: number;
  userName?: string;
  userRole?: string;
  avatarUri?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'CacaoTrace',
  subtitle = 'Vous contrôlez la Traçabilité & l\'Inventaire',
  onNewAction,
  onNotificationPress,
  onProfilePress,
  unreadCount = 2,
  userName = 'Antoine Kouassi',
  userRole = "Chef d'équipe • San-Pédro",
  avatarUri,
}) => {
  const { paddingHorizontal, isTablet, topInset, contentMaxWidth, scale } = useResponsive();

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingHorizontal }]}>
      <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
        {/* Top Bar with Agent profile & Action buttons */}
        <View style={styles.topRow}>
          {/* En cliquant sur le nom ou la photo, ouvre la gestion du profil */}
          <TouchableOpacity
            style={styles.agentInfo}
            onPress={onProfilePress}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Image
                source={require('../../../assets/images/agent_avatar.png')}
                style={styles.avatarImage}
              />
            )}
            <View style={styles.agentTextWrap}>
              <Text style={styles.agentName} numberOfLines={1}>{userName}</Text>
              <Text style={styles.agentRole} numberOfLines={1}>{userRole}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.circlePlusBtn}
              onPress={onNewAction}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pillBellBtn}
              onPress={onNotificationPress}
              activeOpacity={0.8}
            >
              <Feather name="bell" size={18} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { fontSize: scale(isTablet ? 30 : 26) }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Text style={[styles.subtitle, { fontSize: scale(13.5) }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundLight,
    paddingBottom: 16,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  agentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentTextWrap: {
    flexShrink: 1,
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  agentName: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  agentRole: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circlePlusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pillBlack,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    elevation: 4,
  },
  pillBellBtn: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.warning,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  titleSection: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  titleTablet: {
    fontSize: 34,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
