// ============================================================================
// CacaoTrace — Repository Notifications (historique persisté)
// ============================================================================

import { getPersistence, Collections } from '../db';

export type NotificationType = 'COLLECTE' | 'SYNC' | 'SANITARY_ALERT' | 'REMINDER';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  /**
   * Destination à ouvrir quand l'agent touche la notification. Optionnelle : une
   * notification sans cible reste informative et se contente d'être marquée lue.
   * `parcelleId` désigne une fiche locale ; si elle a disparu entre-temps, on
   * ouvre simplement l'onglet sans faire échouer l'action.
   */
  cibleOnglet?: 'home' | 'enquetes' | 'collecte' | 'carte' | 'sync';
  cibleParcelleId?: string;
}

class NotificationRepository {
  async findAll(): Promise<AppNotification[]> {
    const p = await getPersistence();
    const items = await p.getAll<AppNotification>(Collections.NOTIFICATIONS);
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async add(notification: AppNotification): Promise<AppNotification> {
    const p = await getPersistence();
    return p.upsert(Collections.NOTIFICATIONS, notification);
  }

  /** Marque une seule notification comme lue (au toucher dans la liste). */
  async markRead(id: string): Promise<void> {
    const p = await getPersistence();
    const items = await p.getAll<AppNotification>(Collections.NOTIFICATIONS);
    const cible = items.find((n) => n.id === id);
    if (!cible || cible.read) return;
    await p.upsert(Collections.NOTIFICATIONS, { ...cible, read: true });
  }

  async markAllRead(): Promise<void> {
    const p = await getPersistence();
    const items = await p.getAll<AppNotification>(Collections.NOTIFICATIONS);
    await p.bulkUpsert(
      Collections.NOTIFICATIONS,
      items.map((n) => ({ ...n, read: true })),
    );
  }

  async unreadCount(): Promise<number> {
    return (await this.findAll()).filter((n) => !n.read).length;
  }
}

export const notificationRepository = new NotificationRepository();
