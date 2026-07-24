import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { SkeletonList } from '../components/common/Skeleton';
import { colors, useResponsive } from '../theme';
import { offlineStorage } from '../services/storage';
import { ApiSyncService } from '../services/api';
import { notificationService } from '../services/notification';
import { toast } from '../components/common/Toast';
import type { UserProfile } from '../services/auth';
import type { SyncQueueRecord, SyncHistoryEntry, TabType } from '../types';
import { formatRole } from '../types';

interface SyncScreenProps {
  onNavigate?: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const { paddingHorizontal, contentStyle } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<SyncQueueRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [q, history] = await Promise.all([
      offlineStorage.getSyncQueue(),
      offlineStorage.getSyncHistory(),
    ]);
    setQueue(q);
    setSyncHistory(history);
    setLoading(false);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const result = await ApiSyncService.pushSyncQueue();
    setIsSyncing(false);

    if (result.syncedCount > 0) {
      await notificationService.notifySyncComplete(result.syncedCount);
    }

    await loadData();
    toast.show(result.message, result.failedCount > 0 ? 'error' : 'success');
  };

  return (
    <View style={styles.container}>
      <Header
        title="File de Synchronisation"
        subtitle="Gestion du mode Offline-First et envoi backend"
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={user?.avatarUri}
        onNewAction={onNavigate ? () => onNavigate('collecte') : undefined}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner d'état de synchronisation */}
        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>Mode Offline-First Actif</Text>
            </View>
            <Text style={styles.queueCount}>{queue.length} en attente</Text>
          </View>

          <Text style={styles.statusTitle}>
            {queue.length > 0
              ? `${queue.length} enregistrement(s) à synchroniser avec le serveur API.`
              : 'Toutes vos données terrain sont synchronisées.'}
          </Text>

          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={handleTriggerSync}
            disabled={isSyncing}
            activeOpacity={0.85}
          >
            {isSyncing ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <>
                <Feather name="refresh-cw" size={18} color={colors.textLight} />
                <Text style={styles.syncButtonText}>Synchroniser le Batch Maintenant</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Liste des éléments en attente dans la queue local */}
        <Text style={styles.sectionTitle}>Éléments en Attente dans la Queue Local</Text>
        {loading ? (
          <SkeletonList count={3} />
        ) : queue.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="check-circle" size={32} color={colors.emeraldPrimary} />
            <Text style={styles.emptyTitle}>Queue de Synchronisation Vide</Text>
            <Text style={styles.emptySub}>
              Les parcelles, placettes et mesures capturées sont enregistrées en sécurité.
            </Text>
          </View>
        ) : (
          queue.map((item: SyncQueueRecord) => (
            <View key={item.id} style={styles.queueItem}>
              <View style={styles.queueIcon}>
                <Feather name="database" size={16} color={colors.emeraldPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.queueEntity}>{item.entity} — {item.action}</Text>
                <Text style={styles.queueDate}>{item.createdAt.slice(0, 16)}</Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>En attente</Text>
              </View>
            </View>
          ))
        )}

        {/* Historique des Syncs (persisté) */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Historique des Synchronisations</Text>
        {syncHistory.length === 0 ? (
          <Text style={styles.historyEmpty}>Aucune synchronisation enregistrée pour le moment.</Text>
        ) : (
          syncHistory.map((h) => (
            <View key={h.id} style={styles.historyCard}>
              <Feather
                name={h.status === 'SUCCESS' ? 'check' : h.status === 'PARTIAL' ? 'alert-circle' : 'x'}
                size={16}
                color={h.status === 'ERROR' ? colors.error : colors.emeraldPrimary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyText}>
                  {h.synced} synchronisé(s){h.failed > 0 ? ` • ${h.failed} en conflit` : ''}
                </Text>
                <Text style={styles.historyDate}>{h.date.replace('T', ' ').slice(0, 16)}</Text>
              </View>
              <Text style={[styles.successTag, h.status === 'ERROR' && { color: colors.error }]}>
                {h.status}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  statusCard: {
    backgroundColor: colors.forestCard,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(72, 196, 143, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.mintSoft,
  },
  statusBadgeText: {
    color: colors.mintSoft,
    fontWeight: '700',
    fontSize: 11,
  },
  queueCount: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 13,
  },
  statusTitle: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 20,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.emeraldPrimary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.mintBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueEntity: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  queueDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  historyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  successTag: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 10,
  },
  historyEmpty: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
