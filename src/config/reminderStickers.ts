import { ImageSourcePropType } from 'react-native';

export type ReminderStickerKey =
  | 'water-pani-pilo'
  | 'water'
  | 'birthday'
  | 'medicine'
  | 'workout'
  | 'bills'
  | 'work'
  | 'stretch'
  | 'travel'
  | 'appointments'
  | 'subscriptions'
  | 'general'
  | 'default';

export interface ReminderStickerConfig {
  key: string;
  label: string;
  emoji: string;
  source: ImageSourcePropType;
  defaultTitle: string;
  defaultBody: string;
}

export const REMINDER_STICKERS: Record<string, ReminderStickerConfig> = {
  'water-pani-pilo': {
    key: 'water-pani-pilo',
    label: 'Paani Pilo!',
    emoji: '💧',
    source: require('../../assets/stickers/water-pani-pilo.webp'),
    defaultTitle: '💧 Paani Pilo!',
    defaultBody: 'Time to drink water and stay hydrated.',
  },
  water: {
    key: 'water-pani-pilo',
    label: 'Paani Pilo!',
    emoji: '💧',
    source: require('../../assets/stickers/water-pani-pilo.webp'),
    defaultTitle: '💧 Paani Pilo!',
    defaultBody: 'Time to drink water and stay hydrated.',
  },
  birthday: {
    key: 'birthday',
    label: 'Celebration',
    emoji: '🎈',
    source: require('../../assets/stickers/birthday.webp'),
    defaultTitle: '🎈 Celebration Reminder',
    defaultBody: 'Do not forget this special moment!',
  },
  medicine: {
    key: 'medicine',
    label: 'Medicine & Health',
    emoji: '💊',
    source: require('../../assets/stickers/medicine.webp'),
    defaultTitle: '💊 Time for Medicine',
    defaultBody: 'Take your scheduled medication.',
  },
  workout: {
    key: 'workout',
    label: 'Workout & Fitness',
    emoji: '⚡',
    source: require('../../assets/stickers/workout.webp'),
    defaultTitle: '⚡ Workout Time',
    defaultBody: 'Get moving and stay active.',
  },
  bills: {
    key: 'bills',
    label: 'Bills & Finance',
    emoji: '💳',
    source: require('../../assets/stickers/bills.webp'),
    defaultTitle: '💳 Bill Due',
    defaultBody: 'Check and pay your pending bill.',
  },
  work: {
    key: 'work',
    label: 'Focus & Work',
    emoji: '💼',
    source: require('../../assets/stickers/work.webp'),
    defaultTitle: '💼 Task Focus',
    defaultBody: 'Time to complete your pending work task.',
  },
  stretch: {
    key: 'stretch',
    label: 'Mind & Movement',
    emoji: '🌸',
    source: require('../../assets/stickers/stretch.webp'),
    defaultTitle: '🌸 Stretch & Reset',
    defaultBody: 'Take a short break to stretch and reset your body.',
  },
  travel: {
    key: 'travel',
    label: 'Travel & Exploration',
    emoji: '✈️',
    source: require('../../assets/stickers/travel.webp'),
    defaultTitle: '✈️ Travel Reminder',
    defaultBody: 'Review your travel itinerary and check your tickets.',
  },
  appointments: {
    key: 'appointments',
    label: 'Appointments',
    emoji: '📅',
    source: require('../../assets/stickers/appointments.webp'),
    defaultTitle: '📅 Upcoming Appointment',
    defaultBody: 'You have an appointment coming up shortly.',
  },
  subscriptions: {
    key: 'subscriptions',
    label: 'Subscriptions & Renewals',
    emoji: '🔄',
    source: require('../../assets/stickers/subscriptions.webp'),
    defaultTitle: '🔄 Subscription Due',
    defaultBody: 'Check your upcoming renewal and billing details.',
  },
  general: {
    key: 'general',
    label: 'General Reminder',
    emoji: '✨',
    source: require('../../assets/stickers/general.webp'),
    defaultTitle: '✨ General Reminder',
    defaultBody: 'You have a scheduled reminder to review.',
  },
  default: {
    key: 'default',
    label: 'Reminder',
    emoji: '✨',
    source: require('../../assets/stickers/default_sticker.webp'),
    defaultTitle: '✨ Reminder',
    defaultBody: 'You have a scheduled reminder.',
  },
};

