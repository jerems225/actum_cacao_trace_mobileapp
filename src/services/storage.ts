// ============================================================================
// CacaoTrace — Façade de stockage offline-first
// ----------------------------------------------------------------------------
// Orchestre les repositories (persistance réelle SQLite/Web) et la mise en
// file de synchronisation. Les écrans ne connaissent que cette façade ; ils
// ignorent SQLite, la file de sync et le mapping local ↔ serveur.
//
// Remplace l'ancien service en mémoire : les données survivent désormais au
// redémarrage de l'application (correction du défaut de persistance).
// ============================================================================

import { getPersistence } from './db';
import { producteurRepository } from './repositories/producteur.repository';
import { parcelleRepository } from './repositories/parcelle.repository';
import { placetteRepository } from './repositories/placette.repository';
import { syncQueueRepository } from './repositories/syncQueue.repository';
import { syncHistoryRepository } from './repositories/syncHistory.repository';
import { generateId, nowIso } from './repositories/ids';
import { EtatSanitaire } from '../types';
import type {
  ProducteurLocal,
  ParcelleLocal,
  PlacetteLocal,
  SousPlacetteLocal,
  MesureArbreLocal,
  SyncEntity,
  SyncQueueRecord,
  SyncHistoryEntry,
} from '../types';

type NewProducteur = Omit<ProducteurLocal, 'id' | 'synced' | 'createdAt' | 'updatedAt' | 'serverId'>;
type NewParcelle = Omit<ParcelleLocal, 'id' | 'synced' | 'createdAt' | 'updatedAt' | 'serverId'>;
type NewPlacette = Omit<PlacetteLocal, 'id' | 'synced' | 'createdAt' | 'updatedAt' | 'serverId'>;

class OfflineStorageService {
  private initialized = false;

  /** Initialise la persistance locale (données réelles uniquement, pas de jeu de démo). */
  async init(): Promise<void> {
    if (this.initialized) return;
    await getPersistence();
    this.initialized = true;
  }

  // ==========================================================================
  // Lectures (déléguées aux repositories)
  // ==========================================================================

  getProducteurs(): Promise<ProducteurLocal[]> {
    return producteurRepository.findAll();
  }

  getParcelles(): Promise<ParcelleLocal[]> {
    return parcelleRepository.findAll();
  }

  getPlacettes(): Promise<PlacetteLocal[]> {
    return placetteRepository.findAll();
  }

  getSyncQueue(): Promise<SyncQueueRecord[]> {
    return syncQueueRepository.findPending();
  }

  getSyncHistory(): Promise<SyncHistoryEntry[]> {
    return syncHistoryRepository.findAll();
  }

  // ==========================================================================
  // Créations (persistance locale + mise en file de synchronisation)
  // ==========================================================================

