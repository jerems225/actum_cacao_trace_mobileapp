import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
import { LoginScreen } from './src/screens/LoginScreen';
import { offlineStorage } from './src/services/storage';
import { delegationsService } from './src/services/delegations';
import { settingsService } from './src/services/settings';
import { referentielsService } from './src/services/referentiels';
import { authService, UserProfile } from './src/services/auth';
import { notificationService, AppNotification } from './src/services/notification';
import { colors } from './src/theme';
import type { TabType } from './src/types';

export default function App() {
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
        <StatusBar style="dark" />
        <AnimatedSplash onFinish={() => setSplashFinished(true)} />
      </>
    );
  }

  // Cas rare : animation finie mais initialisation encore en cours.
  if (!isReady) {
    return (
      <View style={[styles.container, styles.center, styles.splashFallback]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.emeraldPrimary} />
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
    onNavigate: setActiveTab,
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
        return <EnquetesScreen {...screenProps} />;
      case 'collecte':
        return <CollecteWizardScreen {...screenProps} />;
      case 'carte':
        return <CarteScreen {...screenProps} />;
      case 'sync':
        return <SyncScreen {...screenProps} />;
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {renderActiveScreen()}
      <FloatingTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
      />
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashFallback: {
    backgroundColor: '#FAF7F0',
  },
});
