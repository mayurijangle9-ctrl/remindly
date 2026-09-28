import { AgentSuggestion, Category, Reminder } from '@/types';
import { addHours } from 'date-fns';

export function buildSuggestions(
  reminders: Reminder[],
  categories: Category[]
): AgentSuggestion[] {
  const suggestions: AgentSuggestion[] = [];
  const active = reminders.filter((r) => r.status === 'active');
  const hasWater = active.some((r) => r.categoryId === 'cat-water');
  const hasStretch = active.some((r) => r.categoryId === 'cat-stretch');
  const overdue = active.filter((r) => new Date(r.dueAt).getTime() < Date.now());

  if (!hasWater) {
    suggestions.push({
      id: 'sug-water',
      title: 'Start Drink Water habit',
      reason: 'No active water reminder yet — hydrate every 2 hours.',
      draft: {
        title: 'Drink Water',
        categoryId: 'cat-water',
        priority: 'Medium',
        repeatType: 'CustomInterval',
        customInterval: { every: 2, unit: 'hours' },
        dueAt: addHours(new Date(), 1).toISOString(),
        stickerId: 'stk-water',
      },
    });
  }

  if (!hasStretch) {
    suggestions.push({
      id: 'sug-stretch',
      title: 'Add Stretch breaks',
      reason: 'A light stretch reminder keeps your day healthier.',
      draft: {
        title: 'Stretch',
        categoryId: 'cat-stretch',
        priority: 'Low',
        repeatType: 'CustomInterval',
        customInterval: { every: 2, unit: 'hours' },
        dueAt: addHours(new Date(), 2).toISOString(),
        stickerId: 'stk-stretch',
      },
    });
  }

  if (overdue.length > 0) {
    const first = overdue[0];
    suggestions.push({
      id: `sug-overdue-${first.id}`,
      title: `Reschedule “${first.title}”`,
      reason: 'This reminder is overdue. Move it an hour from now?',
      draft: {
        title: first.title,
        notes: first.notes,
        categoryId: first.categoryId,
        priority: first.priority,
        repeatType: first.repeatType,
        dueAt: addHours(new Date(), 1).toISOString(),
        stickerId: first.stickerId || undefined,
      },
    });
  }

  const birthdayCat = categories.find((c) => c.id === 'cat-birthdays');
  const hasBirthday = active.some((r) => r.categoryId === 'cat-birthdays');
  if (birthdayCat && !hasBirthday) {
    suggestions.push({
      id: 'sug-birthday',
      title: 'Capture an upcoming birthday',
      reason: 'Birthdays & Anniversaries is empty — add one before you forget.',
      draft: {
        title: 'Birthday reminder',
        categoryId: 'cat-birthdays',
        priority: 'Medium',
        repeatType: 'Yearly',
        dueAt: addHours(new Date(), 24).toISOString(),
        stickerId: 'stk-birthdays',
      },
    });
  }

  return suggestions.slice(0, 4);
}
