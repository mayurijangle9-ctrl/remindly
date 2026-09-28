import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SoftButton } from '@/components/SoftButton';
import { StickerPicker } from '@/components/StickerPicker';
import { DateTimePickerField } from '@/components/DateTimePickerField';
import { Priority, RepeatType } from '@/types';

export default function EditReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const reminders = useReminderStore((s) => s.reminders);
  const stickers = useReminderStore((s) => s.stickers);
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const deleteReminder = useReminderStore((s) => s.deleteReminder);
  const completeReminder = useReminderStore((s) => s.completeReminder);
  const snoozeReminder = useReminderStore((s) => s.snoozeReminder);

  const existing = reminders.find((r) => r.id === id);

  const [title, setTitle] = useState(existing?.title || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [dueDate, setDueDate] = useState<Date>(() =>
    existing ? parseISO(existing.dueAt) : new Date()
  );
  const [priority, setPriority] = useState<Priority>(existing?.priority || 'Medium');
  const [repeatType, setRepeatType] = useState<RepeatType>(existing?.repeatType || 'None');
  const [stickerId, setStickerId] = useState(existing?.stickerId || 'stk-bell');

  const dueLabel = useMemo(() => {
    if (!existing) return '';
    return format(parseISO(existing.dueAt), 'PPpp');
  }, [existing]);

  if (!existing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Reminder not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: colors.text }]}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80 }]}
      />

      <Text style={[styles.label, { color: colors.text }]}>Due Date & Time</Text>
      <View style={{ marginBottom: spacing.lg }}>
        <DateTimePickerField
          value={dueDate}
          onChange={setDueDate}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
      <View style={styles.row}>
        {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
          <SoftButton
            key={p}
            title={p}
            variant={priority === p ? 'primary' : 'secondary'}
            onPress={() => setPriority(p)}
            style={{ flex: 1, paddingHorizontal: 8 }}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Repeat</Text>
      <View style={styles.wrap}>
        {(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'CustomInterval'] as RepeatType[]).map(
          (r) => (
            <SoftButton
              key={r}
              title={r}
              variant={repeatType === r ? 'primary' : 'secondary'}
              onPress={() => setRepeatType(r)}
              style={{ marginBottom: 8 }}
            />
          )
        )}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Sticker</Text>
      <StickerPicker stickers={stickers} selectedId={stickerId} onSelect={setStickerId} />

      <SoftButton
        title="Save changes"
        onPress={async () => {
          await updateReminder({
            ...existing,
            title: title.trim() || existing.title,
            notes,
            dueAt: dueDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            priority,
            repeatType,
            imageType: 'sticker',
            stickerId,
            customImageUri: null,
          });
          router.back();
        }}
        style={{ marginTop: spacing.lg }}
      />
      <SoftButton title="Mark done" variant="secondary" onPress={() => completeReminder(existing.id)} />
      <View style={styles.row}>
        <SoftButton title="Snooze 5m" variant="secondary" style={{ flex: 1 }} onPress={() => snoozeReminder(existing.id, 5)} />
        <SoftButton title="1h" variant="secondary" style={{ flex: 1 }} onPress={() => snoozeReminder(existing.id, 60)} />
        <SoftButton title="1d" variant="secondary" style={{ flex: 1 }} onPress={() => snoozeReminder(existing.id, 1440)} />
      </View>
      <SoftButton
        title="Delete"
        variant="danger"
        onPress={() => {
          Alert.alert('Delete reminder?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteReminder(existing.id);
                router.back();
              },
            },
          ]);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
    gap: 8,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '800', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { gap: 4 },
});
