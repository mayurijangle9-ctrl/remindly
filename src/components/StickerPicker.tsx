import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sticker } from '@/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

export function StickerPicker({
  stickers,
  selectedId,
  onSelect,
}: {
  stickers: Sticker[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.grid}>
      {stickers.map((sticker) => {
        const selected = sticker.id === selectedId;
        return (
          <Pressable
            key={sticker.id}
            onPress={() => onSelect(sticker.id)}
            style={[
              styles.item,
              {
                backgroundColor: selected ? colors.primarySoft : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                shadowColor: isDark ? '#000' : colors.shadow,
              },
            ]}
          >
            <Text style={{ fontSize: 28 }}>{sticker.emoji}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {sticker.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  item: {
    width: '22%',
    minWidth: 68,
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});
