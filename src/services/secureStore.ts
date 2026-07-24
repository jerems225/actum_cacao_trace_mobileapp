// ============================================================================
// CacaoTrace — Stockage sécurisé (abstraction multiplateforme)
// ----------------------------------------------------------------------------
// Natif (iOS/Android) : expo-secure-store (Keychain / Keystore).
// Web : repli sur le magasin kv existant — le web n'a de toute façon pas de
// mode hors-ligne (cf. architecture de persistance), le secure-store n'y existe
// pas. Sert à conserver l'empreinte d'authentification (hash du code secret).
// ============================================================================

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getPersistence } from './db';

const useSecure = Platform.OS !== 'web';

export const secureStore = {
  async setItem(key: string, value: string): Promise<void> {
    if (useSecure) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const p = await getPersistence();
    await p.setKV(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    if (useSecure) {
      return SecureStore.getItemAsync(key);
    }
    const p = await getPersistence();
    return p.getKV<string>(key);
  },

  async removeItem(key: string): Promise<void> {
    if (useSecure) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    const p = await getPersistence();
    await p.removeKV(key);
  },
};
