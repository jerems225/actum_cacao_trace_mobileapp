// ============================================================================
// CacaoTrace — Repository File de synchronisation
// ----------------------------------------------------------------------------
// Gère le cycle de vie des enregistrements en attente : PENDING → SYNCING →
// SYNCED (retiré) | ERROR (conservé avec compteur de tentatives). Corrige le
// défaut historique où la file était vidée même en cas d'échec réseau.
// ============================================================================

import { getPersistence, Collections } from '../db';
import type { SyncAction, SyncEntity, SyncQueueRecord, SyncStatus } from '../../types';
import { generateId, nowIso } from './ids';

class SyncQueueRepository {
  async findAll(): Promise<SyncQueueRecord[]> {
    const p = await getPersistence();
    const items = await p.getAll<SyncQueueRecord>(Collections.SYNC_QUEUE);
    // Ordre FIFO : les plus anciens d'abord (respect des dépendances métier).
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Éléments à (re)tenter : jamais synchronisés ou en erreur. */
  async findPending(): Promise<SyncQueueRecord[]> {
    return (await this.findAll()).filter((r) => r.status !== 'SYNCED');
  }

  async enqueue(
    entity: SyncEntity,
    action: SyncAction,
    clientId: string,
    payload: Record<string, unknown>,
  ): Promise<SyncQueueRecord> {
    const p = await getPersistence();
    const record: SyncQueueRecord = {
      id: generateId('sync'),
      clientId,
      entity,
      action,
      payload,
      status: 'PENDING',
      createdAt: nowIso(),
      attempts: 0,
    };
    return p.upsert(Collections.SYNC_QUEUE, record);
  }

  async update(record: SyncQueueRecord): Promise<void> {
    const p = await getPersistence();
    await p.upsert(Collections.SYNC_QUEUE, record);
  }

  async markStatus(id: string, status: SyncStatus, error?: string): Promise<void> {
    const p = await getPersistence();
    const record = await p.getById<SyncQueueRecord>(Collections.SYNC_QUEUE, id);
    if (!record) return;
    record.status = status;
    if (status === 'ERROR') {
      record.attempts += 1;
      record.lastError = error;
    }
    await p.upsert(Collections.SYNC_QUEUE, record);
  }

  async remove(id: string): Promise<void> {
    const p = await getPersistence();
    await p.remove(Collections.SYNC_QUEUE, id);
  }

  async count(): Promise<number> {
    return (await this.findPending()).length;
  }
}

export const syncQueueRepository = new SyncQueueRepository();
