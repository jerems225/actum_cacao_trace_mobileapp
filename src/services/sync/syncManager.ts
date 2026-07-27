// ============================================================================
// CacaoTrace — Gestionnaire de synchronisation offline-first
// ----------------------------------------------------------------------------
// Corrige les défauts historiques :
//   • la file n'est plus vidée aveuglément : chaque enregistrement est traité
//     selon le statut renvoyé par le backend (SYNCED → retiré, CONFLICT → ERROR
//     conservé avec compteur de tentatives) ;
//   • push ordonné par dépendances avec remappage des clés étrangères
//     (id local → serverId) : une parcelle créée hors-ligne se rattache bien à
//     son producteur une fois celui-ci synchronisé ;
//   • détection de joignabilité du backend avant tout envoi.
// ============================================================================

import { apiClient, type SyncPushRecord, type SyncPushResult } from '../apiClient';
import { isBackendReachable } from '../http';
import { syncQueueRepository } from '../repositories/syncQueue.repository';
import { syncHistoryRepository } from '../repositories/syncHistory.repository';
import { producteurRepository } from '../repositories/producteur.repository';
import { parcelleRepository } from '../repositories/parcelle.repository';
import { placetteRepository } from '../repositories/placette.repository';
import { sessionRepository } from '../repositories/session.repository';
import { offlineStorage } from '../storage';
import { nowIso } from '../repositories/ids';
import type { SyncEntity, SyncQueueRecord } from '../../types';

/** Champs "clé étrangère" à remapper (id local → serverId) par entité. */
const FK_FIELDS: Record<string, string[]> = {
  Parcelle: ['producteurId'],
  Placette: ['parcelleId'],
  SousPlacette: ['placetteId'],
  MesureArbre: ['sousPlacetteId'],
  Photo: ['parcelleId', 'sousPlacetteId'],
};

export interface SyncOutcome {
  reachable: boolean;
  synced: number;
  failed: number;
  message: string;
}

class SyncManager {
  private running = false;

  /**
   * Pousse la file d'attente vers le backend. Sûr à appeler plusieurs fois :
   * un seul cycle s'exécute à la fois (garde de ré-entrance).
   */
  async push(): Promise<SyncOutcome> {
    if (this.running) {
      return { reachable: true, synced: 0, failed: 0, message: 'Synchronisation déjà en cours.' };
    }
    this.running = true;
    try {
      return await this.doPush();
    } finally {
      this.running = false;
    }
  }

  private async doPush(): Promise<SyncOutcome> {
    const pending = await syncQueueRepository.findPending();
    if (pending.length === 0) {
      return { reachable: true, synced: 0, failed: 0, message: 'Toutes les données sont déjà synchronisées.' };
    }

    if (!(await isBackendReachable())) {
      return {
        reachable: false,
        synced: 0,
        failed: 0,
        message: `Mode hors-ligne : ${pending.length} enregistrement(s) conservé(s) localement.`,
      };
    }

    const deviceId = await sessionRepository.getDeviceId();
    const idMap = await this.buildServerIdMap();
    const pendingLocalIds = new Set(pending.filter((r) => r.action === 'CREATE').map((r) => r.clientId));

    let totalSynced = 0;
    let totalFailed = 0;
    let remaining = [...pending];

    // Traitement par vagues : à chaque tour on n'envoie que les enregistrements
    // dont les dépendances (FK) sont résolues, jusqu'à ne plus progresser.
    while (remaining.length > 0) {
      const sendable = remaining.filter((r) => this.isSendable(r, idMap, pendingLocalIds));
      if (sendable.length === 0) break; // Plus aucun progrès possible ce cycle.

      const records: SyncPushRecord[] = sendable.map((r) => ({
        clientId: r.clientId,
        entity: r.entity,
        action: r.action,
        payload: this.remapForeignKeys(r, idMap),
        clientUpdatedAt: r.createdAt,
      }));

      let results: SyncPushResult[];
      try {
        results = await apiClient.pushSync({ deviceId, lastSyncAt: nowIso(), records });
      } catch (e) {
        // Échec réseau en cours de cycle : on conserve la file telle quelle.
        const message = e instanceof Error ? e.message : 'Erreur réseau';
        for (const r of sendable) await syncQueueRepository.markStatus(r.id, 'ERROR', message);
        totalFailed += sendable.length;
        break;
      }

      const resultByClientId = new Map(results.map((res) => [res.clientId, res] as const));

      for (const record of sendable) {
        const res = resultByClientId.get(record.clientId);
        if (res && res.status === 'SYNCED') {
          if (res.serverId) idMap.set(record.clientId, res.serverId);
          pendingLocalIds.delete(record.clientId);
          await offlineStorage.markSynced(record.entity as SyncEntity, record.clientId, res.serverId);
          // Numéro de placette autoritatif renvoyé par le serveur → remplace l'aperçu.
          if (record.entity === 'Placette' && typeof res.fields?.numeroPlacette === 'string') {
            await offlineStorage.setPlacetteNumero(record.clientId, res.fields.numeroPlacette);
          }
          await syncQueueRepository.remove(record.id);
          totalSynced += 1;
        } else {
          await syncQueueRepository.markStatus(record.id, 'ERROR', res?.reason || 'Conflit de synchronisation');
          totalFailed += 1;
        }
      }

      // On retire de la boucle tout ce qui a été traité (succès ou conflit).
      // Les enregistrements différés (dépendances non encore résolues) restent
      // dans `remaining` et deviennent envoyables dans une vague ultérieure,
      // une fois leurs serverId parents connus.
      const treatedIds = new Set(sendable.map((r) => r.id));
      remaining = remaining.filter((r) => !treatedIds.has(r.id));
    }

    await syncHistoryRepository.add(totalSynced, totalFailed);

    return {
      reachable: true,
      synced: totalSynced,
      failed: totalFailed,
      message: this.buildMessage(totalSynced, totalFailed),
    };
  }

