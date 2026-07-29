import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive, useTheme } from '../../theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNewAction?: () => void;
  /**
   * Rôle du bouton rond, à droite du profil.
   *   'nouveau' — ouvre une fiche neuve (le « + » habituel) ;
   *   'fermer'  — referme la fiche en cours.
   *
   * Un formulaire ouvert n'a pas besoin d'un bouton qui en ouvre un autre :
   * au mieux il ne fait rien, au pire il fait perdre la saisie en cours. Le
   * même bouton change donc de rôle plutôt que d'en ajouter un second.
   */
  actionPrincipale?: 'nouveau' | 'fermer';
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  unreadCount?: number;
  userName?: string;
  userRole?: string;
  avatarUri?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'ActumCollect',
  subtitle = 'Vous contrôlez la Traçabilité & l\'Inventaire',
  onNewAction,
  actionPrincipale = 'nouveau',
  onNotificationPress,
  onProfilePress,
  unreadCount = 2,
  userName = 'Antoine Kouassi',
  userRole = "Chef d'équipe • San-Pédro",
  avatarUri,
}) => {
  const { paddingHorizontal, isTablet, isSmallPhone, topInset, contentMaxWidth, scale } =
    useResponsive();
  // Les couleurs viennent de la palette active : l'en-tête est l'une des trois
  // surfaces déjà migrées au thème (avec la barre d'onglets et les Paramètres).
  const { palette } = useTheme();

  // Le titre était calculé en scale(30) sur tablette, soit 39 px sur un large
  // écran : il écrasait tout le reste et le sous-titre suivait à 18 px. On borne
  // désormais la valeur haute et on dérive le sous-titre du titre, pour garder
  // un rapport de hiérarchie constant quelle que soit la largeur.
  const tailleTitre = Math.min(scale(isSmallPhone ? 20 : isTablet ? 25 : 22), 28);
  const tailleSousTitre = Math.round(tailleTitre * 0.54);
  const tailleLogo = Math.round(tailleTitre * 1.28);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topInset, paddingHorizontal, backgroundColor: palette.backgroundLight },
      ]}
    >
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
                source={require('../../../assets/images/agent_avatar.jpg')}
                style={styles.avatarImage}
              />
            )}
            <View style={styles.agentTextWrap}>
              <Text style={[styles.agentName, { color: palette.textPrimary }]} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={[styles.agentRole, { color: palette.textSecondary }]} numberOfLines={1}>
                {userRole}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.topActions}>
            <TouchableOpacity
              style={[styles.circlePlusBtn, { backgroundColor: palette.pillBlack }]}
              onPress={onNewAction}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                actionPrincipale === 'fermer' ? 'Fermer la fiche' : 'Nouvelle collecte'
              }
            >
              <Ionicons
                name={actionPrincipale === 'fermer' ? 'close-outline' : 'add-outline'}
                size={18}
                color={palette.textLight}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pillBellBtn,
                { backgroundColor: palette.backgroundCard, borderColor: palette.borderLight },
              ]}
              onPress={onNotificationPress}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={18} color={palette.textPrimary} />
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.badgeDot,
                    { backgroundColor: palette.error, borderColor: palette.backgroundLight },
                  ]}
                >
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloc titre : logo dimensionné d'après le titre, puis sous-titre aligné
            sur le titre (et non sur le logo) pour un bord gauche net. Le
            sous-titre est borné en largeur : au-delà d'une soixantaine de
            caractères par ligne, une phrase devient pénible à lire. */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={[
                styles.brandLogo,
                { width: tailleLogo, height: tailleLogo, borderRadius: Math.round(tailleLogo / 4) },
              ]}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.title,
                {
                  color: palette.textPrimary,
                  fontSize: tailleTitre,
                  lineHeight: Math.round(tailleTitre * 1.2),
                },
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
          </View>
          <Text
            style={[
              styles.subtitle,
              {
                color: palette.textSecondary,
                fontSize: tailleSousTitre,
                lineHeight: Math.round(tailleSousTitre * 1.45),
                marginLeft: tailleLogo + 10,
              },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Les couleurs de cette feuille sont fournies à l'usage depuis la palette
// active : seules la géométrie et la typographie sont figées ici.
const styles = StyleSheet.create({
  container: {
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
    fontWeight: '800',
    fontSize: 15,
  },
  agentRole: {
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    // Compteur de notifications en rouge sobre : c'est la convention, et l'ambre
    // vif d'origine se confondait avec les états « en cours ».
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  titleSection: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    // Dimensions fournies à l'usage, proportionnelles au titre.
  },
  title: {
    flexShrink: 1,
    fontWeight: '800',
    // Interlettrage discret : à -0,8 le titre se resserrait trop dès 30 px.
    letterSpacing: -0.3,
  },
  subtitle: {
    maxWidth: 460,
    fontWeight: '500',
  },
});
