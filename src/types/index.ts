export type Priority = 'Low' | 'Medium' | 'High';
export type ReminderStatus = 'active' | 'completed' | 'archived';
export type RepeatType = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'CustomInterval';
export type IntervalUnit = 'minutes' | 'hours' | 'days';
export type ImageType = 'sticker' | 'custom';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface CustomInterval {
  every: number;
  unit: IntervalUnit;
}

export interface Category {
  id: string;
  name: string;
  stickerSetId: string;
  color: string;
  defaultRepeatJson: string | null;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  categoryId: string | null;
  name: string;
  assetKey: string;
  emoji: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  categoryId: string;
  priority: Priority;
  repeatType: RepeatType;
  repeatJson: string | null;
  status: ReminderStatus;
  imageType: ImageType;
  stickerId: string | null;
  customImageUri: string | null;
  notificationIdsJson: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  timeZone?: string;
}

export interface ReminderDraft {
  title: string;
  notes?: string;
  dueAt?: string;
  categoryId?: string;
  categoryName?: string;
  priority?: Priority;
  repeatType?: RepeatType;
  customInterval?: CustomInterval;
  stickerId?: string;
  timeZone?: string;
}

export interface AppSettings {
  theme: ThemePreference;
  defaultReminderTime: string;
  defaultSnoozeMinutes: number;
  notificationSound: string;
  enableNlCreate: boolean;
  enableSuggestions: boolean;
  enableDailyBrief: boolean;
  onboardingDone: boolean;
  geminiApiKey?: string;
}

export interface AgentSuggestion {
  id: string;
  title: string;
  reason: string;
  draft: ReminderDraft;
}

export interface DailyBrief {
  dueToday: number;
  overdue: number;
  highPriority: number;
  nextUpcoming: Reminder[];
  tip: string;
  generatedAt: string;
}

export interface AgentEvent {
  id: string;
  type: string;
  inputJson: string;
  outputJson: string;
  createdAt: string;
}

export type SnoozeOption = 5 | 60 | 1440;
