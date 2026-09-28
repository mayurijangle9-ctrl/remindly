import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { format, parseISO } from 'date-fns';
import { getDb } from '@/db/database';
import * as repo from '@/db/repositories';
import {
  cancelReminderNotifications,
  scheduleReminderNotification,
} from '@/services/notifications';
import { Category, Priority, Reminder, RepeatType, Sticker } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/seed';

export interface RemindlyBackup {
  appName: 'Remindly';
  version: 1;
  exportedAt: string;
  metadata: {
    reminderCount: number;
    categoryCount: number;
    stickerCount: number;
  };
  data: {
    reminders: Reminder[];
    categories: Category[];
    stickers: Sticker[];
    settings: Record<string, unknown>;
  };
}

export type ImportMode = 'merge' | 'replace' | 'overwrite';

export interface ExportResult {
  success: boolean;
  filePath?: string;
  count?: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  canceled?: boolean;
  importedCount?: number;
  mode?: ImportMode;
  error?: string;
}

/**
 * Validates the raw JSON payload against Remindly's schema.
 */
export function validateBackupPayload(
  raw: unknown
): { valid: true; backup: RemindlyBackup } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Backup file is empty or not a valid JSON object.' };
  }

  const obj = raw as Record<string, any>;

  if (obj.appName !== 'Remindly') {
    return {
      valid: false,
      error: 'Invalid file signature: Not a valid Remindly backup document.',
    };
  }

  if (obj.version !== 1) {
    return {
      valid: false,
      error: `Unsupported backup version: ${obj.version}. Expected version 1.`,
    };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: 'Malformed backup: Missing "data" container.' };
  }

  const { reminders, categories, stickers } = obj.data;

  if (!Array.isArray(reminders)) {
    return { valid: false, error: 'Malformed backup: "reminders" must be an array.' };
  }

  // Validate each reminder object has required fields
  const validPriorities: Priority[] = ['Low', 'Medium', 'High'];
  const validRepeats: RepeatType[] = [
    'None',
    'Daily',
    'Weekly',
    'Monthly',
    'Yearly',
    'CustomInterval',
  ];

  // Foreign key validation: Ensure referenced categories exist or fallback to default
  const knownCategoryIds = new Set<string>([
    ...DEFAULT_CATEGORIES.map((c) => c.id),
    ...((categories as Category[]) || []).map((c) => c.id),
  ]);

  for (let i = 0; i < reminders.length; i++) {
    const r = reminders[i];
    if (!r.id || typeof r.id !== 'string') {
      return { valid: false, error: `Reminder at index ${i} is missing a valid "id".` };
    }
    if (!r.title || typeof r.title !== 'string') {
      return { valid: false, error: `Reminder at index ${i} is missing a valid "title".` };
    }
    if (!r.dueAt || isNaN(Date.parse(r.dueAt))) {
      return { valid: false, error: `Reminder "${r.title}" has an invalid "dueAt" timestamp.` };
    }
    if (!r.categoryId || typeof r.categoryId !== 'string') {
      return { valid: false, error: `Reminder "${r.title}" is missing a "categoryId".` };
    }
    // Re-link orphaned categories to default safe work category
    if (!knownCategoryIds.has(r.categoryId)) {
      r.categoryId = 'cat-work';
    }
    if (!validPriorities.includes(r.priority)) {
      return { valid: false, error: `Reminder "${r.title}" has an invalid priority "${r.priority}".` };
    }
    if (!validRepeats.includes(r.repeatType)) {
      return { valid: false, error: `Reminder "${r.title}" has an invalid repeatType "${r.repeatType}".` };
    }
  }

  if (categories && !Array.isArray(categories)) {
    return { valid: false, error: 'Malformed backup: "categories" must be an array.' };
  }

  if (stickers && !Array.isArray(stickers)) {
    return { valid: false, error: 'Malformed backup: "stickers" must be an array.' };
  }

  return { valid: true, backup: obj as RemindlyBackup };
}

/**
 * Creates a complete JSON backup file and opens the native OS sharing sheet.
 */
