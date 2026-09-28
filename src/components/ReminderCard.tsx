import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Reminder } from '@/types';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { CategoryChip, PriorityChip } from './Chips';
import { StickerView } from './StickerView';
import { PremiumAntiGravity } from './PremiumAntiGravity';

type Props = {
  reminder: Reminder;
  onPress?: () => void;
};

export const ReminderCard = React.memo(function ReminderCard({ reminder, onPress }: Props) {
  const { colors, isDark } = useTheme();
  const categories = useReminderStore((s) => s.categories);
  const stickers = useReminderStore((s) => s.stickers);
  const completeReminder = useReminderStore((s) => s.completeReminder);
  const deleteReminder = useReminderStore((s) => s.deleteReminder);
  const category = categories.find((c) => c.id === reminder.categoryId);

  const translateX = useSharedValue(0);
  const isLocked = useSharedValue(false);
  const [showBurst, setShowBurst] = useState(false);
  const isCompletingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const triggerCompletionBurst = useCallback(() => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setShowBurst(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    void completeReminder(reminder.id);
    if (isMountedRef.current) {
      setShowBurst(false);
      isCompletingRef.current = false;
    }
  }, [completeReminder, reminder.id]);

  const handleDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void deleteReminder(reminder.id);
  }, [deleteReminder, reminder.id]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      if (isLocked.value) return;
    })
    .onUpdate((e) => {
      'worklet';
      if (isLocked.value) return;
      translateX.value = Math.max(-130, Math.min(130, e.translationX));
    })
    .onEnd((e) => {
      'worklet';
      if (isLocked.value) return;
      if (e.translationX > 85) {
        isLocked.value = true;
        translateX.value = withTiming(350, { duration: 160 }, () => {
          runOnJS(triggerCompletionBurst)();
        });
      } else if (e.translationX < -85) {
        isLocked.value = true;
        translateX.value = withTiming(-350, { duration: 160 }, () => {
          runOnJS(handleDelete)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const doneHintStyle = useAnimatedStyle(() => {
    const opacity = Math.min(1, Math.max(0, translateX.value / 60));
    return { opacity };
  });

  const deleteHintStyle = useAnimatedStyle(() => {
    const opacity = Math.min(1, Math.max(0, -translateX.value / 60));
    return { opacity };
  });

  const completed = reminder.status === 'completed';

  return (
    <View style={styles.wrap}>
      {/* Anti-Gravity Burst localized to this card's coordinates */}
      <PremiumAntiGravity
        active={showBurst}
        theme={category?.name || reminder.title}
        variant="localized"
        onAnimationComplete={handleAnimationComplete}
      />
      <View style={styles.actions}>
        <Animated.Text style={[styles.hint, { color: colors.accent }, doneHintStyle]}>
          Done
        </Animated.Text>
        <Animated.Text style={[styles.hint, { color: colors.danger }, deleteHintStyle]}>
          Delete
        </Animated.Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimatedStyle}>
          <Pressable
            onPress={onPress}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: isDark ? '#000' : colors.shadow,
                opacity: completed ? 0.55 : 1,
              },
            ]}
          >
            <StickerView reminder={reminder} stickers={stickers} />
            <View style={styles.content}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                    textDecorationLine: completed ? 'line-through' : 'none',
                  },
                ]}
                numberOfLines={1}
              >
                {reminder.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {format(parseISO(reminder.dueAt), 'h:mm a')}
                {reminder.notes ? ` · ${reminder.notes}` : ''}
              </Text>
              <View style={styles.row}>
                <PriorityChip priority={reminder.priority} />
                {category ? (
                  <CategoryChip name={category.name} color={category.color} />
                ) : null}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    overflow: 'visible',
    zIndex: 1,
  },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  hint: {
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    shadowOffset: { width: 5, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
