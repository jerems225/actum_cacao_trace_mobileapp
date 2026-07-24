import { useMemo } from 'react';
import { useWindowDimensions, Platform, StatusBar, type ViewStyle } from 'react-native';

// ============================================================================
// CacaoTrace — Système responsive (téléphone / tablette, portrait / paysage)
// ----------------------------------------------------------------------------
// Fournit : détection de classe d'appareil (basée sur le CÔTÉ COURT, robuste à
// la rotation), échelle typographique clampée, safe-area haute sans dépendance
// externe, largeur de contenu maximale (centrée sur grand écran), colonnes
// adaptatives et un style de contenu prêt à l'emploi pour les ScrollView.
// ============================================================================

const BASE_WIDTH = 375; // Référence iPhone (largeur logique)

// Points de rupture sur le côté court (indépendants de l'orientation).
const TABLET_MIN = 600;
const LARGE_TABLET_MIN = 840;
const SMALL_PHONE_MAX = 340;

export interface Responsive {
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isPhone: boolean;
  isSmallPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  /** Mise à l'échelle modérée et clampée (typo, icônes, espacements). */
  scale: (size: number) => number;
  paddingHorizontal: number;
  /** Largeur maximale de contenu (centrée) pour la lisibilité sur grand écran. */
  contentMaxWidth: number;
  /** Marge haute sûre (encoche / barre d'état) sans dépendance safe-area. */
  topInset: number;
  metricColumns: number;
  formColumns: number;
  cardColumns: number;
  cardBorderRadius: number;
  /** Décalage bas pour la barre d'onglets flottante. */
  tabBarBottomInset: number;
  /** Style à fusionner dans `contentContainerStyle` d'une ScrollView. */
  contentStyle: ViewStyle;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const shortest = Math.min(width, height);

    const isTablet = shortest >= TABLET_MIN;
    const isLargeTablet = shortest >= LARGE_TABLET_MIN;
    const isSmallPhone = shortest <= SMALL_PHONE_MAX;
    const isPhone = !isTablet;

    // Échelle modérée : suit la largeur mais reste bornée pour éviter les
    // extrêmes (texte minuscule sur petit écran, géant sur tablette).
    const ratio = width / BASE_WIDTH;
    const min = isSmallPhone ? 0.88 : 0.95;
    const max = isTablet ? 1.3 : 1.12;
    const factor = Math.max(min, Math.min(ratio, max));
    const scale = (size: number) => Math.round(size * factor);

    // Marge haute sûre : StatusBar sur Android, valeurs usuelles sur iOS.
    const topInset =
      Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 24) + 8
        : isTablet
          ? 28
          : 48;

    const paddingHorizontal = isLargeTablet ? 40 : isTablet ? 32 : isSmallPhone ? 14 : 18;
    const contentMaxWidth = isLargeTablet ? 960 : isTablet ? 720 : 560;

    const contentStyle: ViewStyle = {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    };

    return {
      width,
      height,
      isPortrait: !isLandscape,
      isLandscape,
      isPhone,
      isSmallPhone,
      isTablet,
      isLargeTablet,
      scale,
      paddingHorizontal,
      contentMaxWidth,
      topInset,
      metricColumns: isLargeTablet ? 4 : isTablet ? 3 : 2,
      formColumns: isTablet ? 2 : 1,
      cardColumns: isLargeTablet ? 3 : isTablet ? 2 : 1,
      cardBorderRadius: isTablet ? 24 : 18,
      tabBarBottomInset: isTablet ? 32 : 24,
      contentStyle,
    };
  }, [width, height]);
}
