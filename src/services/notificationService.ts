import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder, SnoozeOption } from '@/types';
import { parseISO } from 'date-fns';
import { logger } from '@/utils/logger';
import * as repo from '@/db/repositories';
import { ReminderOverlay } from '@/modules/reminderOverlayModule';
import { resolveReminderSticker } from '@/config/reminderStickers';

// Internal state tracking for idempotent initialization
let isInitialized = false;

export interface ScheduledNotificationDiagnostic {
  notificationId: string;
  reminderId?: string;
  title?: string | null;
  triggerDescription: string;
}

/**
 * 1. CENTRALIZED NOTIFICATION INITIALIZATION
 * Configures top-level presentation handlers, Android channels,
 * interactive categories, and permissions. Safe to call multiple times.
 */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (isInitialized) return;
  isInitialized = true;

  try {
    // 1. Configure foreground notification presentation handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // 2. Configure Android high-importance notification channel
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }

    // 3. Register interactive action categories (Snooze, Done)
    await registerNotificationCategories();

    // 4. Verify initial permissions
    await ensureNotificationPermissions();
  } catch (err) {
    logger.warn('notifications', 'Failed to initialize notifications:', err);
    // Allow re-attempt if initialization encountered a transient failure
    isInitialized = false;
  }
}

/**
 * 2. ANDROID NOTIFICATION CHANNEL CONFIGURATION
 * Configures high-importance channel with heads-up banner support, sound, and vibration.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Alerts and sound notifications for your scheduled reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#3D7EA6',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  } catch (err) {
    logger.warn('notifications', 'Failed to configure Android notification channel:', err);
  }
}

/**
 * 3. INTERACTIVE NOTIFICATION ACTION CATEGORIES
 * Registers quick-action buttons directly on the native lockscreen and banner notifications.
 */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.setNotificationCategoryAsync('reminder', [
      {
        identifier: 'SNOOZE_5',
        buttonTitle: 'Snooze 5m',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SNOOZE_60',
        buttonTitle: 'Snooze 1h',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SNOOZE_1440',
        buttonTitle: 'Snooze 1d',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'MARK_DONE',
        buttonTitle: 'Done',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (err) {
    logger.warn('notifications', 'Failed to register notification categories:', err);
  }
}

/**
 * 4. PERMISSION CHECKS & REQUESTS
 * Strictly verifies and requests notification permissions.
 * Never throws; returns boolean status.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') {
      return true;
    }

    if (current.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
          allowCriticalAlerts: false,
        },
      });
      return asked.granted || asked.status === 'granted';
    }

    return false;
  } catch (err) {
    logger.warn('notifications', 'Failed to verify notification permissions:', err);
    return false;
  }
}

/**
 * 5. SCHEDULE A REMINDER NOTIFICATION
 * Validates target date, prevents duplicates by cancelling prior notifications,
 * and schedules using exact date or elapsed monotonic interval.
 */
export async function scheduleReminderNotification(
  reminder: Reminder,
  body?: string,
  stickerEmoji?: string
): Promise<string[]> {
  if (Platform.OS === 'web') return [];

  // Parse due date and validate
  const due = parseISO(reminder.dueAt);
  const nowMs = Date.now();
  const diffMs = due.getTime() - nowMs;

  // Abort if date is invalid or in the past
  if (isNaN(due.getTime()) || diffMs <= 0) {
    return [];
  }

  // Idempotency: cancel previous notifications associated with this reminder
  if (reminder.notificationIdsJson) {
    await cancelReminderNotifications(reminder.notificationIdsJson);
  }

  // Ensure notification subsystem is initialized
  await initializeNotifications();

  // Verify permission before attempting schedule
  const granted = await ensureNotificationPermissions();
  if (!granted) {
    logger.warn('notifications', 'Cannot schedule reminder: Notification permission denied');
    return [];
  }

  const diffSeconds = Math.max(1, Math.round(diffMs / 1000));

  const content: Notifications.NotificationContentInput = {
    title: stickerEmoji ? `${stickerEmoji} ${reminder.title}` : reminder.title,
    body: body || reminder.notes || 'Time for your reminder',
    data: { reminderId: reminder.id, stickerEmoji },
    categoryIdentifier: 'reminder',
    sound: 'default',
    badge: 1,
    ...(Platform.OS === 'android'
      ? {
          channelId: 'reminders',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 150, 250],
        }
      : {}),
  };

  /**
   * TRIGGER STRATEGY:
   * 1. If under 5 minutes (< 300 seconds), use TIME_INTERVAL (ELAPSED_REALTIME_WAKEUP on Android).
   *    Bypasses wall-clock drift, NTP adjustments, and aggressive Doze mode.
   * 2. For >= 5 minutes, use DATE trigger with automatic fallback to TIME_INTERVAL
   *    if Android 13+ exact alarm restrictions prevent DATE scheduling.
   */
  const isShortDuration = diffSeconds < 300;

  const scheduleOverlayAlarm = () => {
    if (Platform.OS === 'android') {
      const stickerConfig = resolveReminderSticker(
        reminder.categoryId || reminder.stickerId,
        reminder.title
      );
      void ReminderOverlay.scheduleOverlay({
        reminderId: reminder.id,
        title: stickerEmoji ? `${stickerEmoji} ${reminder.title}` : reminder.title,
        body: body || reminder.notes || stickerConfig.defaultBody,
        theme: reminder.categoryId || stickerConfig.key,
        stickerKey: stickerConfig.key,
        dueAtIso: reminder.dueAt,
        triggerAtMs: due.getTime(),
      });
    }
  };

  if (isShortDuration) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: diffSeconds,
          repeats: false,
          channelId: Platform.OS === 'android' ? 'reminders' : undefined,
        },
      });
      scheduleOverlayAlarm();
      return [id];
    } catch (err) {
      logger.warn('notifications', 'Time-interval trigger failed, attempting Date fallback:', err);
    }
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: due,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
      },
    });
    scheduleOverlayAlarm();
    return [id];
  } catch (dateErr) {
    // Fallback for Android 13+ if SCHEDULE_EXACT_ALARM is restricted
    if (Platform.OS === 'android') {
      try {
        const fallbackSeconds = Math.max(1, Math.round((due.getTime() - Date.now()) / 1000));
        const fallbackId = await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: fallbackSeconds,
            repeats: false,
            channelId: 'reminders',
          },
        });
        scheduleOverlayAlarm();
        return [fallbackId];
      } catch (fallbackErr) {
        logger.error('NOTIF_SCHED_FAIL_202', fallbackErr);
      }
    }
    logger.error('NOTIF_SCHED_FAIL_202', dateErr);
    return [];
  }
}

