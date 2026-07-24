// ============================================================================
// CacaoTrace — Repository Placette (accès données pur, SRP)
// ----------------------------------------------------------------------------
// La placette embarque ses sous-placettes et mesures (document imbriqué),
// ce qui reflète la façon dont l'inventaire terrain est saisi en un bloc.
// ============================================================================

import { getPersistence, Collections } from '../db';
import type { PlacetteLocal } from '../../types';

class PlacetteRepository {
  async findAll(): Promise<PlacetteLocal[]> {
    const p = await getPersistence();
    const items = await p.getAll<PlacetteLocal>(Collections.PLACETTES);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<PlacetteLocal | null> {
    const p = await getPersistence();
    return p.getById<PlacetteLocal>(Collections.PLACETTES, id);
  }

  async findByParcelle(parcelleId: string): Promise<PlacetteLocal | null> {
    return (await this.findAll()).find((plc) => plc.parcelleId === parcelleId) ?? null;
  }

  async save(placette: PlacetteLocal): Promise<PlacetteLocal> {
    const p = await getPersistence();
    return p.upsert(Collections.PLACETTES, placette);
  }

  async bulkSave(placettes: PlacetteLocal[]): Promise<void> {
    const p = await getPersistence();
    await p.bulkUpsert(Collections.PLACETTES, placettes);
  }
}

export const placetteRepository = new PlacetteRepository();
