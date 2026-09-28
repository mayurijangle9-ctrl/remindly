import { isSameDay, parseISO } from 'date-fns';
import { DailyBrief, Reminder } from '@/types';

export function buildDailyBrief(reminders: Reminder[]): DailyBrief {
  const now = new Date();
  const active = reminders.filter((r) => r.status === 'active');
  const dueToday = active.filter((r) => isSameDay(parseISO(r.dueAt), now));
  const overdue = active.filter((r) => parseISO(r.dueAt).getTime() < now.getTime());
  const highPriority = dueToday.filter((r) => r.priority === 'High');
  const nextUpcoming = [...active]
    .filter((r) => parseISO(r.dueAt).getTime() >= now.getTime())
    .sort((a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt))
    .slice(0, 3);

  let tip = 'Your day looks calm — a good moment to add a healthy habit.';
  if (overdue.length > 0) {
    tip = `You have ${overdue.length} overdue item${overdue.length > 1 ? 's' : ''}. Clear one now to reset momentum.`;
  } else if (highPriority.length > 0) {
    tip = `You have ${highPriority.length} high-priority reminder${highPriority.length > 1 ? 's' : ''} today — tackle those first.`;
  } else if (dueToday.length > 3) {
    tip = 'Busy day ahead. Batch similar reminders and protect a short break.';
  }

  return {
    dueToday: dueToday.length,
    overdue: overdue.length,
    highPriority: highPriority.length,
    nextUpcoming,
    tip,
    generatedAt: now.toISOString(),
  };
}
