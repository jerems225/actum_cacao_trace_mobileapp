// ============================================================================
// CacaoTrace — Génération d'identifiants locaux
// ----------------------------------------------------------------------------
// Identifiants client stables générés hors-ligne. Le backend attribue ensuite
// un `serverId` (UUID) à la synchronisation ; on conserve les deux pour tracer
// la correspondance local ↔ serveur.
// ============================================================================

/** Identifiant local lisible et unique (préfixe métier + horodatage + aléa). */
export function generateId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${rand}`;
}

/** Horodatage ISO courant (source unique de vérité temporelle). */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * UUID v4 (variante RFC 4122) sans dépendance native.
 * Utilisé pour le `deviceId` attendu au format UUID par le backend.
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
