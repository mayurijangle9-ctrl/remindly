import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useReminderStore, draftFromCategoryDefaults } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SectionTitle } from '@/components/SoftCard';

export default function CategoriesScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const categories = useReminderStore((s) => s.categories);
  const reminders = useReminderStore((s) => s.reminders);
  const stickers = useReminderStore((s) => s.stickers);
  const createFromDraft = useReminderStore((s) => s.createFromDraft);

  const isMultiCol = width >= 640;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of reminders.filter((x) => x.status === 'active')) {
      map[r.categoryId] = (map[r.categoryId] || 0) + 1;
    }
    return map;
  }, [reminders]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle
          title="Categories"
          subtitle="Tap to filter · long-press to quick-add defaults"
        />

        <View style={[styles.grid, isMultiCol && styles.gridMulti]}>
          {categories.map((cat) => {
            const sticker = stickers.find((s) => s.categoryId === cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push({ pathname: '/all', params: { categoryId: cat.id } })}
                onLongPress={async () => {
                  await createFromDraft(draftFromCategoryDefaults(cat, stickers));
                }}
                style={[
                  styles.card,
                  isMultiCol && styles.cardMulti,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: isDark ? '#000' : colors.shadow,
                  },
                ]}
              >
                <View
                  style={[
                    styles.emoji,
                    { backgroundColor: `${cat.color}22`, borderColor: `${cat.color}55` },
                  ]}
                >
                  <Text style={{ fontSize: 28 }}>{sticker?.emoji || '📌'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]}>{cat.name}</Text>
                  <Text style={{ color: colors.textMuted }}>
                    {counts[cat.id] || 0} active
                    {cat.defaultRepeatJson ? ' · repeats through the day' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  grid: {
    width: '100%',
  },
  gridMulti: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowOffset: { width: 5, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
  },
  cardMulti: {
    width: '48.5%',
    marginBottom: 0,
  },
  emoji: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
});
