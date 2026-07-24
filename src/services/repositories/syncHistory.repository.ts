// ============================================================================
// CacaoTrace — Repository Historique de synchronisation (persisté)
// ============================================================================

import { getPersistence, Collections } from '../db';
import type { SyncHistoryEntry } from '../../types';
import { generateId, nowIso } from './ids';

const MAX_ENTRIES = 50;

class SyncHistoryRepository {
  async findAll(): Promise<SyncHistoryEntry[]> {
    const p = await getPersistence();
    const items = await p.getAll<SyncHistoryEntry>(Collections.SYNC_HISTORY);
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  async add(synced: number, failed: number): Promise<SyncHistoryEntry> {
    const p = await getPersistence();
    const status: SyncHistoryEntry['status'] =
      failed === 0 ? 'SUCCESS' : synced === 0 ? 'ERROR' : 'PARTIAL';
    const entry: SyncHistoryEntry = {
      id: generateId('hist'),
      date: nowIso(),
      synced,
      failed,
      status,
    };
    await p.upsert(Collections.SYNC_HISTORY, entry);

    // Purge des entrées les plus anciennes au-delà de la limite.
    const all = await this.findAll();
    if (all.length > MAX_ENTRIES) {
      for (const old of all.slice(MAX_ENTRIES)) {
        await p.remove(Collections.SYNC_HISTORY, old.id);
      }
    }
    return entry;
  }
}

export const syncHistoryRepository = new SyncHistoryRepository();
