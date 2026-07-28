import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import { AnimatedSplash } from './src/components/common/AnimatedSplash';
import { FloatingTabBar } from './src/components/common/FloatingTabBar';
import { ProfileModal } from './src/components/common/ProfileModal';
import { NotificationModal } from './src/components/common/NotificationModal';
import { ToastHost } from './src/components/common/Toast';
import { HomeScreen } from './src/screens/HomeScreen';
import { EnquetesScreen } from './src/screens/EnquetesScreen';
import { CollecteWizardScreen } from './src/screens/CollecteWizardScreen';
import { CarteScreen } from './src/screens/CarteScreen';
import { SyncScreen } from './src/screens/SyncScreen';
import { ParametresScreen } from './src/screens/ParametresScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { offlineStorage } from './src/services/storage';
import { delegationsService } from './src/services/delegations';
import { settingsService } from './src/services/settings';
import { referentielsService } from './src/services/referentiels';
import { authService, UserProfile } from './src/services/auth';
import { notificationService, AppNotification } from './src/services/notification';
import { toast } from './src/components/common/Toast';
import { ThemeProvider, useTheme } from './src/theme';
import type { TabType } from './src/types';

/**
 * `App` ne fait que fournir le thème ; tout le contenu vit dans `Application`.
 * Deux composants, parce qu'un consommateur de contexte ne peut pas être celui
 * qui le fournit : `useTheme()` appelé dans `App` renverrait la valeur par
 * défaut, pas celle du Provider.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Application />
    </ThemeProvider>
  );
}

function Application() {
  const { palette, estSombre } = useTheme();

  /**
   * Police des icônes, chargée explicitement. Expo Go embarque déjà les polices
   * de `@expo/vector-icons`, ce qui masque le problème en développement : dans un
   * APK autonome, rien ne les enregistre et chaque icône se rend en glyphe vide.
   * On attend donc le chargement avant d'afficher l'interface.
   * `erreurPolices` est traité comme « prêt » : mieux vaut une interface sans
   * icônes qu'un écran d'attente définitif si la police manque à l'appel.
   */
  const [policesPretes, erreurPolices] = useFonts(Feather.font);
  const policesResolues = policesPretes || !!erreurPolices;

  const [isReady, setIsReady] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  /**
   * Collecte en cours de reprise (identifiant local de la parcelle).
   * Non nul = le wizard s'ouvre prérempli et enverra une modification.
   */
  const [collecteEnEdition, setCollecteEnEdition] = useState<string | null>(null);
  /** Fiche à ouvrir dans « Enquêtes » à l'arrivée (depuis une notification). */
  const [parcelleAOuvrir, setParcelleAOuvrir] = useState<string | null>(null);

  /** Ouvre le wizard sur une collecte existante (reprise d'un brouillon). */
  const ouvrirCollecteEnEdition = (parcelleId: string) => {
    setCollecteEnEdition(parcelleId);
    setActiveTab('collecte');
  };

  /**
   * Changement d'onglet. Quitter « collecte » ou y revenir par la barre annule
   * la reprise : sans cela, un appui sur « + » rouvrirait le brouillon précédent
   * au lieu de démarrer une fiche neuve.
   */
  const changerOnglet = (tab: TabType) => {
    setCollecteEnEdition(null);
    setParcelleAOuvrir(null);
    setActiveTab(tab);
  };

  // Initialise la persistance locale (SQLite/Web) avant tout affichage.
  useEffect(() => {
    (async () => {
      await offlineStorage.init();
      await checkAuthStatus();
      setIsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isReady) checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const checkAuthStatus = async () => {
    const authenticated = await authService.isAuthenticated();
    setIsLoggedIn(authenticated);
    if (authenticated) {
      loadUserAndSync();
    }
  };

  const loadUserAndSync = async () => {
    // Rafraîchit le profil depuis la base pour un affichage cohérent avec la DB.
    const u = await authService.refreshProfile();
    setCurrentUser(u);
    const queue = await offlineStorage.getSyncQueue();
    setPendingSyncCount(queue.length);

    // Met en cache le référentiel délégations/villes + les réglages (flags admin)
    // pour un fonctionnement cohérent hors-ligne.
    void delegationsService.refresh();
    void settingsService.refresh();
    void referentielsService.refresh();

    await notificationService.initPermissions();
    const notifs = await notificationService.getNotifications();
    const count = await notificationService.getUnreadCount();
    setNotifications(notifs);
    setUnreadCount(count);
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    const notifs = await notificationService.getNotifications();
    setNotifications(notifs);
    setUnreadCount(0);
  };

  /**
   * Touche sur une notification : elle est marquée lue, puis on ouvre sa cible.
   * Si elle désigne une fiche qui n'existe plus en local, on ouvre malgré tout
   * l'onglet et on le dit — plutôt que de laisser l'appui sans effet visible.
   */
  const handleNotificationSelect = async (notification: AppNotification) => {
    await notificationService.markAsRead(notification.id);
    setNotifications(await notificationService.getNotifications());
    setUnreadCount(await notificationService.getUnreadCount());

    if (!notification.cibleOnglet) return; // Notification purement informative.
    setNotifModalVisible(false);

    if (notification.cibleParcelleId) {
      const existe = await offlineStorage.getCollecte(notification.cibleParcelleId);
      if (existe) {
        setParcelleAOuvrir(notification.cibleParcelleId);
      } else {
        toast.show("Cette fiche n'existe plus sur l'appareil.", 'error');
      }
    }
    setCollecteEnEdition(null);
    setActiveTab(notification.cibleOnglet);
  };

  const handleProfileUpdated = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  // Écran de démarrage animé (GIF) tant qu'il n'a pas fini de jouer.
  if (!splashFinished) {
    return (
      <>
        <StatusBar style={estSombre ? 'light' : 'dark'} />
        <AnimatedSplash onFinish={() => setSplashFinished(true)} />
      </>
    );
  }

  // Cas rare : animation finie mais initialisation (ou police) encore en cours.
  if (!isReady || !policesResolues) {
    return (
      <View style={[styles.container, styles.center, styles.splashFallback]}>
        <StatusBar style={estSombre ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={palette.emeraldPrimary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsLoggedIn(true);
          }}
        />
        <ToastHost />
      </>
    );
  }

  const screenProps = {
    onNavigate: changerOnglet,
    onProfilePress: () => setProfileModalVisible(true),
    onNotificationPress: () => setNotifModalVisible(true),
    unreadCount: unreadCount,
    user: currentUser,
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen {...screenProps} />;
      case 'enquetes':
        return (
          <EnquetesScreen
            {...screenProps}
            onEditCollecte={ouvrirCollecteEnEdition}
            ouvrirParcelleId={parcelleAOuvrir}
            onParcelleOuverte={() => setParcelleAOuvrir(null)}
          />
        );
      case 'collecte':
        return (
          <CollecteWizardScreen
            {...screenProps}
            // La clé force un remontage à chaque changement de cible : sans elle,
            // les états du wizard survivraient d'une fiche à l'autre.
            key={collecteEnEdition ?? 'nouvelle'}
            editParcelleId={collecteEnEdition}
            onEditDone={() => setCollecteEnEdition(null)}
          />
        );
      case 'carte':
        return <CarteScreen {...screenProps} />;
      case 'sync':
        return <SyncScreen {...screenProps} />;
      case 'parametres':
        return (
          <ParametresScreen
            {...screenProps}
            onProfileUpdated={handleProfileUpdated}
            onLogout={handleLogout}
          />
        );
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.backgroundLight }]}>
      <StatusBar style={estSombre ? 'light' : 'dark'} />
      {renderActiveScreen()}
      <FloatingTabBar
        activeTab={activeTab}
        onTabChange={changerOnglet}
        pendingSyncCount={pendingSyncCount}
      />
      <ProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onProfileUpdated={handleProfileUpdated}
        onLogout={handleLogout}
      />
      <NotificationModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllRead}
        onNotificationSelect={handleNotificationSelect}
      />
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Le fond est fourni à l'usage depuis la palette active (thème clair/sombre).
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashFallback: {
    backgroundColor: '#FAF7F0',
  },
});
