import { getDb } from '@/db/database';
import { Category, Reminder, Sticker } from '@/types';

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    stickerSetId: row.sticker_set_id,
    color: row.color,
    defaultRepeatJson: row.default_repeat_json,
    sortOrder: row.sort_order,
    isSystem: !!row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSticker(row: any): Sticker {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    assetKey: row.asset_key,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function mapReminder(row: any): Reminder {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    dueAt: row.due_at,
    categoryId: row.category_id,
    priority: row.priority,
    repeatType: row.repeat_type,
    repeatJson: row.repeat_json,
    status: row.status,
    imageType: row.image_type,
    stickerId: row.sticker_id,
    customImageUri: row.custom_image_uri,
    notificationIdsJson: row.notification_ids_json ?? '[]',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    timeZone: row.time_zone || undefined,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM categories ORDER BY sort_order ASC');
  return rows.map(mapCategory);
}

export async function listStickers(): Promise<Sticker[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM stickers ORDER BY name ASC');
  return rows.map(mapSticker);
}

export async function listReminders(opts?: {
  status?: string;
  categoryId?: string;
  query?: string;
}): Promise<Reminder[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.status) {
    where.push('status = ?');
    params.push(opts.status);
  }
  if (opts?.categoryId) {
    where.push('category_id = ?');
    params.push(opts.categoryId);
  }
  if (opts?.query) {
    where.push('(title LIKE ? OR notes LIKE ?)');
    params.push(`%${opts.query}%`, `%${opts.query}%`);
  }

  const sql = `SELECT * FROM reminders ${
    where.length ? `WHERE ${where.join(' AND ')}` : ''
  } ORDER BY due_at ASC`;

  const rows = await db.getAllAsync(sql, ...params);
  return rows.map(mapReminder);
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM reminders WHERE id = ?', id);
  return row ? mapReminder(row) : null;
}

export async function upsertReminder(reminder: Reminder): Promise<void> {
  const db = await getDb();
  const tz = reminder.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  await db.runAsync(
    `INSERT INTO reminders (
      id, title, notes, due_at, category_id, priority, repeat_type, repeat_json,
      status, image_type, sticker_id, custom_image_uri, notification_ids_json,
      created_at, updated_at, completed_at, time_zone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notification_ids_json=excluded.notification_ids_json,
      updated_at=excluded.updated_at,
      completed_at=excluded.completed_at,
      time_zone=excluded.time_zone`,
    reminder.id,
    reminder.title,
    reminder.notes,
    reminder.dueAt,
    reminder.categoryId,
    reminder.priority,
    reminder.repeatType,
    reminder.repeatJson,
    reminder.status,
    reminder.imageType,
    reminder.stickerId,
    reminder.customImageUri,
    reminder.notificationIdsJson,
    reminder.createdAt,
    reminder.updatedAt,
    reminder.completedAt,
    tz
  );
}

export async function batchUpsertReminders(reminders: Reminder[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const reminder of reminders) {
      await upsertReminder(reminder);
    }
  });
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}

export async function deleteCategory(
  id: string,
  reassignCategoryId = 'cat-work'
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Reassign all associated reminders before removing category
    await db.runAsync(
      'UPDATE reminders SET category_id = ?, updated_at = ? WHERE category_id = ?',
      reassignCategoryId,
      new Date().toISOString(),
      id
    );
    await db.runAsync('DELETE FROM categories WHERE id = ? AND is_system = 0', id);
  });
}

export async function deleteSticker(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE reminders SET sticker_id = NULL WHERE sticker_id = ?', id);
    await db.runAsync('DELETE FROM stickers WHERE id = ?', id);
  });
}

export async function getSettingsMap(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    'SELECT key, value_json FROM settings'
  )) as Array<{ key: string; value_json: string }>;
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      map[row.key] = JSON.parse(row.value_json);
    } catch {
      map[row.key] = row.value_json;
    }
  }
  return map;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    key,
    JSON.stringify(value)
  );
}

export async function logAgentEvent(
  id: string,
  type: string,
  input: unknown,
  output: unknown
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO agent_events (id, type, input_json, output_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    type,
    JSON.stringify(input),
    JSON.stringify(output),
    new Date().toISOString()
  );
}

export async function updateReminderNotificationIds(
  id: string,
  notificationIdsJson: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reminders SET notification_ids_json = ?, updated_at = ? WHERE id = ?`,
    notificationIdsJson,
    new Date().toISOString(),
    id
  );
}

