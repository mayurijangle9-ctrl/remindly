import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SoftButton } from './SoftButton';
import { StickerView } from './StickerView';
import { CategoryChip, PriorityChip } from './Chips';
import { PremiumAntiGravity } from './PremiumAntiGravity';
import * as Haptics from 'expo-haptics';

export function ReminderPopup() {
  const { colors } = useTheme();
  const activePopupId = useReminderStore((s) => s.activePopupId);
  const reminders = useReminderStore((s) => s.reminders);
  const categories = useReminderStore((s) => s.categories);
  const stickers = useReminderStore((s) => s.stickers);
  const completeReminder = useReminderStore((s) => s.completeReminder);
  const snoozeReminder = useReminderStore((s) => s.snoozeReminder);
  const setActivePopup = useReminderStore((s) => s.setActivePopup);

  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  const reminder = reminders.find((r) => r.id === activePopupId);
  const category = categories.find((c) => c.id === reminder?.categoryId);

  const [isCompleting, setIsCompleting] = useState(false);
  const isCompletingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (reminder) {
      isCompletingRef.current = false;
      setIsCompleting(false);
      scale.value = 0.9;
      opacity.value = 0;
      scale.value = withSpring(1, { damping: 14, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 180 });
    }
  }, [reminder, scale, opacity]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleDone = useCallback(() => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setIsCompleting(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    if (reminder) {
      void completeReminder(reminder.id);
    }
    if (isMountedRef.current) {
      isCompletingRef.current = false;
      setIsCompleting(false);
    }
  }, [completeReminder, reminder]);

  if (!reminder) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setActivePopup(null)}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        {/* Layer 1: Anti-Gravity Engine mounted BEHIND the card, OVER the dark overlay */}
        <PremiumAntiGravity
          active={isCompleting}
          theme={category?.name || reminder.title}
          variant="fullscreen"
          onAnimationComplete={handleAnimationComplete}
        />

        {/* Layer 2: Main Popup Card */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              zIndex: 25,
            },
            sheetAnimatedStyle,
          ]}
        >
          <StickerView reminder={reminder} stickers={stickers} size={120} />
          <Text style={[styles.title, { color: colors.text }]}>{reminder.title}</Text>
          {reminder.notes ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{reminder.notes}</Text>
          ) : null}
          <View style={styles.chips}>
            <PriorityChip priority={reminder.priority} />
            {category ? <CategoryChip name={category.name} color={category.color} /> : null}
          </View>
          <SoftButton title="Done" onPress={handleDone} style={{ width: '100%' }} />
          <View style={styles.snoozeRow}>
            <SoftButton title="5m" variant="secondary" onPress={() => snoozeReminder(reminder.id, 5)} style={styles.snoozeBtn} />
            <SoftButton title="1h" variant="secondary" onPress={() => snoozeReminder(reminder.id, 60)} style={styles.snoozeBtn} />
            <SoftButton title="1d" variant="secondary" onPress={() => snoozeReminder(reminder.id, 1440)} style={styles.snoozeBtn} />
          </View>
          <SoftButton title="Dismiss" variant="ghost" onPress={() => setActivePopup(null)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  snoozeBtn: {
    flex: 1,
    paddingHorizontal: 8,
  },
});
