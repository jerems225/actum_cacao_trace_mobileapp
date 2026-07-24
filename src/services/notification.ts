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
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return false;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'CacaoTrace Notifications',
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
  ): Promise<AppNotification> {
    const notif: AppNotification = {
      id: generateId('notif'),
      type,
      title,
      body,
      timestamp: nowIso(),
      read: false,
    };
    await notificationRepository.add(notif);

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

  notifyCollecteEnregistree(parcelleNom: string) {
    return this.sendLocalNotification(
      'COLLECTE',
      'Collecte enregistrée 🌱',
      `Les données de la parcelle de ${parcelleNom} ont été enregistrées pour le suivi de production.`,
    );
  }

  notifySyncComplete(count: number) {
    return this.sendLocalNotification(
      'SYNC',
      'Synchronisation Réussie 🔄',
      `${count} enregistrement(s) terrain synchronisé(s) vers le serveur CacaoTrace.`,
    );
  }

  notifySanitaryAlert(village: string, maladie: string) {
    return this.sendLocalNotification(
      'SANITARY_ALERT',
      'Alerte sanitaire ⚠️',
      `Diagnostic ${maladie} signalé à ${village}. Consulter le protocole de traitement.`,
    );
  }

  getNotifications(): Promise<AppNotification[]> {
    return notificationRepository.findAll();
  }

  markAllAsRead(): Promise<void> {
    return notificationRepository.markAllRead();
  }

  getUnreadCount(): Promise<number> {
    return notificationRepository.unreadCount();
  }
}

export const notificationService = new NotificationService();
