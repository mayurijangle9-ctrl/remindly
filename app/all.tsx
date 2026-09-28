import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { parseISO } from 'date-fns';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { ReminderCard } from '@/components/ReminderCard';
import { Priority, ReminderStatus } from '@/types';

export default function AllRemindersScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const reminders = useReminderStore((s) => s.reminders);
  const categories = useReminderStore((s) => s.categories);

  const [categoryId, setCategoryId] = useState(params.categoryId || 'all');
  const [priority, setPriority] = useState<'all' | Priority>('all');
  const [status, setStatus] = useState<'all' | ReminderStatus>('active');

  const filtered = useMemo(() => {
    return reminders
      .filter((r) => (categoryId === 'all' ? true : r.categoryId === categoryId))
      .filter((r) => (priority === 'all' ? true : r.priority === priority))
      .filter((r) => (status === 'all' ? true : r.status === status))
      .sort((a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt));
  }, [reminders, categoryId, priority, status]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalFilters}
        >
          <FilterChip
            label="All cats"
            active={categoryId === 'all'}
            onPress={() => setCategoryId('all')}
          />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ScrollView>
        <View style={styles.filters}>
          {(['all', 'Low', 'Medium', 'High'] as const).map((p) => (
            <FilterChip
              key={p}
              label={p}
              active={priority === p}
              onPress={() => setPriority(p)}
            />
          ))}
        </View>
        <View style={styles.filters}>
          {(['all', 'active', 'completed'] as const).map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {filtered.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>
              No reminders match this filter.
            </Text>
          ) : (
            filtered.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onPress={() => router.push(`/reminder/${r.id}`)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primarySoft : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  horizontalFilters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    gap: 8,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  content: { padding: spacing.lg, paddingBottom: 40 },
});
