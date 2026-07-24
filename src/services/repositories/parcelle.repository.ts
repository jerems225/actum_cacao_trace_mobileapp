// ============================================================================
// CacaoTrace — Repository Parcelle (accès données pur, SRP)
// ============================================================================

import { getPersistence, Collections } from '../db';
import type { ParcelleLocal } from '../../types';

class ParcelleRepository {
  async findAll(): Promise<ParcelleLocal[]> {
    const p = await getPersistence();
    const items = await p.getAll<ParcelleLocal>(Collections.PARCELLES);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<ParcelleLocal | null> {
    const p = await getPersistence();
    return p.getById<ParcelleLocal>(Collections.PARCELLES, id);
  }

  async findByProducteur(producteurId: string): Promise<ParcelleLocal[]> {
    return (await this.findAll()).filter((parc) => parc.producteurId === producteurId);
  }

  async save(parcelle: ParcelleLocal): Promise<ParcelleLocal> {
    const p = await getPersistence();
    return p.upsert(Collections.PARCELLES, parcelle);
  }

  async bulkSave(parcelles: ParcelleLocal[]): Promise<void> {
    const p = await getPersistence();
    await p.bulkUpsert(Collections.PARCELLES, parcelles);
  }
}

export const parcelleRepository = new ParcelleRepository();
