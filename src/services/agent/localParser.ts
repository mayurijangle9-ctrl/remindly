import { addDays, addHours, nextMonday, setHours, setMinutes } from 'date-fns';
import { ReminderDraft } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/seed';

const CATEGORY_ALIASES: Record<string, string> = {
  water: 'cat-water',
  drink: 'cat-water',
  stretch: 'cat-stretch',
  bill: 'cat-bills',
  finance: 'cat-bills',
  medicine: 'cat-health',
  medication: 'cat-health',
  health: 'cat-health',
  doctor: 'cat-health',
  appointment: 'cat-appointments',
  dentist: 'cat-appointments',
  clinic: 'cat-appointments',
  meeting: 'cat-appointments',
  birthday: 'cat-birthdays',
  anniversary: 'cat-birthdays',
  subscription: 'cat-subscriptions',
  car: 'cat-vehicle',
  home: 'cat-vehicle',
  work: 'cat-work',
  travel: 'cat-travel',
  flight: 'cat-travel',
};

function findCategoryId(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [alias, id] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(alias)) return id;
  }
  return undefined;
}

function parsePriority(text: string): ReminderDraft['priority'] {
  const lower = text.toLowerCase();
  if (lower.includes('high priority') || lower.includes('urgent')) return 'High';
  if (lower.includes('low priority')) return 'Low';
  return 'Medium';
}

function defaultTimeToday(hour = 9, minute = 0) {
  const d = new Date();
  return setMinutes(setHours(d, hour), minute);
}

/**
 * Sanitizes natural language input:
 * - Normalizes Unicode (NFKD)
 * - Strips zero-width/control characters
 * - Enforces max length (500 chars) to prevent ReDoS
 * - Trims trailing punctuation
 */
export function sanitizeInput(input: string | unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF\x00-\x1F]/g, '')
    .slice(0, 500)
    .trim()
    .replace(/[.,!?;:]+$/, '');
}

/**
 * Deterministic local NL parser so Expo Go works without an API key.
 * Hardened against malformed inputs and exotic unicode.
 */
export function parseNaturalLanguage(input: string): ReminderDraft {
  const text = sanitizeInput(input);
  if (!text) {
    return {
      title: 'New reminder',
      categoryId: 'cat-work',
      priority: 'Medium',
      repeatType: 'None',
      dueAt: addHours(new Date(), 1).toISOString(),
    };
  }

  const lower = text.toLowerCase();
  const categoryId = findCategoryId(lower);
  const category = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  const priority = parsePriority(lower);

  let title = text
    .replace(/^remind me to\s+/i, '')
    .replace(/^remind me\s+/i, '')
    .replace(/\bevery\s+\d+\s+(minutes?|hours?|days?)\b/gi, '')
    .replace(/\b(next monday|tomorrow|today|high priority|low priority|urgent)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .trim()
    .replace(/[.,!?;:]+$/, '');

  if (!title) title = category?.name || 'New reminder';

  const draft: ReminderDraft = {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    categoryId: categoryId || 'cat-work',
    categoryName: category?.name,
    priority,
    notes: `Created from: "${text}"`,
  };

  const everyMatch = lower.match(/every\s+(\d+)\s+(minutes?|hours?|days?)/);
  if (everyMatch) {
    const every = Number(everyMatch[1]);
    const unitRaw = everyMatch[2];
    const unit = unitRaw.startsWith('minute')
      ? 'minutes'
      : unitRaw.startsWith('hour')
        ? 'hours'
        : 'days';
    draft.repeatType = 'CustomInterval';
    draft.customInterval = { every, unit };
    draft.dueAt = addHours(new Date(), unit === 'hours' ? every : 0).toISOString();
    if (unit === 'minutes') draft.dueAt = new Date(Date.now() + every * 60_000).toISOString();
    if (unit === 'days') draft.dueAt = addDays(new Date(), every).toISOString();
  } else if (lower.includes('daily') || lower.includes('every day')) {
    draft.repeatType = 'Daily';
    draft.dueAt = defaultTimeToday(9).toISOString();
  } else if (lower.includes('weekly') || lower.includes('every week')) {
    draft.repeatType = 'Weekly';
    draft.dueAt = defaultTimeToday(9).toISOString();
  } else if (lower.includes('monthly')) {
    draft.repeatType = 'Monthly';
    draft.dueAt = defaultTimeToday(9).toISOString();
  } else if (lower.includes('yearly') || lower.includes('every year')) {
    draft.repeatType = 'Yearly';
    draft.dueAt = defaultTimeToday(9).toISOString();
  } else {
    draft.repeatType = 'None';
  }

  if (!draft.dueAt) {
    if (lower.includes('tomorrow')) {
      draft.dueAt = addDays(defaultTimeToday(9), 1).toISOString();
    } else if (lower.includes('next monday')) {
      draft.dueAt = setMinutes(setHours(nextMonday(new Date()), 10), 0).toISOString();
    } else if (lower.includes('today')) {
      draft.dueAt = addHours(new Date(), 1).toISOString();
    } else {
      draft.dueAt = addHours(new Date(), 1).toISOString();
    }
  }

  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch && draft.dueAt) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const d = new Date(draft.dueAt);
    d.setHours(hour, minute, 0, 0);
    draft.dueAt = d.toISOString();
  }

  if (categoryId === 'cat-water') draft.stickerId = 'stk-water';
  if (categoryId === 'cat-stretch') draft.stickerId = 'stk-stretch';

  return draft;
}

