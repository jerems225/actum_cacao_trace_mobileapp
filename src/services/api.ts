// ============================================================================
// CacaoTrace — Façade API (compatibilité écrans)
// ----------------------------------------------------------------------------
// Conserve l'API publique historique (ApiSyncService) tout en déléguant la
// synchronisation au SyncManager et l'upload au client HTTP. La logique lourde
// vit désormais dans sync/syncManager.ts, apiClient.ts et http.ts.
// ============================================================================

import { API_BASE_URL } from './config';
import { sessionRepository } from './repositories/session.repository';
import { syncManager } from './sync/syncManager';

export { API_BASE_URL };

export class ApiSyncService {
  /** Header Authorization du user connecté, ou null si pas de session. */
  private static async getAuthHeader(): Promise<string | null> {
    const session = await sessionRepository.getSession();
    return session?.token ? `Bearer ${session.token}` : null;
  }

  /**
   * Téléverse une image vers le backend (qui la place dans Supabase Storage).
   * En cas d'échec/hors-ligne, retourne l'URI locale (l'image reste sur l'appareil).
   */
  static async uploadImageToSupabase(
    imageUri: string,
    category: 'avatars' | 'parcelles' = 'avatars',
  ): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      const authHeader = await this.getAuthHeader();
      if (!authHeader) {
        return { success: false, url: imageUri, message: 'Veuillez vous connecter pour envoyer des photos.' };
      }

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';

      if (imageUri.startsWith('data:') || imageUri.startsWith('blob:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('photo', blob, filename);
      } else {
        // @ts-ignore: objet fichier FormData spécifique à React Native
        formData.append('photo', { uri: imageUri, name: filename, type: 'image/jpeg' });
      }

      const res = await fetch(`${API_BASE_URL}/photos/upload?category=${category}`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        return {
          success: true,
          url: json?.data?.url || imageUri,
          message: 'Image téléversée avec succès.',
        };
      }
      return { success: false, url: imageUri, message: 'Image conservée localement (envoi refusé par le serveur).' };
    } catch {
      return { success: false, url: imageUri, message: 'Mode hors-ligne : image conservée localement.' };
    }
  }

  /**
   * Déclenche la synchronisation de la file d'attente.
   * Délègue au SyncManager (traitement par enregistrement, gestion des conflits).
   */
  static async pushSyncQueue(): Promise<{ success: boolean; syncedCount: number; failedCount: number; message: string }> {
    const outcome = await syncManager.push();
    return {
      success: outcome.reachable && outcome.failed === 0,
      syncedCount: outcome.synced,
      failedCount: outcome.failed,
      message: outcome.message,
    };
  }
}
