import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AgentSuggestion } from '@/types';
import { useTheme } from '@/theme/ThemeProvider';
import { SoftCard } from './SoftCard';
import { SoftButton } from './SoftButton';
import { spacing } from '@/theme/tokens';

export function AgentSuggestionCard({
  suggestion,
  onAccept,
}: {
  suggestion: AgentSuggestion;
  onAccept: () => void;
}) {
  const { colors } = useTheme();
  return (
    <SoftCard>
      <Text style={[styles.title, { color: colors.text }]}>{suggestion.title}</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        {suggestion.reason}
      </Text>
      <SoftButton title="Accept suggestion" onPress={onAccept} />
    </SoftCard>
  );
}

export function DailyBriefCard({
  dueToday,
  overdue,
  highPriority,
  tip,
}: {
  dueToday: number;
  overdue: number;
  highPriority: number;
  tip: string;
}) {
  const { colors } = useTheme();
  return (
    <SoftCard inset>
      <Text style={[styles.title, { color: colors.text }]}>Today Brief</Text>
      <View style={styles.stats}>
        <Stat label="Due" value={String(dueToday)} />
        <Stat label="Overdue" value={String(overdue)} />
        <Stat label="High" value={String(highPriority)} />
      </View>
      <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>{tip}</Text>
    </SoftCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textSoft, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
});
