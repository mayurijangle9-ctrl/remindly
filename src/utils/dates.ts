import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
  addYears,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import { CustomInterval, Reminder, RepeatType } from '@/types';

export function parseCustomInterval(json: string | null): CustomInterval | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as CustomInterval;
  } catch {
    return null;
  }
}

export function computeNextDue(
  from: Date,
  repeatType: RepeatType,
  repeatJson: string | null,
  referenceNow = new Date()
): Date | null {
  if (repeatType === 'None') return null;

  // Lock target local hour and minute to protect against DST drift
  const targetHour = from.getHours();
  const targetMinute = from.getMinutes();

  let next = new Date(from);
  const nowMs = referenceNow.getTime();

  // Safety counter to prevent runaway loops
  let iterations = 0;
  const maxIterations = 500;

  do {
    iterations++;
    switch (repeatType) {
      case 'Daily':
        next = addDays(next, 1);
        next.setHours(targetHour, targetMinute, 0, 0);
        break;
      case 'Weekly':
        next = addWeeks(next, 1);
        next.setHours(targetHour, targetMinute, 0, 0);
        break;
      case 'Monthly':
        next = addMonths(next, 1);
        next.setHours(targetHour, targetMinute, 0, 0);
        break;
      case 'Yearly':
        next = addYears(next, 1);
        next.setHours(targetHour, targetMinute, 0, 0);
        break;
      case 'CustomInterval': {
        const interval = parseCustomInterval(repeatJson);
        if (!interval || interval.every <= 0) return null;
        if (interval.unit === 'minutes') {
          next = addMinutes(next, interval.every);
        } else if (interval.unit === 'hours') {
          next = addHours(next, interval.every);
        } else {
          next = addDays(next, interval.every);
          next.setHours(targetHour, targetMinute, 0, 0);
        }
        break;
      }
      default:
        return null;
    }
  } while (next.getTime() <= nowMs && iterations < maxIterations);

  return next;
}

export function snoozeFromNow(minutes: number): Date {
  return addMinutes(new Date(), minutes);
}

export function isDueToday(reminder: Reminder, now = new Date()): boolean {
  return isSameDay(parseISO(reminder.dueAt), now);
}

export function isOverdue(reminder: Reminder, now = new Date()): boolean {
  if (reminder.status !== 'active') return false;
  return isBefore(parseISO(reminder.dueAt), now);
}

export function groupByDate(reminders: Reminder[]): Record<string, Reminder[]> {
  return reminders.reduce<Record<string, Reminder[]>>((acc, item) => {
    const key = startOfDay(parseISO(item.dueAt)).toISOString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function combineDateAndTime(date: Date, timeHHmm: string): Date {
  const [h, m] = timeHHmm.split(':').map(Number);
  const next = new Date(date);
  next.setHours(h || 0, m || 0, 0, 0);
  return next;
}
