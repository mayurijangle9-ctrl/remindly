import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

const LINKING_ERROR =
  `The package 'ReminderOverlay' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

interface NativeReminderOverlayInterface {
  canDrawOverlays(): Promise<boolean>;
  openOverlaySettings(): Promise<boolean>;
  scheduleOverlay(
    reminderId: string,
    title: string,
    body: string,
    theme: string,
    stickerKey: string,
    dueAtIso: string,
    triggerAtMs: number
  ): Promise<boolean>;
  cancelOverlay(reminderId: string): Promise<boolean>;
  showReminder(
    reminderId: string,
    title: string,
    body: string,
    theme: string,
    stickerKey: string
  ): Promise<boolean>;
  dismissReminder(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const NativeReminderOverlay: NativeReminderOverlayInterface | null =
  Platform.OS === 'android'
    ? NativeModules.ReminderOverlay ||
      new Proxy(
        {},
        {
          get() {
            return () => Promise.resolve(false);
          },
        }
      )
    : null;

const eventEmitter =
  Platform.OS === 'android' && NativeModules.ReminderOverlay
    ? new NativeEventEmitter(NativeModules.ReminderOverlay)
    : null;

export interface OverlayDoneEvent {
  reminderId: string;
}

export interface OverlaySnoozeEvent {
  reminderId: string;
}

export interface ScheduleOverlayParams {
  reminderId: string;
  title: string;
  body: string;
  theme: string;
  stickerKey: string;
  dueAtIso: string;
  triggerAtMs: number;
}

export interface ShowOverlayParams {
  reminderId: string;
  title: string;
  body: string;
  theme: string;
  stickerKey: string;
}

export const ReminderOverlay = {
  /**
   * Checks if Android SYSTEM_ALERT_WINDOW permission is granted.
   * Returns false on iOS/web.
   */
  async canDrawOverlays(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.canDrawOverlays();
    } catch {
      return false;
    }
  },

  /**
   * Opens the system settings screen for "Display over other apps".
   * Safe no-op on non-Android platforms.
   */
  async openOverlaySettings(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.openOverlaySettings();
    } catch {
      return false;
    }
  },

  /**
   * Schedules a native exact alarm to trigger the floating overlay when due.
   */
  async scheduleOverlay(params: ScheduleOverlayParams): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.scheduleOverlay(
        params.reminderId,
        params.title,
        params.body,
        params.theme,
        params.stickerKey,
        params.dueAtIso,
        params.triggerAtMs
      );
    } catch {
      return false;
    }
  },

  /**
   * Cancels any pending overlay alarm for a reminder.
   */
  async cancelOverlay(reminderId: string): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.cancelOverlay(reminderId);
    } catch {
      return false;
    }
  },

  /**
   * Immediately displays the floating reminder overlay (used for test triggers).
   */
  async showReminder(params: ShowOverlayParams): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.showReminder(
        params.reminderId,
        params.title,
        params.body,
        params.theme,
        params.stickerKey
      );
    } catch {
      return false;
    }
  },

  /**
   * Immediately dismisses any active floating reminder overlay.
   */
  async dismissReminder(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeReminderOverlay) {
      return false;
    }
    try {
      return await NativeReminderOverlay.dismissReminder();
    } catch {
      return false;
    }
  },

  /**
   * Subscribes to the Done action dispatched from the floating overlay.
   */
  addOverlayDoneListener(
    listener: (event: OverlayDoneEvent) => void
  ): EmitterSubscription | null {
    if (!eventEmitter) return null;
    return eventEmitter.addListener('onOverlayDone', listener);
  },

  /**
   * Subscribes to the Snooze action dispatched from the floating overlay.
   */
  addOverlaySnoozeListener(
    listener: (event: OverlaySnoozeEvent) => void
  ): EmitterSubscription | null {
    if (!eventEmitter) return null;
    return eventEmitter.addListener('onOverlaySnooze', listener);
  },
};
