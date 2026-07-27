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

  /**
   * Charge une collecte complète pour reprise dans le wizard.
   * Retourne `null` si la parcelle ou son producteur a disparu.
   */
  async getCollecte(parcelleId: string): Promise<{
    producteur: ProducteurLocal;
    parcelle: ParcelleLocal;
    placette: PlacetteLocal | null;
  } | null> {
    const parcelle = await parcelleRepository.findById(parcelleId);
    if (!parcelle) return null;
    const producteur = await producteurRepository.findById(parcelle.producteurId);
    if (!producteur) return null;
    const placettes = await placetteRepository.findAll();
    const placette = placettes.find((p) => p.parcelleId === parcelleId) ?? null;
    return { producteur, parcelle, placette };
  }

  /**
   * Met à jour une collecte existante (reprise d'un brouillon).
   *
   * Modification ENTITÉ PAR ENTITÉ, et non remplacement en bloc : chaque
   * sous-placette et chaque mesure conserve son identifiant serveur d'un
   * passage à l'autre. L'appariement se fait sur des clés stables — le `numero`
   * pour les sous-placettes, l'identifiant local pour les mesures — ce qui
   * permet de distinguer trois cas : présent des deux côtés → UPDATE, nouveau
   * → CREATE, disparu → DELETE.
   */
  async updateCompleteCollecte(input: {
    parcelleId: string;
    producteur: Partial<NewProducteur>;
    parcelle: Partial<Omit<NewParcelle, 'producteurId'>>;
    placette: Omit<NewPlacette, 'parcelleId'>;
  }): Promise<{ parcelle: ParcelleLocal } | null> {
    const courant = await this.getCollecte(input.parcelleId);
    if (!courant) return null;

    await this.updateProducteur(courant.producteur.id, {
      ...input.producteur,
      // Le nom dénormalisé sur la parcelle doit suivre une correction d'identité.
    });
    const parcelle = await this.updateParcelle(courant.parcelle.id, {
      ...input.parcelle,
      producteurNom: `${input.producteur.prenoms ?? courant.producteur.prenoms} ${
        input.producteur.nom ?? courant.producteur.nom
      }`,
    });

    if (courant.placette) {
      await this.updatePlacetteTree(courant.placette, input.placette);
    } else {
      // Cas limite : brouillon enregistré sans placette (aucun point relevé).
      await this.savePlacette({ ...input.placette, parcelleId: courant.parcelle.id });
    }

    return parcelle ? { parcelle } : null;
  }

  /** Applique le diff sous-placettes / mesures d'une placette existante. */
  private async updatePlacetteTree(
    existante: PlacetteLocal,
    entrant: Omit<NewPlacette, 'parcelleId'>,
  ): Promise<void> {
    const ancienesParNumero = new Map(existante.sousPlacettes.map((sp) => [sp.numero, sp]));
    const numerosEntrants = new Set((entrant.sousPlacettes ?? []).map((sp) => sp.numero));

    const sousPlacettes: SousPlacetteLocal[] = [];

    for (const entrante of entrant.sousPlacettes ?? []) {
      const ancienne = ancienesParNumero.get(entrante.numero);

      if (!ancienne) {
        // Sous-placette apparue depuis le brouillon → création.
        const sousPlacetteId = generateId('sp');
        const mesures = (entrante.mesures ?? []).map((m) => ({
          ...m,
          id: generateId('mes'),
          sousPlacetteId,
          createdAt: m.createdAt || nowIso(),
        }));
        const creee: SousPlacetteLocal = {
          ...entrante,
          id: sousPlacetteId,
          placetteId: existante.id,
          mesures,
        };
        sousPlacettes.push(creee);
        await this.enqueue('SousPlacette', 'CREATE', creee.id, this.sousPlacettePayload(creee));
        for (const m of mesures) {
          await this.enqueue('MesureArbre', 'CREATE', m.id, this.mesurePayload(m));
        }
        continue;
      }

      // Sous-placette conservée → mise à jour, puis diff de ses mesures.
      const mesures = await this.diffMesures(ancienne, entrante.mesures ?? []);
      const majSP: SousPlacetteLocal = {
        ...ancienne,
        nombrePlantsCacao: entrante.nombrePlantsCacao,
        nombreArbres: entrante.nombreArbres,
        sommets: entrante.sommets,
        mesures,
      };
      sousPlacettes.push(majSP);
      await this.enqueue('SousPlacette', 'UPDATE', majSP.id, {
        ...this.sousPlacettePayload(majSP),
        serverId: majSP.serverId,
      });
    }

    // Sous-placettes retirées de la fiche → suppression côté serveur aussi.
    for (const ancienne of existante.sousPlacettes) {
      if (numerosEntrants.has(ancienne.numero)) continue;
      await this.enqueue('SousPlacette', 'DELETE', ancienne.id, { serverId: ancienne.serverId });
    }

    const placette: PlacetteLocal = {
      ...existante,
      ...entrant,
      id: existante.id,
      parcelleId: existante.parcelleId,
      serverId: existante.serverId,
      // Le numéro définitif vient du serveur : une reprise ne le régénère pas.
      numeroPlacette: existante.numeroPlacette,
      sousPlacettes,
      synced: false,
      updatedAt: nowIso(),
    };
    await placetteRepository.save(placette);
    await this.enqueue('Placette', 'UPDATE', placette.id, {
      ...this.placettePayload(placette),
      serverId: placette.serverId,
    });
  }

  /**
   * Apparie les mesures d'une sous-placette par identifiant local.
   * Une mesure rechargée depuis le brouillon garde son id : elle est donc
   * modifiée, pas recréée. Une mesure retirée par l'agent est supprimée.
   */
  private async diffMesures(
    ancienne: SousPlacetteLocal,
    entrantes: MesureArbreLocal[],
  ): Promise<MesureArbreLocal[]> {
    const anciennesParId = new Map(ancienne.mesures.map((m) => [m.id, m]));
    const idsEntrants = new Set(entrantes.map((m) => m.id).filter(Boolean));
    const resultat: MesureArbreLocal[] = [];

    for (const entrante of entrantes) {
      const existante = entrante.id ? anciennesParId.get(entrante.id) : undefined;
      if (existante) {
        const maj: MesureArbreLocal = {
          ...entrante,
          id: existante.id,
          serverId: existante.serverId,
          sousPlacetteId: ancienne.id,
          createdAt: existante.createdAt,
        };
        resultat.push(maj);
        await this.enqueue('MesureArbre', 'UPDATE', maj.id, {
          ...this.mesurePayload(maj),
          serverId: maj.serverId,
        });
      } else {
        const creee: MesureArbreLocal = {
          ...entrante,
          id: generateId('mes'),
          serverId: undefined,
          sousPlacetteId: ancienne.id,
          createdAt: entrante.createdAt || nowIso(),
        };
        resultat.push(creee);
        await this.enqueue('MesureArbre', 'CREATE', creee.id, this.mesurePayload(creee));
      }
    }

    for (const m of ancienne.mesures) {
      if (!idsEntrants.has(m.id)) {
        await this.enqueue('MesureArbre', 'DELETE', m.id, { serverId: m.serverId });
      }
    }

    return resultat;
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
      // Sous-placettes et mesures sont imbriquées dans la placette : leur état
      // « synchronisé » est porté par la parente, mais leur serverId doit être
      // conservé individuellement — sans lui, une correction ultérieure ne
      // pourrait que recréer au lieu de modifier.
      case 'SousPlacette':
      case 'MesureArbre': {
        if (!serverId) break;
        await this.appliquerServerIdImbrique(entity, localId, serverId);
        break;
      }
      default:
        break;
    }
  }

  /** Écrit le serverId d'une sous-placette ou d'une mesure dans sa placette. */
  private async appliquerServerIdImbrique(
    entity: 'SousPlacette' | 'MesureArbre',
    localId: string,
    serverId: string,
  ): Promise<void> {
    const placettes = await placetteRepository.findAll();
    for (const plc of placettes) {
      let touche = false;
      const sousPlacettes = plc.sousPlacettes.map((sp) => {
        if (entity === 'SousPlacette' && sp.id === localId) {
          touche = true;
          return { ...sp, serverId };
        }
        if (entity === 'MesureArbre' && sp.mesures.some((m) => m.id === localId)) {
          touche = true;
          return {
            ...sp,
            mesures: sp.mesures.map((m) => (m.id === localId ? { ...m, serverId } : m)),
          };
        }
        return sp;
      });
      if (touche) {
        await placetteRepository.save({ ...plc, sousPlacettes });
        return;
      }
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
    await this.enqueue('Placette', 'CREATE', placette.id, this.placettePayload(placette));

    for (const sp of placette.sousPlacettes) {
      await this.enqueue('SousPlacette', 'CREATE', sp.id, this.sousPlacettePayload(sp));
      for (const mesure of sp.mesures) {
        await this.enqueue('MesureArbre', 'CREATE', mesure.id, this.mesurePayload(mesure));
      }
    }
  }

  /**
   * ⚠️ Ces trois constructeurs sont des listes blanches partagées par la création
   * ET la modification : un champ absent ici n'atteint jamais le backend, même
   * correctement saisi et persisté localement. Tout nouveau champ doit y être
   * ajouté en même temps que dans le type local correspondant.
   */
  private placettePayload(p: PlacetteLocal): Record<string, unknown> {
    return {
      parcelleId: p.parcelleId,
      numeroPlacette: p.numeroPlacette,
      delegationRegionale: p.delegationRegionale,
      delegationId: p.delegationId,
      villeId: p.villeId,
      ville: p.ville,
      village: p.village,
      zoneCadastrale: p.zoneCadastrale,
      typologiePreIdentifiee: p.typologiePreIdentifiee,
      chefEquipe: p.chefEquipe,
      dateInventaire: p.dateInventaire,
      sommets: p.sommets,
    };
  }

  private sousPlacettePayload(sp: SousPlacetteLocal): Record<string, unknown> {
    return {
      placetteId: sp.placetteId,
      numero: sp.numero,
      nombrePlantsCacao: sp.nombrePlantsCacao,
      nombreArbres: sp.nombreArbres,
      sommets: sp.sommets,
    };
  }

  private mesurePayload(m: MesureArbreLocal): Record<string, unknown> {
    return {
      sousPlacetteId: m.sousPlacetteId,
      typeSujet: m.typeSujet,
      espece: m.espece,
      especeId: m.especeId,
      especeLibre: m.especeLibre,
      emetOmbre: m.emetOmbre,
      estMature: m.estMature,
      circonference30cm: m.circonference30cm,
      circonferenceDBH: m.circonferenceDBH,
      hauteurFut: m.hauteurFut,
      hauteurTotale: m.hauteurTotale,
      etatSanitaire: m.etatSanitaire,
      precisionEtat: m.precisionEtat,
      maladieId: m.maladieId,
      maladieLibre: m.maladieLibre,
      photoMaladie: m.photoMaladie,
    };
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
      // Cycle de vie : BROUILLON exclut la collecte des stats et des exports,
      // SOUMISE la verrouille pour le terrain.
      statutCollecte: p.statutCollecte,
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
