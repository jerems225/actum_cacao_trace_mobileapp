// ============================================================================
// CacaoTrace — Écran de démarrage animé (GIF) + signature Actum Dev
// ----------------------------------------------------------------------------
// Le splash NATIF d'Expo (app.json) ne joue qu'une image statique. Cet écran
// React prend le relais dès le chargement du JS pour jouer l'animation GIF,
// puis se fond vers l'application. Le fond crème (#FAF7F0) correspond au splash
// natif et au GIF → transition sans couture. Le pied de page affiche le logo
// de l'éditeur (Actum Dev) et les informations de version.
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions } from 'react-native';
import appConfig from '../../../app.json';

const CREAM = '#FAF7F0';
const APP_VERSION = appConfig.expo?.version ?? '0.0.0';
const ACTUM_RATIO = 2471 / 525; // largeur/hauteur du logo Actum Dev

interface AnimatedSplashProps {
  /** Appelé une fois l'animation jouée et le fondu de sortie terminé. */
  onFinish: () => void;
  /** Durée minimale d'affichage avant le fondu de sortie (ms). */
  minVisibleMs?: number;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  onFinish,
  minVisibleMs = 2600,
}) => {
  const { width, height } = useWindowDimensions();
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const viewOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(viewOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, minVisibleMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = Math.min(width, height) * 0.82;
  const actumWidth = Math.min(width * 0.42, 170);
  const year = new Date().getFullYear();

  return (
    <Animated.View style={[styles.container, { opacity: viewOpacity }]}>
      <Animated.Image
        source={require('../../../assets/images/splash.gif')}
        style={{ width: size, height: size, opacity: imageOpacity }}
        resizeMode="contain"
      />

      <Animated.View style={[styles.footer, { opacity: imageOpacity }]}>
        <Text style={styles.poweredBy}>Propulsé par</Text>
        <Animated.Image
          source={require('../../../assets/images/actum-logo.png')}
          style={{ width: actumWidth, height: actumWidth / ACTUM_RATIO, marginTop: 6 }}
          resizeMode="contain"
        />
        <Text style={styles.version}>Version {APP_VERSION}</Text>
        <Text style={styles.copyright}>© {year} Actum Dev — Tous droits réservés</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  poweredBy: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#9B948A',
    textTransform: 'uppercase',
  },
  version: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5A5248',
  },
  copyright: {
    marginTop: 3,
    fontSize: 10.5,
    color: '#A79F94',
  },
});
