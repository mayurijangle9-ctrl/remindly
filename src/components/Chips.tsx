import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Priority } from '@/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const PRIORITY_COLOR: Record<Priority, string> = {
  Low: '#5BA88A',
  Medium: '#C9923A',
  High: '#C45B5B',
};

export function PriorityChip({ priority }: { priority: Priority }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: `${PRIORITY_COLOR[priority]}22`,
          borderColor: `${PRIORITY_COLOR[priority]}55`,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{priority}</Text>
    </View>
  );
}

export function CategoryChip({ name, color }: { name: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: `${color}22`, borderColor: `${color}55` },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
