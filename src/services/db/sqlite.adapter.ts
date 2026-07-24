// ============================================================================
// CacaoTrace — Adaptateur de persistance SQLite (plateformes natives)
// ----------------------------------------------------------------------------
// Implémente `Persistence` via expo-sqlite. Modèle générique document-store :
//   - table `documents(collection, id, data)` : une ligne = un document JSON
//   - table `kv(key, value)` : paires clé/valeur
// Ce modèle honore l'exigence « SQLite miroir du schéma » tout en restant
// simple à maintenir et robuste (pas de migration de colonnes à chaque champ).
// ============================================================================

import * as SQLite from 'expo-sqlite';
import type { Identifiable, Persistence } from './persistence';

const DB_NAME = 'cacaotrace.db';

export class SQLitePersistence implements Persistence {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Garantit une initialisation unique même en cas d'appels concurrents.
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  private getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('SQLitePersistence non initialisée : appelez init() au démarrage.');
    }
    return this.db;
  }

  async getAll<T extends Identifiable>(collection: string): Promise<T[]> {
    const rows = await this.getDb().getAllAsync<{ data: string }>(
      'SELECT data FROM documents WHERE collection = ?',
      [collection],
    );
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async getById<T extends Identifiable>(collection: string, id: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync<{ data: string }>(
      'SELECT data FROM documents WHERE collection = ? AND id = ?',
      [collection, id],
    );
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async upsert<T extends Identifiable>(collection: string, item: T): Promise<T> {
    await this.getDb().runAsync(
      'INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)',
      [collection, item.id, JSON.stringify(item)],
    );
    return item;
  }

  async bulkUpsert<T extends Identifiable>(collection: string, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = this.getDb();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          'INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)',
          [collection, item.id, JSON.stringify(item)],
        );
      }
    });
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.getDb().runAsync('DELETE FROM documents WHERE collection = ? AND id = ?', [
      collection,
      id,
    ]);
  }

  async clear(collection: string): Promise<void> {
    await this.getDb().runAsync('DELETE FROM documents WHERE collection = ?', [collection]);
  }

  async getKV<T>(key: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      [key],
    );
    return row ? (JSON.parse(row.value) as T) : null;
  }

  async setKV<T>(key: string, value: T): Promise<void> {
    await this.getDb().runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ]);
  }

  async removeKV(key: string): Promise<void> {
    await this.getDb().runAsync('DELETE FROM kv WHERE key = ?', [key]);
  }
}