export interface LocalConfidenceResult {
  confidence: number;
  confidenceLevel: 'high' | 'low';
  isLowConfidence: boolean;
  reasons: string[];
}

/**
 * Assesses whether the deterministic regex parser had sufficient keywords/structure
 * to reliably parse the user's intent. If low confidence, Remindly routes to Gemini API.
 */
export function assessLocalConfidence(input: string): LocalConfidenceResult {
  const text = sanitizeInput(input);
  if (!text) {
    return {
      confidence: 0,
      confidenceLevel: 'low',
      isLowConfidence: true,
      reasons: ['Input is empty.'],
    };
  }
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let score = 1.0;

  // 1. Category check
  const catId = findCategoryId(lower);
  if (!catId) {
    score -= 0.35;
    reasons.push('No known category keywords detected; defaulted to Work.');
  }

  // 2. Complex dates/relative expressions unsupported by local regex
  const complexExpressions = [
    /\b(next\s+)?(tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(in|after)\s+\d+\s+(weeks?|months?|days?|hours?)\b/i,
    /\b(end of|middle of)\s+(the\s+)?(week|month|year|day)\b/i,
    /\b(tonight|this evening|this afternoon|noon)\b/i,
    /\b(bi-?weekly|fortnightly|quarterly|alternate)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b\d{1,2}(st|nd|rd|th)\b/i,
  ];

  for (const expr of complexExpressions) {
    if (expr.test(lower)) {
      score -= 0.4;
      reasons.push('Contains relative temporal expressions beyond local regex rules.');
      break;
    }
  }

  // 3. Explicit time or date expression
  const hasTime = /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(lower);
  const hasKnownDate = /\b(today|tomorrow|next monday)\b/i.test(lower);
  const hasRecurrence =
    /\bevery\s+\d+\s+(minutes?|hours?|days?)\b/i.test(lower) ||
    /\b(daily|every day|weekly|every week|monthly|yearly)\b/i.test(lower);

  if (!hasTime && !hasKnownDate && !hasRecurrence) {
    score -= 0.25;
    reasons.push('No explicit date, time, or repeat expression found; defaulted to 1h from now.');
  }

  const finalConfidence = Math.max(0, Math.min(1, score));
  return {
    confidence: Number(finalConfidence.toFixed(2)),
    confidenceLevel: finalConfidence >= 0.7 ? 'high' : 'low',
    isLowConfidence: finalConfidence < 0.7,
    reasons,
  };
}