/**
 * Resolves the appropriate sticker configuration for a reminder
 * based on its theme/category or text content.
 */
export function resolveReminderSticker(
  theme?: string | null,
  text?: string | null
): ReminderStickerConfig {
  const t = (theme || '').toLowerCase().trim();
  const content = (text || '').toLowerCase().trim();

  // 1. Water / Hydration (Exact Pani-pilo asset preserved)
  if (
    t === 'water' ||
    t === 'water-pani-pilo' ||
    t === 'water_pani_pilo' ||
    content.includes('water') ||
    content.includes('pilo') ||
    content.includes('pani') ||
    content.includes('drink') ||
    content.includes('hydrat')
  ) {
    return REMINDER_STICKERS['water-pani-pilo'];
  }

  // 2. Birthday / Celebration
  if (
    t === 'birthday' ||
    content.includes('birth') ||
    content.includes('anniversary') ||
    content.includes('party') ||
    content.includes('cake') ||
    content.includes('celebrat')
  ) {
    return REMINDER_STICKERS['birthday'];
  }

  // 3. Medicine / Health
  if (
    t === 'medicine' ||
    content.includes('med') ||
    content.includes('health') ||
    content.includes('pill') ||
    content.includes('doctor') ||
    content.includes('clinic') ||
    content.includes('vitamin')
  ) {
    return REMINDER_STICKERS['medicine'];
  }

  // 4. Workout / Fitness
  if (
    t === 'workout' ||
    content.includes('workout') ||
    content.includes('gym') ||
    content.includes('exercise') ||
    content.includes('run') ||
    content.includes('fitness') ||
    content.includes('training')
  ) {
    return REMINDER_STICKERS['workout'];
  }

  // 5. Bills / Finance
  if (
    t === 'bills' ||
    content.includes('bill') ||
    content.includes('finance') ||
    content.includes('money') ||
    content.includes('pay') ||
    content.includes('tax') ||
    content.includes('bank') ||
    content.includes('rent')
  ) {
    return REMINDER_STICKERS['bills'];
  }

  // 6. Work / Productivity
  if (
    t === 'work' ||
    content.includes('work') ||
    content.includes('project') ||
    content.includes('meeting') ||
    content.includes('code') ||
    content.includes('task') ||
    content.includes('email') ||
    content.includes('client')
  ) {
    return REMINDER_STICKERS['work'];
  }

  // 7. Stretch / Movement
  if (
    t === 'stretch' ||
    content.includes('stretch') ||
    content.includes('yoga') ||
    content.includes('walk')
  ) {
    return REMINDER_STICKERS['stretch'];
  }

  // 8. Travel / Vacation
  if (
    t === 'travel' ||
    content.includes('travel') ||
    content.includes('flight') ||
    content.includes('trip') ||
    content.includes('hotel') ||
    content.includes('vacation') ||
    content.includes('airport')
  ) {
    return REMINDER_STICKERS['travel'];
  }

  // 9. Appointments / Calendar
  if (
    t === 'appointments' ||
    t === 'appointment' ||
    content.includes('appoint') ||
    content.includes('calendar') ||
    content.includes('schedule') ||
    content.includes('dentist')
  ) {
    return REMINDER_STICKERS['appointments'];
  }

  // 10. Subscriptions / Renewals
  if (
    t === 'subscriptions' ||
    t === 'subscription' ||
    content.includes('sub') ||
    content.includes('renew') ||
    content.includes('netflix') ||
    content.includes('spotify') ||
    content.includes('membership')
  ) {
    return REMINDER_STICKERS['subscriptions'];
  }

  // 11. General
  if (t === 'general') {
    return REMINDER_STICKERS['general'];
  }

  // Direct key lookup
  if (t in REMINDER_STICKERS) {
    return REMINDER_STICKERS[t];
  }

  // 12. Default Fallback
  return REMINDER_STICKERS['default'];
}
