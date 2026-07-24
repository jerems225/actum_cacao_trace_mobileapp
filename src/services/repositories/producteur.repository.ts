// ============================================================================
// CacaoTrace — Repository Producteur (accès données pur, SRP)
// ============================================================================

import { getPersistence, Collections } from '../db';
import type { ProducteurLocal } from '../../types';

class ProducteurRepository {
  async findAll(): Promise<ProducteurLocal[]> {
    const p = await getPersistence();
    const items = await p.getAll<ProducteurLocal>(Collections.PRODUCTEURS);
    // Tri décroissant par date de création (le plus récent en premier).
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<ProducteurLocal | null> {
    const p = await getPersistence();
    return p.getById<ProducteurLocal>(Collections.PRODUCTEURS, id);
  }

  async save(producteur: ProducteurLocal): Promise<ProducteurLocal> {
    const p = await getPersistence();
    return p.upsert(Collections.PRODUCTEURS, producteur);
  }

  async bulkSave(producteurs: ProducteurLocal[]): Promise<void> {
    const p = await getPersistence();
    await p.bulkUpsert(Collections.PRODUCTEURS, producteurs);
  }

  async count(): Promise<number> {
    return (await this.findAll()).length;
  }
}

export const producteurRepository = new ProducteurRepository();
