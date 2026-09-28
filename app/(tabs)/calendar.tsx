import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { SectionTitle } from '@/components/SoftCard';
import { ReminderCard } from '@/components/ReminderCard';
import { groupByDate } from '@/utils/dates';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const reminders = useReminderStore((s) => s.reminders);

  const groups = useMemo(() => {
    const active = reminders
      .filter((r) => r.status === 'active')
      .sort((a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt));
    return Object.entries(groupByDate(active)).sort(([a], [b]) => +new Date(a) - +new Date(b));
  }, [reminders]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Upcoming" subtitle="Agenda grouped by date" />
        {groups.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No upcoming reminders yet.</Text>
        ) : (
          groups.map(([day, items]) => (
            <View key={day} style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.day, { color: colors.primary }]}>
                {format(parseISO(day), 'EEEE, MMM d')}
              </Text>
              {items.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onPress={() => router.push(`/reminder/${r.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  day: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
});
