import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_STICKERS,
} from '@/constants/seed';

let dbPromise: Promise<any> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase | any> {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (Platform.OS === 'web') {
        return createWebFallbackDb();
      }
      try {
        const db = await SQLite.openDatabaseAsync('remindly.db');
        await migrate(db);
        return db;
      } catch (err) {
        throw err;
      }
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  // Enforce critical PRAGMAs on every connection
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version || 0;

  // Migration 1: Base tables and seed data
  if (currentVersion < 1) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          sticker_set_id TEXT NOT NULL,
          color TEXT NOT NULL,
          default_repeat_json TEXT,
          sort_order INTEGER NOT NULL,
          is_system INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stickers (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT,
          name TEXT NOT NULL,
          asset_key TEXT NOT NULL,
          emoji TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          due_at TEXT NOT NULL,
          category_id TEXT NOT NULL,
          priority TEXT NOT NULL,
          repeat_type TEXT NOT NULL,
          repeat_json TEXT,
          status TEXT NOT NULL,
          image_type TEXT NOT NULL,
          sticker_id TEXT,
          custom_image_uri TEXT,
          notification_ids_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_events (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          input_json TEXT NOT NULL,
          output_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      const catCount = await db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) as c FROM categories'
      );
      if (!catCount || catCount.c === 0) {
        const now = new Date().toISOString();
        for (const cat of DEFAULT_CATEGORIES) {
          await db.runAsync(
            `INSERT INTO categories (
              id, name, sticker_set_id, color, default_repeat_json, sort_order, is_system, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            cat.id,
            cat.name,
            cat.stickerSetId,
            cat.color,
            cat.defaultRepeatJson,
            cat.sortOrder,
            cat.isSystem ? 1 : 0,
            now,
            now
          );
        }
        for (const sticker of DEFAULT_STICKERS) {
          await db.runAsync(
            `INSERT INTO stickers (id, category_id, name, asset_key, emoji, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            sticker.id,
            sticker.categoryId,
            sticker.name,
            sticker.assetKey,
            sticker.emoji,
            now
          );
        }
      }

      const settingsRow = await db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) as c FROM settings'
      );
      if (!settingsRow || settingsRow.c === 0) {
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
          await db.runAsync(
            'INSERT INTO settings (key, value_json) VALUES (?, ?)',
            key,
            JSON.stringify(value)
          );
        }
      }

      await db.execAsync('PRAGMA user_version = 1;');
    });
  }

  // Migration 2: Performance Indices & TimeZone support
  if (currentVersion < 2) {
    await db.withExclusiveTransactionAsync(async () => {
      const tableInfo = (await db.getAllAsync(
        'PRAGMA table_info(reminders);'
      )) as Array<{ name: string }>;
      const hasTimeZone = tableInfo.some((col) => col.name === 'time_zone');
      if (!hasTimeZone) {
        await db.execAsync('ALTER TABLE reminders ADD COLUMN time_zone TEXT;');
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders(due_at);
        CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
        CREATE INDEX IF NOT EXISTS idx_reminders_category_id ON reminders(category_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority);
        CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
        CREATE INDEX IF NOT EXISTS idx_stickers_category_id ON stickers(category_id);
        PRAGMA user_version = 2;
      `);
    });
  }
}

/**
 * Lightweight in-memory database fallback for Web previews
 */
function createWebFallbackDb() {
  const now = new Date().toISOString();
  let categories: any[] = DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    sticker_set_id: c.stickerSetId,
    color: c.color,
    default_repeat_json: c.defaultRepeatJson,
    sort_order: c.sortOrder,
    is_system: c.isSystem ? 1 : 0,
    created_at: now,
    updated_at: now,
  }));

  let stickers: any[] = DEFAULT_STICKERS.map((s) => ({
    id: s.id,
    category_id: s.categoryId,
    name: s.name,
    asset_key: s.assetKey,
    emoji: s.emoji,
    created_at: now,
  }));

  let reminders: any[] = [];
  const settings: Record<string, string> = {};

  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    settings[k] = JSON.stringify(v);
  }

  return {
    execAsync: async (_sql: string) => {},
    runAsync: async (sql: string, ...params: any[]) => {
      const lower = sql.toLowerCase();
      if (lower.startsWith('insert into reminders') || lower.includes('into reminders')) {
        const id = params[0];
        const existingIdx = reminders.findIndex((r) => r.id === id);
        const record = {
          id: params[0],
          title: params[1],
          notes: params[2],
          due_at: params[3],
          category_id: params[4],
          priority: params[5],
          repeat_type: params[6],
          repeat_json: params[7],
          status: params[8],
          image_type: params[9],
          sticker_id: params[10],
          custom_image_uri: params[11],
          notification_ids_json: params[12] || '[]',
          created_at: params[13] || now,
          updated_at: params[14] || now,
          completed_at: params[15] || null,
        };
        if (existingIdx >= 0) {
          reminders[existingIdx] = record;
        } else {
          reminders.push(record);
        }
      } else if (lower.startsWith('delete from reminders')) {
        if (params.length > 0) {
          reminders = reminders.filter((r) => r.id !== params[0]);
        } else {
          reminders = [];
        }
      } else if (lower.startsWith('insert into settings') || lower.includes('into settings')) {
        settings[params[0]] = params[1];
      }
    },
    getAllAsync: async (sql: string, ...params: any[]) => {
      const lower = sql.toLowerCase();
      if (lower.includes('from categories')) {
        return [...categories].sort((a, b) => a.sort_order - b.sort_order);
      }
      if (lower.includes('from stickers')) {
        return [...stickers].sort((a, b) => a.name.localeCompare(b.name));
      }
      if (lower.includes('from reminders')) {
        let res = [...reminders];
        if (params.length > 0) {
          if (lower.includes('status = ?')) {
            const statusVal = params[0];
            res = res.filter((r) => r.status === statusVal);
          }
        }
        return res.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
      }
      if (lower.includes('from settings')) {
        return Object.entries(settings).map(([key, value_json]) => ({ key, value_json }));
      }
      return [];
    },
    getFirstAsync: async (sql: string, ...params: any[]) => {
      const lower = sql.toLowerCase();
      if (lower.includes('from reminders') && params.length > 0) {
        return reminders.find((r) => r.id === params[0]) || null;
      }
      if (lower.includes('count(*) as c from categories')) {
        return { c: categories.length };
      }
      if (lower.includes('count(*) as c from settings')) {
        return { c: Object.keys(settings).length };
      }
      return null;
    },
    withTransactionAsync: async (callback: () => Promise<void>) => {
      await callback();
    },
    withExclusiveTransactionAsync: async (callback: () => Promise<void>) => {
      await callback();
    },
  };
}
