import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDb } from '@/db/database';
import { useReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  initializeNotifications,
  reconcileAndRescheduleAllActiveReminders,
  snoozeMinutesFromAction,
} from '@/services/notificationService';
import { ReminderOverlay } from '@/modules/reminderOverlayModule';
import { ReminderPopup } from '@/components/ReminderPopup';

// Process-wide idempotency lock for lock-screen notification actions
const inFlightNotificationActions = new Set<string>();

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const bootstrap = useReminderStore((s) => s.bootstrap);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const completeReminder = useReminderStore((s) => s.completeReminder);
  const snoozeReminder = useReminderStore((s) => s.snoozeReminder);
  const setActivePopup = useReminderStore((s) => s.setActivePopup);

  useEffect(() => {
    let subReceived: Notifications.Subscription | undefined;
    let subResponse: Notifications.Subscription | undefined;

    const processNotificationResponse = async (
      response: Notifications.NotificationResponse
    ) => {
      const reminderId = response.notification.request.content.data?.reminderId as
        | string
        | undefined;
      if (!reminderId) return;

      const action = response.actionIdentifier;
      const idempotencyKey = `${reminderId}:${action}`;

      // Prevent duplicate executions on rapid double-tap
      if (inFlightNotificationActions.has(idempotencyKey)) return;
      inFlightNotificationActions.add(idempotencyKey);

      try {
        if (action === 'MARK_DONE') {
          await completeReminder(reminderId);
        } else if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          setActivePopup(reminderId);
        } else {
          const minutes = snoozeMinutesFromAction(action);
          if (minutes) {
            await snoozeReminder(reminderId, minutes);
          } else {
            setActivePopup(reminderId);
          }
        }
      } catch (actionErr) {
        if (__DEV__) {
          console.warn('[AppBootstrap] Error handling notification action:', actionErr);
        }
      } finally {
        setTimeout(() => inFlightNotificationActions.delete(idempotencyKey), 3000);
      }
    };

    (async () => {
      try {
        await getDb();
      } catch (err) {
        if (__DEV__) console.warn('[AppBootstrap] Database initialization warning:', err);
      }

      try {
        await hydrateSettings();
      } catch (err) {
        if (__DEV__) console.warn('[AppBootstrap] Settings hydration warning:', err);
      }

      if (Platform.OS !== 'web') {
        try {
          await initializeNotifications();
        } catch (err) {
          if (__DEV__) console.warn('[AppBootstrap] Notification initialization warning:', err);
        }
      }

      try {
        await bootstrap();
      } catch (err) {
        if (__DEV__) console.warn('[AppBootstrap] Bootstrap warning:', err);
      }

      if (Platform.OS !== 'web') {
        try {
          // Cold-start check: If app was launched by tapping a notification while dead
          const initialResponse = await Notifications.getLastNotificationResponseAsync();
          if (initialResponse) {
            await processNotificationResponse(initialResponse);
          }

          // Cold-start reboot reconciliation: Restore alarms dropped by OS reboot
          const loadedReminders = useReminderStore.getState().reminders;
          await reconcileAndRescheduleAllActiveReminders(loadedReminders);

          // Listeners for active foreground/background notification events
          subReceived = Notifications.addNotificationReceivedListener((notification) => {
            const reminderId = notification.request.content.data?.reminderId as string | undefined;
            if (reminderId) setActivePopup(reminderId);
          });

          subResponse = Notifications.addNotificationResponseReceivedListener(
            (response) => {
              void processNotificationResponse(response);
            }
          );
        } catch (err) {
          if (__DEV__) console.warn('[AppBootstrap] Notification listener warning:', err);
        }
      }
    })();

    // Native floating overlay events (Done / Snooze actions from outside the app)
    const subOverlayDone = ReminderOverlay.addOverlayDoneListener(async ({ reminderId }) => {
      try {
        await completeReminder(reminderId);
      } catch (err) {
        if (__DEV__) console.warn('[AppBootstrap] Error completing reminder from overlay:', err);
      }
    });

    const subOverlaySnooze = ReminderOverlay.addOverlaySnoozeListener(async ({ reminderId }) => {
      try {
        await snoozeReminder(reminderId, 5);
      } catch (err) {
        if (__DEV__) console.warn('[AppBootstrap] Error snoozing reminder from overlay:', err);
      }
    });

    return () => {
      subReceived?.remove();
      subResponse?.remove();
      subOverlayDone?.remove();
      subOverlaySnooze?.remove();
    };
  }, [bootstrap, completeReminder, hydrateSettings, setActivePopup, snoozeReminder]);

  return (
    <>
      {children}
      <ReminderPopup />
    </>
  );
}
