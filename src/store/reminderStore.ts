import { create } from 'zustand';
import {
  Category,
  CustomInterval,
  Reminder,
  ReminderDraft,
  SnoozeOption,
  Sticker,
  AgentSuggestion,
  DailyBrief,
} from '@/types';
import * as repo from '@/db/repositories';
import {
  cancelReminderNotifications,
  cancelReminderOverlay,
  scheduleReminderNotification,
} from '@/services/notifications';
import { computeNextDue, snoozeFromNow } from '@/utils/dates';
import {
  buildDailyBrief,
  buildSuggestions,
  parseNaturalLanguage,
  parseWithHybridFallback,
} from '@/services/agent';
import { createId } from '@/utils/id';

type ReminderState = {
  ready: boolean;
  reminders: Reminder[];
  categories: Category[];
  stickers: Sticker[];
  suggestions: AgentSuggestion[];
  brief: DailyBrief | null;
  activePopupId: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  createFromDraft: (draft: ReminderDraft) => Promise<Reminder>;
  updateReminder: (reminder: Reminder) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  snoozeReminder: (id: string, minutes: SnoozeOption) => Promise<void>;
  parseAgentInput: (input: string) => Promise<ReminderDraft>;
  setActivePopup: (id: string | null) => void;
};

function defaultStickerForCategory(categoryId: string, stickers: Sticker[]) {
  return stickers.find((s) => s.categoryId === categoryId)?.id || 'stk-bell';
}

function stickerEmojiForReminder(reminder: Reminder, stickers: Sticker[]) {
  return stickers.find((sticker) => sticker.id === reminder.stickerId)?.emoji;
}

const inFlightOperations = new Set<string>();

