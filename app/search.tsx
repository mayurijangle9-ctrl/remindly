import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { ReminderCard } from '@/components/ReminderCard';

export default function SearchScreen() {
  const { colors } = useTheme();
  const reminders = useReminderStore((s) => s.reminders);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q)
    );
  }, [query, reminders]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title or notes"
          placeholderTextColor={colors.textSoft}
          autoFocus
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        />
        <ScrollView contentContainerStyle={styles.content}>
          {results.length === 0 && query.trim() ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <TextInput
                editable={false}
                value="No matching reminders found."
                style={{ color: colors.textMuted, fontSize: 15 }}
              />
            </View>
          ) : (
            results.map((r) => (
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    margin: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
});
