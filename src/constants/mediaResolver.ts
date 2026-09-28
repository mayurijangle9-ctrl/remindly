/**
 * REMINDLY MEDIA & THEME RESOLVER
 *
 * Maps reminder categories, stickers, and natural language titles
 * into curated aesthetic visual tokens and particle palettes for
 * the Premium Anti-Gravity particle engine.
 */

export type AntiGravityTheme =
  | 'water'
  | 'birthday'
  | 'medicine'
  | 'workout'
  | 'default'
  | 'bills'
  | 'work'
  | 'stretch'
  | 'travel'
  | 'appointments'
  | 'subscriptions'
  | 'general';

export interface ThemeVisualConfig {
  theme: AntiGravityTheme;
  symbols: string[];
  accentColor: string;
  glowColor: string;
  label: string;
}

export const THEME_REGISTRY: Record<AntiGravityTheme, ThemeVisualConfig> = {
  water: {
    theme: 'water',
    label: 'Hydration',
    symbols: ['💧', '🫧', '✨'],
    accentColor: '#3D9ECD',
    glowColor: 'rgba(61, 158, 205, 0.4)',
  },
  birthday: {
    theme: 'birthday',
    label: 'Celebration',
    symbols: ['🎈', '✨', '🤍'],
    accentColor: '#C97B9B',
    glowColor: 'rgba(201, 123, 155, 0.4)',
  },
  medicine: {
    theme: 'medicine',
    label: 'Health & Wellness',
    symbols: ['💊', '✨', '🤍'],
    accentColor: '#C45B7A',
    glowColor: 'rgba(196, 91, 122, 0.4)',
  },
  workout: {
    theme: 'workout',
    label: 'Fitness & Energy',
    symbols: ['✦', '⚡', '✨'],
    accentColor: '#5BA88A',
    glowColor: 'rgba(91, 168, 138, 0.4)',
  },
  default: {
    theme: 'default',
    label: 'Standard',
    symbols: ['✦', '✨', '🤍'],
    accentColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
  bills: {
    theme: 'bills',
    label: 'Finance & Bills',
    symbols: ['💳', '✨', '✦'],
    accentColor: '#5B8C5A',
    glowColor: 'rgba(91, 140, 90, 0.4)',
  },
  work: {
    theme: 'work',
    label: 'Focus & Productivity',
    symbols: ['💼', '⚡', '✨'],
    accentColor: '#4A6FA5',
    glowColor: 'rgba(74, 111, 165, 0.4)',
  },
  stretch: {
    theme: 'stretch',
    label: 'Mind & Movement',
    symbols: ['🌸', '🍃', '✨'],
    accentColor: '#5BA88A',
    glowColor: 'rgba(91, 168, 138, 0.4)',
  },
  travel: {
    theme: 'travel',
    label: 'Travel & Exploration',
    symbols: ['✈️', '🌟', '✨'],
    accentColor: '#D4A017',
    glowColor: 'rgba(212, 160, 23, 0.4)',
  },
  appointments: {
    theme: 'appointments',
    label: 'Appointments',
    symbols: ['📅', '⭐', '✨'],
    accentColor: '#3D7EA6',
    glowColor: 'rgba(61, 126, 166, 0.4)',
  },
  subscriptions: {
    theme: 'subscriptions',
    label: 'Subscriptions & Renewals',
    symbols: ['🔄', '💫', '✨'],
    accentColor: '#6B7FD7',
    glowColor: 'rgba(107, 127, 215, 0.4)',
  },
  general: {
    theme: 'general',
    label: 'Standard',
    symbols: ['✦', '✨', '🤍'],
    accentColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
};

/**
 * Intelligently classifies any reminder or category query into a theme visual config.
 */
export function resolveTheme(query?: string | null): ThemeVisualConfig {
  if (!query) return THEME_REGISTRY.default;

  const q = query.toLowerCase().trim();

  if (q.includes('water') || q.includes('drink') || q.includes('hydrat')) {
    return THEME_REGISTRY.water;
  }
  if (
    q.includes('birth') ||
    q.includes('anniversary') ||
    q.includes('party') ||
    q.includes('cake') ||
    q.includes('celebrat')
  ) {
    return THEME_REGISTRY.birthday;
  }
  if (
    q.includes('med') ||
    q.includes('health') ||
    q.includes('pill') ||
    q.includes('doctor') ||
    q.includes('clinic') ||
    q.includes('vitamin')
  ) {
    return THEME_REGISTRY.medicine;
  }
  if (
    q.includes('workout') ||
    q.includes('gym') ||
    q.includes('exercise') ||
    q.includes('run') ||
    q.includes('fitness') ||
    q.includes('training')
  ) {
    return THEME_REGISTRY.workout;
  }
  if (
    q.includes('bill') ||
    q.includes('finance') ||
    q.includes('money') ||
    q.includes('pay') ||
    q.includes('tax') ||
    q.includes('bank') ||
    q.includes('rent')
  ) {
    return THEME_REGISTRY.bills;
  }
  if (
    q.includes('work') ||
    q.includes('project') ||
    q.includes('meeting') ||
    q.includes('code') ||
    q.includes('task') ||
    q.includes('email') ||
    q.includes('client')
  ) {
    return THEME_REGISTRY.work;
  }
  if (q.includes('stretch') || q.includes('yoga') || q.includes('walk')) {
    return THEME_REGISTRY.stretch;
  }
  if (
    q.includes('travel') ||
    q.includes('flight') ||
    q.includes('trip') ||
    q.includes('hotel') ||
    q.includes('vacation') ||
    q.includes('airport')
  ) {
    return THEME_REGISTRY.travel;
  }
  if (
    q.includes('appoint') ||
    q.includes('calendar') ||
    q.includes('schedule') ||
    q.includes('dentist')
  ) {
    return THEME_REGISTRY.appointments;
  }
  if (
    q.includes('sub') ||
    q.includes('renew') ||
    q.includes('netflix') ||
    q.includes('spotify') ||
    q.includes('membership')
  ) {
    return THEME_REGISTRY.subscriptions;
  }

  if (q in THEME_REGISTRY) {
    return THEME_REGISTRY[q as AntiGravityTheme];
  }

  return THEME_REGISTRY.default;
}
