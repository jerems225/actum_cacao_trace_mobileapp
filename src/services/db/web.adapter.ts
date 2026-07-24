// ============================================================================
// CacaoTrace — Adaptateur de persistance Web
// ----------------------------------------------------------------------------
// Sur le web, la persistance réelle (SQLite) n'est pas disponible. On s'appuie
// sur `localStorage` quand il existe (session/données conservées au rechargement
// de la page — indispensable pour des tests navigateur réalistes), avec un
// repli en mémoire si `localStorage` est inaccessible. La persistance native
// (SQLite, mode offline complet) reste réservée à iOS/Android.
// ============================================================================

import type { Identifiable, Persistence } from './persistence';

const colKey = (collection: string) => `col:${collection}`;
const kvKey = (key: string) => `kv:${key}`;

/** Magasin clé/valeur : localStorage si disponible, sinon mémoire. */
class WebKeyValue {
  private mem = new Map<string, string>();
  private ls: Storage | null =
    typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

  getItem(key: string): string | null {
    if (this.ls) {
      try {
        return this.ls.getItem(key);
      } catch {
        /* quota / mode privé : repli mémoire */
      }
    }
    return this.mem.has(key) ? (this.mem.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    if (this.ls) {
      try {
        this.ls.setItem(key, value);
        return;
      } catch {
        /* repli mémoire */
      }
    }
    this.mem.set(key, value);
  }

  removeItem(key: string): void {
    if (this.ls) {
      try {
        this.ls.removeItem(key);
        return;
      } catch {
        /* repli mémoire */
      }
    }
    this.mem.delete(key);
  }
}

export class WebPersistence implements Persistence {
  private backend = new WebKeyValue();

  async init(): Promise<void> {
    // Aucune structure à créer pour un magasin clé/valeur en mémoire.
  }

  private readCollection<T>(collection: string): T[] {
    const raw = this.backend.getItem(colKey(collection));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private writeCollection<T>(collection: string, items: T[]): void {
    this.backend.setItem(colKey(collection), JSON.stringify(items));
  }

  async getAll<T extends Identifiable>(collection: string): Promise<T[]> {
    return this.readCollection<T>(collection);
  }

  async getById<T extends Identifiable>(collection: string, id: string): Promise<T | null> {
    return this.readCollection<T>(collection).find((i) => i.id === id) ?? null;
  }

  async upsert<T extends Identifiable>(collection: string, item: T): Promise<T> {
    const items = this.readCollection<T>(collection);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    this.writeCollection(collection, items);
    return item;
  }

  async bulkUpsert<T extends Identifiable>(collection: string, incoming: T[]): Promise<void> {
    if (incoming.length === 0) return;
    const items = this.readCollection<T>(collection);
    const byId = new Map(items.map((i) => [i.id, i] as const));
    for (const item of incoming) byId.set(item.id, item);
    this.writeCollection(collection, Array.from(byId.values()));
  }

  async remove(collection: string, id: string): Promise<void> {
    this.writeCollection(
      collection,
      this.readCollection<Identifiable>(collection).filter((i) => i.id !== id),
    );
  }

  async clear(collection: string): Promise<void> {
    this.backend.removeItem(colKey(collection));
  }

  async getKV<T>(key: string): Promise<T | null> {
    const raw = this.backend.getItem(kvKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setKV<T>(key: string, value: T): Promise<void> {
    this.backend.setItem(kvKey(key), JSON.stringify(value));
  }

  async removeKV(key: string): Promise<void> {
    this.backend.removeItem(kvKey(key));
  }
}
