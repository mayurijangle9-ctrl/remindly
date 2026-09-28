import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { isSameDay, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { SectionTitle } from '@/components/SoftCard';
import { ReminderCard } from '@/components/ReminderCard';
import { AgentSuggestionCard, DailyBriefCard } from '@/components/AgentCards';
import { SoftButton } from '@/components/SoftButton';

export default function TodayScreen() {
  const { colors } = useTheme();
  const reminders = useReminderStore((s) => s.reminders);
  const suggestions = useReminderStore((s) => s.suggestions);
  const brief = useReminderStore((s) => s.brief);
  const createFromDraft = useReminderStore((s) => s.createFromDraft);
  const parseAgentInput = useReminderStore((s) => s.parseAgentInput);
  const settings = useSettingsStore((s) => s.settings);
  const [agentText, setAgentText] = useState('');
  const [pendingDraft, setPendingDraft] = useState<import('@/types').ReminderDraft | null>(null);

  const { dueToday, overdue } = useMemo(() => {
    const now = new Date();
    const active = reminders.filter((r) => r.status === 'active');
    return {
      dueToday: active
        .filter((r) => isSameDay(parseISO(r.dueAt), now))
        .sort((a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt)),
      overdue: active
        .filter((r) => parseISO(r.dueAt).getTime() < now.getTime() && !isSameDay(parseISO(r.dueAt), now))
        .sort((a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt)),
    };
  }, [reminders]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <SectionTitle title="Remindly" subtitle="Soft reminders for a calmer day" />
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/search')}>
              <Ionicons name="search" size={22} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => router.push('/all')}>
              <Ionicons name="list" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {settings.enableDailyBrief && brief ? (
          <DailyBriefCard
            dueToday={brief.dueToday}
            overdue={brief.overdue}
            highPriority={brief.highPriority}
            tip={brief.tip}
          />
        ) : null}

        {settings.enableNlCreate ? (
          <View
            style={[
              styles.agentBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.agentLabel, { color: colors.text }]}>Ask Agent</Text>
            <TextInput
              value={agentText}
              onChangeText={setAgentText}
              placeholder='e.g. "Remind me to drink water every 2 hours"'
              placeholderTextColor={colors.textSoft}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceInset }]}
            />
            {pendingDraft ? (
              <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
                Parsed as: {pendingDraft.title}
                {pendingDraft.repeatType ? ` · ${pendingDraft.repeatType}` : ''}
                {pendingDraft.customInterval
                  ? ` every ${pendingDraft.customInterval.every} ${pendingDraft.customInterval.unit}`
                  : ''}
                {pendingDraft.priority ? ` · ${pendingDraft.priority}` : ''}
              </Text>
            ) : null}
            <SoftButton
              title={pendingDraft ? 'Confirm create' : 'Parse reminder'}
              onPress={async () => {
                if (pendingDraft) {
                  await createFromDraft(pendingDraft);
                  setPendingDraft(null);
                  setAgentText('');
                  return;
                }
                if (!agentText.trim()) return;
                const draft = await parseAgentInput(agentText);
                setPendingDraft(draft);
              }}
            />
            {pendingDraft ? (
              <SoftButton
                title="Cancel"
                variant="ghost"
                onPress={() => setPendingDraft(null)}
              />
            ) : null}
          </View>
        ) : null}

        {settings.enableSuggestions && suggestions.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[styles.section, { color: colors.text }]}>Smart suggestions</Text>
            {suggestions.map((s) => (
              <AgentSuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={async () => {
                  await createFromDraft(s.draft);
                }}
              />
            ))}
          </View>
        ) : null}

        {overdue.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.danger }]}>Overdue</Text>
            {overdue.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onPress={() => router.push(`/reminder/${r.id}`)}
              />
            ))}
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text }]}>Due today</Text>
        {dueToday.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>Nothing due today. Enjoy the calm.</Text>
        ) : (
          dueToday.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onPress={() => router.push(`/reminder/${r.id}`)}
            />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: { flexDirection: 'row', gap: 14, paddingTop: 8 },
  section: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 8,
  },
  agentBox: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 8,
  },
  agentLabel: { fontWeight: '800', fontSize: 16 },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