export const useReminderStore = create<ReminderState>((set, get) => ({
  ready: false,
  reminders: [],
  categories: [],
  stickers: [],
  suggestions: [],
  brief: null,
  activePopupId: null,

  bootstrap: async () => {
    await get().refresh();
    set({ ready: true });
  },

  refresh: async () => {
    const [reminders, categories, stickers] = await Promise.all([
      repo.listReminders(),
      repo.listCategories(),
      repo.listStickers(),
    ]);
    set({
      reminders,
      categories,
      stickers,
      suggestions: buildSuggestions(reminders, categories),
      brief: buildDailyBrief(reminders),
    });
  },

  createFromDraft: async (draft) => {
    const now = new Date().toISOString();
    const stickers = get().stickers;
    const reminder: Reminder = {
      id: createId(),
      title: draft.title.trim(),
      notes: draft.notes || '',
      dueAt: draft.dueAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      categoryId: draft.categoryId || 'cat-work',
      priority: draft.priority || 'Medium',
      repeatType: draft.repeatType || 'None',
      repeatJson: draft.customInterval
        ? JSON.stringify(draft.customInterval)
        : null,
      status: 'active',
      imageType: 'sticker',
      stickerId:
        draft.stickerId ||
        defaultStickerForCategory(draft.categoryId || 'cat-work', stickers),
      customImageUri: null,
      notificationIdsJson: '[]',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      timeZone: draft.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const ids = await scheduleReminderNotification(
      reminder,
      undefined,
      stickerEmojiForReminder(reminder, stickers)
    );
    reminder.notificationIdsJson = JSON.stringify(ids);
    await repo.upsertReminder(reminder);
    await get().refresh();
    return reminder;
  },

  updateReminder: async (reminder) => {
    await cancelReminderNotifications(reminder.notificationIdsJson);
    void cancelReminderOverlay(reminder.id);
    const ids =
      reminder.status === 'active'
        ? await scheduleReminderNotification(
            reminder,
            undefined,
            stickerEmojiForReminder(reminder, get().stickers)
          )
        : [];
    const next = {
      ...reminder,
      notificationIdsJson: JSON.stringify(ids),
      updatedAt: new Date().toISOString(),
    };
    await repo.upsertReminder(next);
    await get().refresh();
  },

  completeReminder: async (id) => {
    if (inFlightOperations.has(id)) return;
    inFlightOperations.add(id);

    const previousReminders = get().reminders;
    const current = previousReminders.find((r) => r.id === id);
    if (!current) {
      inFlightOperations.delete(id);
      return;
    }

    const nextDue = computeNextDue(
      new Date(current.dueAt),
      current.repeatType,
      current.repeatJson
    );

    let updatedReminder: Reminder;
    if (nextDue && current.repeatType !== 'None') {
      updatedReminder = {
        ...current,
        dueAt: nextDue.toISOString(),
        status: 'active',
        completedAt: null,
        updatedAt: new Date().toISOString(),
        notificationIdsJson: '[]',
      };
    } else {
      updatedReminder = {
        ...current,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationIdsJson: '[]',
      };
    }

    // Optimistic UI transition (<16ms)
    const optimisticReminders = previousReminders.map((r) =>
      r.id === id ? updatedReminder : r
    );
    set({
      reminders: optimisticReminders,
      activePopupId: get().activePopupId === id ? null : get().activePopupId,
      brief: buildDailyBrief(optimisticReminders),
      suggestions: buildSuggestions(optimisticReminders, get().categories),
    });

    try {
      await cancelReminderNotifications(current.notificationIdsJson);
      void cancelReminderOverlay(current.id);

      if (updatedReminder.status === 'active') {
        const ids = await scheduleReminderNotification(
          updatedReminder,
          undefined,
          stickerEmojiForReminder(updatedReminder, get().stickers)
        );
        updatedReminder.notificationIdsJson = JSON.stringify(ids);
      }

      await repo.upsertReminder(updatedReminder);
    } catch (err) {
      // Rollback on database or background failure
      if (__DEV__) console.warn('[reminderStore] completeReminder failed; rolling back:', err);
      set({
        reminders: previousReminders,
        brief: buildDailyBrief(previousReminders),
        suggestions: buildSuggestions(previousReminders, get().categories),
      });
    } finally {
      inFlightOperations.delete(id);
    }
  },

  deleteReminder: async (id) => {
    if (inFlightOperations.has(id)) return;
    inFlightOperations.add(id);

    const previousReminders = get().reminders;
    const current = previousReminders.find((r) => r.id === id);
    if (!current) {
      inFlightOperations.delete(id);
      return;
    }

    // Optimistic UI transition (<16ms)
    const optimisticReminders = previousReminders.filter((r) => r.id !== id);
    set({
      reminders: optimisticReminders,
      activePopupId: get().activePopupId === id ? null : get().activePopupId,
      brief: buildDailyBrief(optimisticReminders),
      suggestions: buildSuggestions(optimisticReminders, get().categories),
    });

    try {
      await cancelReminderNotifications(current.notificationIdsJson);
      void cancelReminderOverlay(current.id);
      await repo.deleteReminder(id);
    } catch (err) {
      // Rollback on database failure
      if (__DEV__) console.warn('[reminderStore] deleteReminder failed; rolling back:', err);
      set({
        reminders: previousReminders,
        brief: buildDailyBrief(previousReminders),
        suggestions: buildSuggestions(previousReminders, get().categories),
      });
    } finally {
      inFlightOperations.delete(id);
    }
  },

  snoozeReminder: async (id, minutes) => {
    const current = get().reminders.find((r) => r.id === id);
    if (!current) return;
    await cancelReminderNotifications(current.notificationIdsJson);
    void cancelReminderOverlay(current.id);
    const snoozed: Reminder = {
      ...current,
      dueAt: snoozeFromNow(minutes).toISOString(),
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    const ids = await scheduleReminderNotification(
      snoozed,
      `Snoozed ${minutes} min`,
      stickerEmojiForReminder(snoozed, get().stickers)
    );
    snoozed.notificationIdsJson = JSON.stringify(ids);
    await repo.upsertReminder(snoozed);
    set({ activePopupId: null });
    await get().refresh();
  },

  parseAgentInput: async (input) => {
    const result = await parseWithHybridFallback(input);
    await repo.logAgentEvent(
      createId(),
      'nl_parse',
      { input, source: result.source, confidence: result.confidence },
      result.draft
    );
    return result.draft;
  },

  setActivePopup: (id) => set({ activePopupId: id }),
}));

export function draftFromCategoryDefaults(
  category: Category,
  stickers: Sticker[]
): ReminderDraft {
  let customInterval: CustomInterval | undefined;
  let repeatType: ReminderDraft['repeatType'] = 'None';
  if (category.defaultRepeatJson) {
    customInterval = JSON.parse(category.defaultRepeatJson) as CustomInterval;
    repeatType = 'CustomInterval';
  }
  return {
    title: category.name,
    categoryId: category.id,
    priority: 'Medium',
    repeatType,
    customInterval,
    dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    stickerId: stickers.find((s) => s.categoryId === category.id)?.id,
  };
}