  /** Récupère les mises à jour serveur depuis la dernière synchronisation (pull). */
  async pull(): Promise<{ reachable: boolean; message: string }> {
    if (!(await isBackendReachable())) {
      return { reachable: false, message: 'Backend injoignable : pull ignoré.' };
    }
    try {
      const deviceId = await sessionRepository.getDeviceId();
      const since = (await sessionRepository.getPushToken()) ? nowIso() : new Date(0).toISOString();
      await apiClient.pullSync(since, deviceId);
      // La réconciliation fine du cache local pourra être branchée ici selon
      // les besoins (les entités serveur sont déjà validées côté backend).
      return { reachable: true, message: 'Données serveur récupérées.' };
    } catch (e) {
      return { reachable: false, message: e instanceof Error ? e.message : 'Échec du pull.' };
    }
  }

  // --- Helpers ---

  /** Un enregistrement est envoyable si toutes ses FK locales sont résolues. */
  private isSendable(
    record: SyncQueueRecord,
    idMap: Map<string, string>,
    pendingLocalIds: Set<string>,
  ): boolean {
    if (record.status === 'ERROR') return false; // Conflit déjà tranché ce cycle.
    if (record.action === 'UPDATE') {
      // UPDATE nécessite un serverId (dans le payload ou résolu via le map).
      const serverId = (record.payload.serverId as string) || idMap.get(record.clientId);
      if (!serverId) return false;
    }
    const fkFields = FK_FIELDS[record.entity] || [];
    for (const field of fkFields) {
      const value = record.payload[field] as string | undefined;
      if (!value) continue;
      // Dépendance locale pas encore synchronisée → on diffère.
      if (pendingLocalIds.has(value) && !idMap.has(value)) return false;
    }
    return true;
  }

  /** Remplace les FK locales par les serverId connus, et injecte serverId pour les UPDATE. */
  private remapForeignKeys(record: SyncQueueRecord, idMap: Map<string, string>): Record<string, unknown> {
    const payload = { ...record.payload };
    const fkFields = FK_FIELDS[record.entity] || [];
    for (const field of fkFields) {
      const value = payload[field] as string | undefined;
      if (value && idMap.has(value)) payload[field] = idMap.get(value);
    }
    if (record.action === 'UPDATE' && !payload.serverId) {
      const serverId = idMap.get(record.clientId);
      if (serverId) payload.serverId = serverId;
    }
    return payload;
  }

  /** Construit la table id local → serverId à partir des entités déjà synchronisées. */
  private async buildServerIdMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const [producteurs, parcelles, placettes] = await Promise.all([
      producteurRepository.findAll(),
      parcelleRepository.findAll(),
      placetteRepository.findAll(),
    ]);
    for (const p of [...producteurs, ...parcelles, ...placettes]) {
      if (p.serverId) map.set(p.id, p.serverId);
    }
    return map;
  }

  private buildMessage(synced: number, failed: number): string {
    if (synced === 0 && failed === 0) return 'Aucune donnée à synchroniser.';
    if (failed === 0) return `${synced} enregistrement(s) synchronisé(s) avec succès.`;
    if (synced === 0) return `Échec : ${failed} enregistrement(s) en conflit. Réessayez plus tard.`;
    return `${synced} synchronisé(s), ${failed} en conflit (conservés localement).`;
  }
}

export const syncManager = new SyncManager();