  async saveProducteur(data: NewProducteur): Promise<ProducteurLocal> {
    const producteur: ProducteurLocal = {
      ...data,
      id: generateId('prod'),
      synced: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await producteurRepository.save(producteur);
    await this.enqueue('Producteur', 'CREATE', producteur.id, this.producteurPayload(producteur));
    return producteur;
  }

  async saveParcelle(data: NewParcelle): Promise<ParcelleLocal> {
    const parcelle: ParcelleLocal = {
      ...data,
      id: generateId('parc'),
      synced: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await parcelleRepository.save(parcelle);
    await this.enqueue('Parcelle', 'CREATE', parcelle.id, this.parcellePayload(parcelle));
    return parcelle;
  }

  async savePlacette(data: NewPlacette): Promise<PlacetteLocal> {
    const placetteId = generateId('plc');

    // Réattribution cohérente des identifiants imbriqués : chaque sous-placette
    // pointe vers la placette, chaque mesure vers sa sous-placette. Indispensable
    // pour que le SyncManager remappe correctement les clés étrangères.
    const sousPlacettes: SousPlacetteLocal[] = (data.sousPlacettes || []).map((sp) => {
      const sousPlacetteId = generateId('sp');
      const mesures: MesureArbreLocal[] = (sp.mesures || []).map((m) => ({
        ...m,
        id: generateId('mes'),
        sousPlacetteId,
        createdAt: m.createdAt || nowIso(),
      }));
      return { ...sp, id: sousPlacetteId, placetteId, mesures };
    });

    const placette: PlacetteLocal = {
      ...data,
      sousPlacettes,
      id: placetteId,
      synced: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await placetteRepository.save(placette);
    await this.enqueuePlacetteTree(placette);
    return placette;
  }

  /** Applique le numéro de placette définitif renvoyé par le serveur (post-synchro). */
  async setPlacetteNumero(localId: string, numero: string): Promise<void> {
    const placette = await placetteRepository.findById(localId);
    if (!placette || placette.numeroPlacette === numero) return;
    await placetteRepository.save({ ...placette, numeroPlacette: numero, updatedAt: nowIso() });
  }

  /**
   * Enregistre une collecte complète (Blocs A→D) en une opération cohérente :
   * producteur, parcelle, placette + sous-placettes + mesures. Chaque entité
   * est persistée localement puis mise en file de synchronisation dans l'ordre
   * de dépendance (le SyncManager remappera les clés étrangères).
   */
  async saveCompleteCollecte(input: {
    producteur: NewProducteur;
    parcelle: Omit<NewParcelle, 'producteurId'>;
    placette: Omit<NewPlacette, 'parcelleId'>;
  }): Promise<{ producteur: ProducteurLocal; parcelle: ParcelleLocal; placette: PlacetteLocal }> {
    const producteur = await this.saveProducteur(input.producteur);
    const parcelle = await this.saveParcelle({
      ...input.parcelle,
      producteurId: producteur.id,
      producteurNom: `${producteur.prenoms} ${producteur.nom}`,
    });
    const placette = await this.savePlacette({
      ...input.placette,
      parcelleId: parcelle.id,
    });
    return { producteur, parcelle, placette };
  }

  // ==========================================================================
  // Modifications (persistance locale + file de synchronisation UPDATE)
  // ==========================================================================

  async updateProducteur(id: string, patch: Partial<NewProducteur>): Promise<ProducteurLocal | null> {
    const existing = await producteurRepository.findById(id);
    if (!existing) return null;
    const updated: ProducteurLocal = {
      ...existing,
      ...patch,
      synced: false,
      updatedAt: nowIso(),
    };
    await producteurRepository.save(updated);
    await this.enqueue('Producteur', 'UPDATE', updated.id, {
      ...this.producteurPayload(updated),
      serverId: updated.serverId,
    });
    return updated;
  }

  async updateParcelle(id: string, patch: Partial<NewParcelle>): Promise<ParcelleLocal | null> {
    const existing = await parcelleRepository.findById(id);
    if (!existing) return null;
    const updated: ParcelleLocal = {
      ...existing,
      ...patch,
      synced: false,
      updatedAt: nowIso(),
    };
    await parcelleRepository.save(updated);
    await this.enqueue('Parcelle', 'UPDATE', updated.id, {
      ...this.parcellePayload(updated),
      serverId: updated.serverId,
    });
    return updated;
  }

  // ==========================================================================
  // Support SyncManager : marquage synchronisé + statistiques
  // ==========================================================================

  /** Applique le serverId renvoyé par le backend et marque l'entité synchronisée. */
  async markSynced(entity: SyncEntity, localId: string, serverId?: string): Promise<void> {
    switch (entity) {
      case 'Producteur': {
        const p = await producteurRepository.findById(localId);
        if (p) await producteurRepository.save({ ...p, synced: true, serverId: serverId ?? p.serverId });
        break;
      }
      case 'Parcelle': {
        const p = await parcelleRepository.findById(localId);
        if (p) await parcelleRepository.save({ ...p, synced: true, serverId: serverId ?? p.serverId });
        break;
      }
      case 'Placette': {
        const p = await placetteRepository.findById(localId);
        if (p) await placetteRepository.save({ ...p, synced: true, serverId: serverId ?? p.serverId });
        break;
      }
      // SousPlacette / MesureArbre / Photo sont imbriqués dans la placette :
      // leur état synchronisé est porté par la placette parente.
      default:
        break;
    }
  }

  async getStats() {
    const [producteurs, parcelles, placettes, pending] = await Promise.all([
      producteurRepository.findAll(),
      parcelleRepository.findAll(),
      placetteRepository.findAll(),
      syncQueueRepository.count(),
    ]);

    const superficieTotale = parcelles.reduce((sum, p) => sum + (p.superficie || 0), 0);

    // Production estimée cumulée (kg/an) — indicateur clé du suivi de production.
    const productionTotale = parcelles.reduce((sum, p) => sum + (p.productionEstimee || 0), 0);

    // État sanitaire des plants : % de sujets mesurés vivants (en bon état).
    let totalMesures = 0;
    let mesuresSaines = 0;
    for (const plc of placettes) {
      for (const sp of plc.sousPlacettes) {
        for (const mesure of sp.mesures) {
          totalMesures += 1;
          if (mesure.etatSanitaire === EtatSanitaire.VIVANT) mesuresSaines += 1;
        }
      }
    }
    // Repli : si aucune mesure dendrométrique, on se base sur les parcelles sans maladie.
    const tauxPlantsSains =
      totalMesures > 0
        ? Math.round((mesuresSaines / totalMesures) * 100)
        : parcelles.length > 0
          ? Math.round((parcelles.filter((p) => !p.maladiesObservees).length / parcelles.length) * 100)
          : 0;

    // Parcelles présentant une alerte sanitaire (maladie observée).
    const alertesSanitaires = parcelles.filter((p) => !!p.maladiesObservees).length;

    return {
      totalParcelles: parcelles.length,
      totalProducteurs: producteurs.length,
      totalPlacettes: placettes.length,
      superficieTotale: Number(superficieTotale.toFixed(2)),
      productionTotale: Math.round(productionTotale),
      totalMesures,
      tauxPlantsSains,
      alertesSanitaires,
      pendingSyncCount: pending,
    };
  }

  // ==========================================================================
  // Internes
  // ==========================================================================

  private enqueue(
    entity: SyncEntity,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    clientId: string,
    payload: Record<string, unknown>,
  ) {
    return syncQueueRepository.enqueue(entity, action, clientId, payload);
  }

  /** Met en file la placette et son arbre (sous-placettes + mesures) dans l'ordre de dépendance. */
  private async enqueuePlacetteTree(placette: PlacetteLocal): Promise<void> {
    await this.enqueue('Placette', 'CREATE', placette.id, {
      parcelleId: placette.parcelleId,
      numeroPlacette: placette.numeroPlacette,
      delegationRegionale: placette.delegationRegionale,
      delegationId: placette.delegationId,
      villeId: placette.villeId,
      ville: placette.ville,
      village: placette.village,
      zoneCadastrale: placette.zoneCadastrale,
      typologiePreIdentifiee: placette.typologiePreIdentifiee,
      chefEquipe: placette.chefEquipe,
      dateInventaire: placette.dateInventaire,
      sommets: placette.sommets,
    });

    for (const sp of placette.sousPlacettes) {
      await this.enqueue('SousPlacette', 'CREATE', sp.id, {
        placetteId: sp.placetteId,
        numero: sp.numero,
        nombrePlantsCacao: sp.nombrePlantsCacao,
        nombreArbres: sp.nombreArbres,
        sommets: sp.sommets,
      });
      for (const mesure of sp.mesures) {
        await this.enqueue('MesureArbre', 'CREATE', mesure.id, {
          sousPlacetteId: mesure.sousPlacetteId,
          typeSujet: mesure.typeSujet,
          espece: mesure.espece,
          especeId: mesure.especeId,
          especeLibre: mesure.especeLibre,
          emetOmbre: mesure.emetOmbre,
          estMature: mesure.estMature,
          circonference30cm: mesure.circonference30cm,
          circonferenceDBH: mesure.circonferenceDBH,
          hauteurFut: mesure.hauteurFut,
          hauteurTotale: mesure.hauteurTotale,
          etatSanitaire: mesure.etatSanitaire,
          precisionEtat: mesure.precisionEtat,
          maladieId: mesure.maladieId,
          maladieLibre: mesure.maladieLibre,
          photoMaladie: mesure.photoMaladie,
        });
      }
    }
  }

  private producteurPayload(p: ProducteurLocal): Record<string, unknown> {
    return {
      nom: p.nom,
      prenoms: p.prenoms,
      genre: p.genre,
      identiteProprietaire: p.identiteProprietaire,
      trancheAge: p.trancheAge,
      situationMatrimoniale: p.situationMatrimoniale,
      situationFamiliale: p.situationFamiliale,
      nombreEnfantsCharge: p.nombreEnfantsCharge,
      consentementDonne: p.consentementDonne,
      consentementDate: p.consentementDate,
    };
  }

  /**
   * Payload de synchronisation d'une parcelle.
   * ⚠️ Liste blanche : un champ absent d'ici n'atteint JAMAIS le backend, même
   * s'il est bien saisi et persisté localement. Tout nouveau champ de parcelle
   * doit être ajouté ici en même temps que dans `ParcelleLocal`.
   */
  private parcellePayload(p: ParcelleLocal): Record<string, unknown> {
    return {
      producteurId: p.producteurId,
      anneeParcelle: p.anneeParcelle,
      superficie: p.superficie,
      // Bloc B4 — pratiques culturales
      pratiquesRetenues: p.pratiquesRetenues,
      aucunePratiquePrecision: p.aucunePratiquePrecision,
      autresPratiquesPrecision: p.autresPratiquesPrecision,
      pratiques: p.pratiques,
      // État sanitaire de la parcelle
      maladiesObservees: p.maladiesObservees,
      ancienneteMaladies: p.ancienneteMaladies,
      maladiesNonListees: p.maladiesNonListees,
      // Production
      productionEstimee: p.productionEstimee,
      uniteProduction: p.uniteProduction,
      // Champs de pratiques dépréciés : transmis seulement s'ils existent encore
      // sur une collecte enregistrée avant la refonte du B4.
      executantEntretien: p.executantEntretien,
      typeEntretien: p.typeEntretien,
      frequenceEntretienAn: p.frequenceEntretienAn,
      frequenceEntretienType: p.frequenceEntretienType,
    };
  }
}

export const offlineStorage = new OfflineStorageService();
