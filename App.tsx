import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { confirmer, ConfirmationHost } from './src/components/common/Confirmation';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
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
   * Police des icônes — SECONDE ligne de défense.
   *
   * La première est le plugin `expo-font` d'app.json, qui embarque le fichier
   * Ionicons.ttf dans les ressources natives de l'APK et l'enregistre au
   * démarrage. C'est la voie fiable pour un build autonome : elle ne dépend ni
   * du chargement d'un asset à l'exécution, ni du réseau, ni du cache.
   *
   * Ce `useFonts` reste utile en développement et sur le web, où le plugin
   * natif n'intervient pas. Quand la police est déjà enregistrée nativement,
   * il se contente de le constater.
   *
   * L'échec est traité comme « prêt » — mieux vaut une interface sans icônes
   * qu'un écran d'attente définitif —, mais il est désormais SIGNALÉ. La
   * dernière fois, cet échec silencieux a produit une application entièrement
   * dépourvue d'icônes sans que rien, nulle part, ne l'indique.
   */
  const [policesPretes, erreurPolices] = useFonts(Ionicons.font);
  const policesResolues = policesPretes || !!erreurPolices;

  useEffect(() => {
    if (!erreurPolices) return;
    console.warn(
      '[Polices] Chargement de la police Ionicons échoué :',
      erreurPolices,
      '— les icônes s’afficheront vides si elle n’est pas embarquée nativement ' +
        '(voir le plugin expo-font dans app.json).',
    );
    toast.error("Les icônes n'ont pas pu être chargées. Signalez-le à l'administration.");
  }, [erreurPolices]);

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
  /** Vrai quand le wizard porte une saisie commencée (voir `changerOnglet`). */
  const [saisieCollecteEnCours, setSaisieCollecteEnCours] = useState(false);

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
  const changerOnglet = async (tab: TabType) => {
    const quitterLaSaisie = activeTab === 'collecte' && tab !== 'collecte' && saisieCollecteEnCours;

    if (quitterLaSaisie) {
      // La saisie est déjà conservée en brouillon par le wizard : on ne prévient
      // donc pas d'une perte, on indique où reprendre. Confirmer n'efface rien.
      const ok = await confirmer({
        titre: 'Quitter la saisie ?',
        message:
          'Votre fiche est conservée en brouillon. Vous la retrouverez dans « Collectes » pour la compléter.',
        libelleConfirmer: 'Quitter',
        libelleAnnuler: 'Rester ici',
        destructif: true,
      });
      if (!ok) return;
      setSaisieCollecteEnCours(false);
    }

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
        <ConfirmationHost />
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
            onEditDone={() => {
              setCollecteEnEdition(null);
              // La fiche est close : plus rien à confirmer au prochain onglet.
              setSaisieCollecteEnCours(false);
            }}
            onSaisieEnCoursChange={setSaisieCollecteEnCours}
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
      {/* Monté en dernier, donc au-dessus de tout : une confirmation qui
          apparaîtrait derrière une autre surface serait invisible, et l'agent
          attendrait une réponse à une question qu'il ne voit pas. */}
      <ConfirmationHost />
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
