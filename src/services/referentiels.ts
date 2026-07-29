// ============================================================================
// CacaoTrace — Référentiels mesures (espèces / maladies) avec cache hors-ligne
// ----------------------------------------------------------------------------
// Source : backend (paramétrable dashboard). Mis en cache localement pour la
// collecte hors-ligne, comme les délégations.
// ============================================================================

import { apiClient } from './apiClient';
import { getPersistence, StorageKeys } from './db';
import type { Espece, Maladie, TypeCadastre } from '../types';

class ReferentielsService {
  private especes: Espece[] | null = null;
  private maladies: Maladie[] | null = null;
  private typesCadastre: TypeCadastre[] | null = null;

  async getTypesCadastreCached(): Promise<TypeCadastre[]> {
    if (this.typesCadastre) return this.typesCadastre;
    const p = await getPersistence();
    this.typesCadastre = (await p.getKV<TypeCadastre[]>(StorageKeys.TYPES_CADASTRE)) ?? [];
    return this.typesCadastre;
  }

  async getEspecesCached(): Promise<Espece[]> {
    if (this.especes) return this.especes;
    const p = await getPersistence();
    this.especes = (await p.getKV<Espece[]>(StorageKeys.ESPECES)) ?? [];
    return this.especes;
  }

  async getMaladiesCached(): Promise<Maladie[]> {
    if (this.maladies) return this.maladies;
    const p = await getPersistence();
    this.maladies = (await p.getKV<Maladie[]>(StorageKeys.MALADIES)) ?? [];
    return this.maladies;
  }

  /** Re-synchronise espèces + maladies depuis le backend. Silencieux si hors-ligne. */
  async refresh(): Promise<{ especes: Espece[]; maladies: Maladie[] }> {
    const p = await getPersistence();
    try {
      const especes = await apiClient.getEspeces();
      this.especes = especes;
      await p.setKV(StorageKeys.ESPECES, especes);
    } catch {
      /* garde le cache */
    }
    try {
      const maladies = await apiClient.getMaladies();
      this.maladies = maladies;
      await p.setKV(StorageKeys.MALADIES, maladies);
    } catch {
      /* garde le cache */
    }
    try {
      const types = await apiClient.getTypesCadastre();
      this.typesCadastre = types;
      await p.setKV(StorageKeys.TYPES_CADASTRE, types);
    } catch {
      /* garde le cache */
    }
    return { especes: await this.getEspecesCached(), maladies: await this.getMaladiesCached() };
  }
}

export const referentielsService = new ReferentielsService();