/**
 * 6. CANCEL REMINDER OVERLAY ALARM
 */
export async function cancelReminderOverlay(reminderId: string): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await ReminderOverlay.cancelOverlay(reminderId);
    } catch (err) {
      logger.warn('notifications', 'Failed to cancel reminder overlay:', err);
    }
  }
}

/**
 * 6. CANCEL NOTIFICATION(S) BY ID
 */
export async function cancelReminderNotification(idOrIds: string | string[]): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    await Promise.all(
      ids.map(async (id) => {
        if (id) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
      })
    );
  } catch (err) {
    logger.warn('notifications', 'Failed to cancel notification(s):', err);
  }
}

/**
 * 7. CANCEL NOTIFICATIONS FROM JSON STRING
 */
export async function cancelReminderNotifications(idsJson: string): Promise<void> {
  if (Platform.OS === 'web' || !idsJson) return;

  try {
    const ids = JSON.parse(idsJson) as string[];
    if (Array.isArray(ids) && ids.length > 0) {
      await cancelReminderNotification(ids);
    }
  } catch {
    // Malformed JSON or empty string; safe to ignore
  }
}

/**
 * 8. RESCHEDULE REMINDER NOTIFICATION
 * Cancels existing notifications for the reminder and schedules a new one.
 */
export async function rescheduleReminderNotification(
  reminder: Reminder,
  body?: string,
  stickerEmoji?: string
): Promise<string[]> {
  await cancelReminderNotifications(reminder.notificationIdsJson);
  if (reminder.status === 'active') {
    return scheduleReminderNotification(reminder, body, stickerEmoji);
  }
  return [];
}

