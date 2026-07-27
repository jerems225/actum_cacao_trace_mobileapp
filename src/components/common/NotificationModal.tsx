import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { AppNotification } from '../../services/notification';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  /**
   * Touche sur une notification : la marque lue et ouvre sa cible si elle en a
   * une. La navigation est décidée par l'appelant, qui seul connaît les onglets.
   */
  onNotificationSelect?: (notification: AppNotification) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationSelect,
}) => {
  const nonLues = notifications.filter((n) => !n.read).length;
  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'COLLECTE':
        return { name: 'check-circle' as const, color: colors.emeraldPrimary, bg: colors.mintBadge };
      case 'SYNC':
        return { name: 'refresh-cw' as const, color: '#0288D1', bg: '#E1F5FE' };
      case 'SANITARY_ALERT':
        return { name: 'alert-triangle' as const, color: colors.warning, bg: colors.warningBg };
      default:
        return { name: 'bell' as const, color: colors.textPrimary, bg: colors.backgroundLight };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="bell" size={20} color={colors.textPrimary} />
              <Text style={styles.title}>Centre de Notifications</Text>
            </View>

            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.topActionsRow}>
            <Text style={styles.countText}>
              {nonLues > 0
                ? `${nonLues} non lue${nonLues > 1 ? 's' : ''} sur ${notifications.length}`
                : `${notifications.length} notification${notifications.length > 1 ? 's' : ''}`}
            </Text>
            {nonLues > 0 && (
              <TouchableOpacity onPress={onMarkAllAsRead}>
                <Text style={styles.markReadText}>Tout marquer comme lu</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="check-circle" size={32} color={colors.emeraldPrimary} />
                <Text style={styles.emptyTitle}>Aucune Notification</Text>
                <Text style={styles.emptySub}>
                  Vous êtes au courant de toutes les activités terrain.
                </Text>
              </View>
            ) : (
              notifications.map((n) => {
                const iconInfo = getIcon(n.type);
                const ouvrable = !!n.cibleOnglet;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.notifCard, !n.read && styles.notifUnread]}
                    onPress={() => onNotificationSelect?.(n)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <View style={[styles.iconBox, { backgroundColor: iconInfo.bg }]}>
                      <Feather name={iconInfo.name} size={18} color={iconInfo.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitle}>{n.title}</Text>
                      <Text style={styles.notifBody}>{n.body}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(n.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.notifRight}>
                      {!n.read && <View style={styles.unreadDot} />}
                      {/* Chevron seulement si la notification mène quelque part :
                          promettre une navigation qui n'existe pas est pire que
                          de ne rien promettre. */}
                      {ouvrable && (
                        <Feather name="chevron-right" size={16} color={colors.textMuted} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  countText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldPrimary,
  },
  scrollList: {
    marginBottom: 16,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundLight,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  notifUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.emeraldPrimary,
    borderWidth: 1.5,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  notifBody: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 6,
  },
  notifRight: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emeraldPrimary,
  },
  closeBtn: {
    backgroundColor: colors.pillBlack,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
