// ============================================================================
// CacaoTrace — Service de notifications (locales + push)
// ----------------------------------------------------------------------------
// Historique persisté (repository) au lieu d'un tableau en mémoire, et
// enregistrement d'un jeton push Expo transmis au backend pour les
// notifications push serveur (alertes sanitaires, collecte enregistrée, sync).
// ============================================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import { sessionRepository } from './repositories/session.repository';
import {
  notificationRepository,
  type AppNotification,
  type NotificationType,
} from './repositories/notification.repository';
import { generateId, nowIso } from './repositories/ids';
import { preferencesService } from './preferences';

export type { AppNotification, NotificationType };

// Comportement en avant-plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  /** Demande les permissions, configure le canal Android et enregistre le push token. */
  async initPermissions(): Promise<boolean> {
    try {
      // Préférence de l'agent (écran Paramètres) : s'il a coupé les alertes, on
      // ne redemande pas la permission système à chaque ouverture.
      const prefs = await preferencesService.get();
      if (!prefs.notificationsActives) return false;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return false;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Actum Collect Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });
      }

      await this.registerPushToken();
      return true;
    } catch {
      return false;
    }
  }

  /** Récupère le jeton push Expo et le transmet au backend (idempotent). */
  async registerPushToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') return; // Pas de push natif sur web.
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      if (!token) return;

      const stored = await sessionRepository.getPushToken();
      if (stored === token) return; // Déjà enregistré.

      const deviceId = await sessionRepository.getDeviceId();
      const session = await sessionRepository.getSession();
      if (session?.token) {
        await apiClient.registerDevice(token, deviceId);
      }
      await sessionRepository.savePushToken(token);
    } catch {
      // getExpoPushTokenAsync échoue hors build EAS ou sans projectId : non bloquant.
    }
  }

  /** Crée une notification locale, la persiste et la programme sur l'appareil. */
  async sendLocalNotification(
    type: NotificationType,
    title: string,
    body: string,
    cible?: Pick<AppNotification, 'cibleOnglet' | 'cibleParcelleId'>,
  ): Promise<AppNotification> {
    const notif: AppNotification = {
      id: generateId('notif'),
      type,
      title,
      body,
      timestamp: nowIso(),
      read: false,
      ...cible,
    };
    await notificationRepository.add(notif);

    // L'historique est TOUJOURS écrit, même alertes coupées : couper les
    // notifications veut dire « ne m'interromps pas », pas « perds l'information ».
    // L'agent la retrouve dans la cloche de l'en-tête.
    const prefs = await preferencesService.get();
    if (!prefs.notificationsActives) return notif;

    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { type, id: notif.id } },
        trigger: null,
      });
    } catch {
      // Programmation impossible (permission/plateforme) : l'historique reste persisté.
    }
    return notif;
  }

  // --- Helpers métier ---

  /** `parcelleId` permet d'ouvrir directement la fiche depuis la notification. */
  notifyCollecteEnregistree(parcelleNom: string, parcelleId?: string) {
    return this.sendLocalNotification(
      'COLLECTE',
      'Collecte enregistrée',
      `La fiche de ${parcelleNom} est enregistrée sur votre appareil.`,
      { cibleOnglet: 'enquetes', cibleParcelleId: parcelleId },
    );
  }

  notifySyncComplete(count: number) {
    return this.sendLocalNotification(
      'SYNC',
      'Envoi terminé',
      `${count} collecte(s) envoyée(s) au serveur.`,
      { cibleOnglet: 'sync' },
    );
  }

  notifySanitaryAlert(village: string, maladie: string) {
    return this.sendLocalNotification(
      'SANITARY_ALERT',
      'Alerte sanitaire',
      `${maladie} signalée à ${village}. Consultez le protocole de traitement.`,
      { cibleOnglet: 'enquetes' },
    );
  }

  getNotifications(): Promise<AppNotification[]> {
    return notificationRepository.findAll();
  }

  markAsRead(id: string): Promise<void> {
    return notificationRepository.markRead(id);
  }

  markAllAsRead(): Promise<void> {
    return notificationRepository.markAllRead();
  }

  getUnreadCount(): Promise<number> {
    return notificationRepository.unreadCount();
  }
}

export const notificationService = new NotificationService();
