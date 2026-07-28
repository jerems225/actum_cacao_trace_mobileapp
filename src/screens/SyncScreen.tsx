import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { SkeletonList } from '../components/common/Skeleton';
import { colors, useResponsive } from '../theme';
import { offlineStorage } from '../services/storage';
import { ApiSyncService } from '../services/api';
import { notificationService } from '../services/notification';
import { toast } from '../components/common/Toast';
import { avatarAffichable, type UserProfile } from '../services/auth';
import type { ParcelleLocal, SyncHistoryEntry, TabType } from '../types';
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  /**
   * On raisonne en COLLECTES, pas en enregistrements techniques.
   * La file interne contient une ligne par entité (producteur, parcelle,
   * placette, sous-placette, chaque mesure…) : afficher « 47 enregistrements »
   * n'aide pas un agent qui a saisi trois fiches. On liste donc les collectes
   * dont l'envoi reste à faire, nommées par leur producteur.
   */
  const [collectesEnAttente, setCollectesEnAttente] = useState<ParcelleLocal[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [parcelles, history] = await Promise.all([
      offlineStorage.getParcelles(),
      offlineStorage.getSyncHistory(),
    ]);
    setCollectesEnAttente(parcelles.filter((p) => !p.synced));
    setSyncHistory(history);
    setLoading(false);
  };

  /** Libellés d'issue en français : SUCCESS / PARTIAL / ERROR ne parlent qu'aux développeurs. */
  const libelleIssue = (statut: SyncHistoryEntry['status']) =>
    statut === 'SUCCESS' ? 'Réussi' : statut === 'PARTIAL' ? 'Partiel' : 'Échec';

  const handleTriggerSync = async () => {
    const avant = collectesEnAttente.length;
    setIsSyncing(true);
    const result = await ApiSyncService.pushSyncQueue();
    setIsSyncing(false);

    // Décompte en COLLECTES, obtenu par différence : le gestionnaire de synchro
    // compte des enregistrements internes, chiffre exact mais sans sens pour
    // l'agent. Ici on mesure ce qu'il a réellement vu partir.
    const restant = (await offlineStorage.getParcelles()).filter((p) => !p.synced).length;
    const envoyees = Math.max(0, avant - restant);
    if (envoyees > 0) {
      await notificationService.notifySyncComplete(envoyees);
    }

    await loadData();
    toast.show(
      envoyees > 0
        ? `${envoyees} collecte${envoyees > 1 ? 's' : ''} envoyée${envoyees > 1 ? 's' : ''}.`
        : result.message,
      result.failedCount > 0 ? 'error' : 'success',
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Envoi des collectes"
        subtitle={
          collectesEnAttente.length > 0
            ? `${collectesEnAttente.length} collecte${collectesEnAttente.length > 1 ? 's' : ''} en attente d'envoi`
            : 'Toutes vos collectes sont envoyées'
        }
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={avatarAffichable(user)}
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
        {/* Bandeau d'état : ce que l'agent doit savoir, sans jargon */}
        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>Fonctionne sans réseau</Text>
            </View>
            {collectesEnAttente.length > 0 && (
              <Text style={styles.queueCount}>
                {collectesEnAttente.length} en attente
              </Text>
            )}
          </View>

          <Text style={styles.statusTitle}>
            {collectesEnAttente.length > 0
              ? `${collectesEnAttente.length} collecte${collectesEnAttente.length > 1 ? 's' : ''} enregistrée${collectesEnAttente.length > 1 ? 's' : ''} sur votre appareil, en attente d'envoi.`
              : 'Toutes vos collectes ont été envoyées.'}
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
                <Ionicons name="cloud-upload-outline" size={18} color={colors.textLight} />
                <Text style={styles.syncButtonText}>Envoyer maintenant</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Collectes en attente, nommées par leur producteur */}
        <Text style={styles.sectionTitle}>Collectes en attente d'envoi</Text>
        {loading ? (
          <SkeletonList count={3} />
        ) : collectesEnAttente.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.emeraldPrimary} />
            <Text style={styles.emptyTitle}>Rien à envoyer</Text>
            <Text style={styles.emptySub}>
              Vos collectes sont en sécurité sur le serveur.
            </Text>
          </View>
        ) : (
          collectesEnAttente.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.queueItem}
              onPress={onNavigate ? () => onNavigate('enquetes') : undefined}
              activeOpacity={0.8}
            >
              <View style={styles.queueIcon}>
                <Ionicons name="clipboard-outline" size={16} color={colors.emeraldPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.queueEntity}>
                  {p.producteurNom || 'Collecte sans producteur'}
                </Text>
                <Text style={styles.queueDate}>
                  Saisie le {p.createdAt.slice(8, 10)}/{p.createdAt.slice(5, 7)}/
                  {p.createdAt.slice(0, 4)}
                </Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>À envoyer</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Derniers envois */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Derniers envois</Text>
        {syncHistory.length === 0 ? (
          <Text style={styles.historyEmpty}>Aucun envoi pour le moment.</Text>
        ) : (
          syncHistory.map((h) => (
            <View key={h.id} style={styles.historyCard}>
              <Ionicons
                name={h.status === 'SUCCESS' ? 'checkmark-outline' : h.status === 'PARTIAL' ? 'alert-circle-outline' : 'close-outline'}
                size={16}
                color={h.status === 'ERROR' ? colors.error : colors.emeraldPrimary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyText}>
                  {h.synced} envoyé{h.synced > 1 ? 's' : ''}
                  {h.failed > 0 ? ` • ${h.failed} à reprendre` : ''}
                </Text>
                <Text style={styles.historyDate}>{h.date.replace('T', ' ').slice(0, 16)}</Text>
              </View>
              <Text style={[styles.successTag, h.status === 'ERROR' && { color: colors.error }]}>
                {libelleIssue(h.status)}
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
  // « À envoyer » est un état d'attente, pas un avertissement : ton neutre.
  pendingBadge: {
    backgroundColor: colors.draftBg,
    borderWidth: 1,
    borderColor: colors.draftBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingText: {
    color: colors.draftText,
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
