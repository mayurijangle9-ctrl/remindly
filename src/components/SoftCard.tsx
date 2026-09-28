import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

export function SoftCard({
  children,
  inset = false,
}: {
  children: React.ReactNode;
  inset?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: inset ? colors.surfaceInset : colors.surface,
          borderColor: colors.border,
          shadowColor: isDark ? '#000' : colors.shadow,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    shadowOffset: { width: 6, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
});