/**
 * 9. CANCEL ALL REMINDLY NOTIFICATIONS
 * Cancels all scheduled notifications positively associated with Remindly.
 */
export async function cancelAllReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const remindlyNotifications = scheduled.filter(
      (n) => n.content.data && 'reminderId' in n.content.data
    );

    await Promise.all(
      remindlyNotifications.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (err) {
    logger.warn('notifications', 'Failed to cancel all notifications:', err);
  }
}

/**
 * 10. GET SCHEDULED NOTIFICATIONS
 */
export async function getScheduledReminderNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  if (Platform.OS === 'web') return [];

  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (err) {
    logger.warn('notifications', 'Failed to retrieve scheduled notifications:', err);
    return [];
  }
}

/**
 * 11. NOTIFICATION RECONCILIATION
 * Compares active reminders with OS scheduled notifications.
 * Cancels orphaned Remindly notifications and restores missing notifications (e.g. after phone reboot).
 */
export async function reconcileAndRescheduleAllActiveReminders(
  reminders: Reminder[]
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await getScheduledReminderNotifications();
    const nowMs = Date.now();

    const scheduledIdSet = new Set<string>();
    for (const req of scheduled) {
      scheduledIdSet.add(req.identifier);
    }

    const activeMap = new Map<string, Reminder>();
    for (const rem of reminders) {
      if (rem.status === 'active') {
        activeMap.set(rem.id, rem);
      }
    }

    // 1. Cancel orphaned Remindly notifications for reminders that are no longer active
    for (const req of scheduled) {
      const remId = req.content.data?.reminderId as string | undefined;
      if (remId && !activeMap.has(remId)) {
        await Notifications.cancelScheduledNotificationAsync(req.identifier);
        void cancelReminderOverlay(remId);
      }
    }

    // 2. Ensure every active future reminder has a valid notification scheduled
    for (const rem of reminders) {
      if (rem.status !== 'active') continue;

      const due = parseISO(rem.dueAt);
      if (isNaN(due.getTime()) || due.getTime() <= nowMs) continue;

      let existingIds: string[] = [];
      try {
        existingIds = JSON.parse(rem.notificationIdsJson || '[]') as string[];
      } catch {
        existingIds = [];
      }

      const hasScheduled = existingIds.some((id) => scheduledIdSet.has(id));
      if (!hasScheduled) {
        // Missing from OS scheduler (e.g. after reboot); reschedule!
        const newIds = await scheduleReminderNotification(rem);
        rem.notificationIdsJson = JSON.stringify(newIds);
        await repo.updateReminderNotificationIds(rem.id, rem.notificationIdsJson);
      }
    }
  } catch (err) {
    logger.warn('notifications', 'Failed to reconcile notifications:', err);
  }
}

/**
 * 12. SNOOZE ACTION HELPER
 */
export function snoozeMinutesFromAction(actionId?: string | null): SnoozeOption | null {
  if (actionId === 'SNOOZE_5') return 5;
  if (actionId === 'SNOOZE_60') return 60;
  if (actionId === 'SNOOZE_1440') return 1440;
  return null;
}

/**
 * 13. SCHEDULED NOTIFICATION DIAGNOSTICS (DEV/INSPECTION)
 */
export async function getNotificationDiagnostics(): Promise<ScheduledNotificationDiagnostic[]> {
  const scheduled = await getScheduledReminderNotifications();
  return scheduled.map((s) => ({
    notificationId: s.identifier,
    reminderId: s.content.data?.reminderId as string | undefined,
    title: s.content.title,
    triggerDescription: JSON.stringify(s.trigger),
  }));
}
