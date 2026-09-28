import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Reminder, Sticker } from '@/types';
import { useTheme } from '@/theme/ThemeProvider';
import { resolveReminderSticker } from '@/config/reminderStickers';

export function StickerView({
  reminder,
  stickers,
  size = 44,
}: {
  reminder: Pick<Reminder, 'imageType' | 'stickerId' | 'customImageUri'> & {
    title?: string;
    categoryId?: string | null;
  };
  stickers: Sticker[];
  size?: number;
}) {
  const { colors, isDark } = useTheme();
  const sticker = stickers.find((s) => s.id === reminder.stickerId);

  if (reminder.imageType === 'custom' && reminder.customImageUri) {
    return (
      <Image
        source={{ uri: reminder.customImageUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 3,
        }}
      />
    );
  }

  // Resolve category sticker if available
  const categorySticker = resolveReminderSticker(
    reminder.categoryId || reminder.stickerId,
    reminder.title
  );

  if (categorySticker?.source) {
    return (
      <View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
          },
        ]}
      >
        <Image
          source={categorySticker.source}
          style={{
            width: size,
            height: size,
          }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: isDark ? colors.surfaceInset : colors.bgElevated,
          borderColor: colors.border,
          shadowColor: isDark ? '#000' : colors.shadow,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.45 }}>{sticker?.emoji || categorySticker?.emoji || '🔔'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