export async function exportBackup(): Promise<ExportResult> {
  try {
    const [reminders, categories, stickers, settings] = await Promise.all([
      repo.listReminders(),
      repo.listCategories(),
      repo.listStickers(),
      repo.getSettingsMap(),
    ]);

    const backupPayload: RemindlyBackup = {
      appName: 'Remindly',
      version: 1,
      exportedAt: new Date().toISOString(),
      metadata: {
        reminderCount: reminders.length,
        categoryCount: categories.length,
        stickerCount: stickers.length,
      },
      data: {
        reminders,
        categories,
        stickers,
        settings,
      },
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const timeStamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const fileName = `remindly_backup_v1_${timeStamp}.json`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        error: 'Sharing is not supported on this platform/device.',
      };
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Remindly Backup',
      UTI: 'public.json',
    });

    return {
      success: true,
      filePath,
      count: reminders.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Prompts user to select a JSON backup file and restores it into SQLite within a safe transaction.
 */
export async function importBackup(mode: ImportMode): Promise<ImportResult> {
  try {
    const pickResult = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (pickResult.canceled || !pickResult.assets || !pickResult.assets[0]) {
      return { success: false, canceled: true };
    }

    const fileUri = pickResult.assets[0].uri;
    const fileContents = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileContents);
    } catch {
      return { success: false, error: 'The selected file is not a valid JSON document.' };
    }

    const validation = validateBackupPayload(parsedJson);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { reminders, categories, stickers, settings } = validation.backup.data;
    const db = await getDb();

    // Execute import in an atomic SQLite transaction
    await db.withTransactionAsync(async () => {
      if (mode === 'replace' || mode === 'overwrite') {
        // Cancel all existing scheduled notifications before clearing reminders
        const existingReminders = await repo.listReminders();
        for (const rem of existingReminders) {
          await cancelReminderNotifications(rem.notificationIdsJson);
        }

        // Delete existing reminders and custom categories
        await db.runAsync('DELETE FROM reminders');
        await db.runAsync('DELETE FROM categories WHERE is_system = 0');
      }

      // 1. Upsert Categories
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          await db.runAsync(
            `INSERT INTO categories (
              id, name, sticker_set_id, color, default_repeat_json, sort_order, is_system, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              sticker_set_id=excluded.sticker_set_id,
              color=excluded.color,
              default_repeat_json=excluded.default_repeat_json,
              sort_order=excluded.sort_order,
              updated_at=excluded.updated_at`,
            cat.id,
            cat.name,
            cat.stickerSetId,
            cat.color,
            cat.defaultRepeatJson,
            cat.sortOrder,
            cat.isSystem ? 1 : 0,
            cat.createdAt || new Date().toISOString(),
            cat.updatedAt || new Date().toISOString()
          );
        }
      }

      // 2. Upsert Stickers
      if (stickers && stickers.length > 0) {
        for (const stk of stickers) {
          await db.runAsync(
            `INSERT INTO stickers (
              id, category_id, name, asset_key, emoji, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              asset_key=excluded.asset_key,
              emoji=excluded.emoji`,
            stk.id,
            stk.categoryId,
            stk.name,
            stk.assetKey,
            stk.emoji,
            stk.createdAt || new Date().toISOString()
          );
        }
      }

      // 3. Upsert Reminders
      for (const r of reminders) {
        await db.runAsync(
          `INSERT INTO reminders (
            id, title, notes, due_at, category_id, priority, repeat_type, repeat_json,
            status, image_type, sticker_id, custom_image_uri, notification_ids_json,
            created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            notes=excluded.notes,
            due_at=excluded.due_at,
            category_id=excluded.category_id,
            priority=excluded.priority,
            repeat_type=excluded.repeat_type,
            repeat_json=excluded.repeat_json,
            status=excluded.status,
            image_type=excluded.image_type,
            sticker_id=excluded.sticker_id,
            custom_image_uri=excluded.custom_image_uri,
            updated_at=excluded.updated_at,
            completed_at=excluded.completed_at`,
          r.id,
          r.title,
          r.notes || '',
          r.dueAt,
          r.categoryId,
          r.priority,
          r.repeatType,
          r.repeatJson || null,
          r.status,
          r.imageType,
          r.stickerId || null,
          r.customImageUri || null,
          '[]', // Reset notification IDs so we reschedule freshly
          r.createdAt || new Date().toISOString(),
          r.updatedAt || new Date().toISOString(),
          r.completedAt || null
        );
      }

      // 4. Restore Settings
      if (settings && typeof settings === 'object') {
        for (const [k, v] of Object.entries(settings)) {
          await db.runAsync(
            `INSERT INTO settings (key, value_json) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
            k,
            JSON.stringify(v)
          );
        }
      }
    });

    // Post-transaction: Reschedule notifications for active upcoming reminders
    const nowTime = Date.now();
    const importedReminders = await repo.listReminders({ status: 'active' });
    const allStickers = await repo.listStickers();

    for (const rem of importedReminders) {
      if (parseISO(rem.dueAt).getTime() > nowTime) {
        const emoji = allStickers.find((s) => s.id === rem.stickerId)?.emoji;
        const notifIds = await scheduleReminderNotification(
          rem,
          rem.notes || undefined,
          emoji
        );
        rem.notificationIdsJson = JSON.stringify(notifIds);
        await repo.upsertReminder(rem);
      }
    }

    return {
      success: true,
      importedCount: reminders.length,
      mode,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
