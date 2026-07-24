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
