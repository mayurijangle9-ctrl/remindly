import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SoftButton } from './SoftButton';

export interface DateTimePickerFieldProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * iOS presentation style:
   * - 'modal': (Default) Tactile pill buttons opening a native iOS spinner within a soft sheet.
   * - 'compact': Native iOS inline compact picker controls.
   */
  displayMode?: 'modal' | 'compact';
}

export function DateTimePickerField({
  value,
  onChange,
  minimumDate,
  disabled = false,
  style,
  displayMode = 'modal',
}: DateTimePickerFieldProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  // Android state: which dialog is currently shown
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);

  // iOS modal state
  const [iosModalMode, setIosModalMode] = useState<'date' | 'time' | null>(null);
  const [tempDate, setTempDate] = useState<Date>(value);

  // --- Android Event Handlers ---
  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    const currentMode = androidPickerMode;
    setAndroidPickerMode(null);

    if (event.type === 'set' && selectedDate) {
      void Haptics.selectionAsync();
      const updated = new Date(value);
      if (currentMode === 'date') {
        updated.setFullYear(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate()
        );
      } else if (currentMode === 'time') {
        updated.setHours(
          selectedDate.getHours(),
          selectedDate.getMinutes(),
          0,
          0
        );
      }
      onChange(updated);
    }
  };

  const openAndroidPicker = (mode: 'date' | 'time') => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAndroidPickerMode(mode);
  };

  // --- iOS Modal Event Handlers ---
  const openIosModal = (mode: 'date' | 'time') => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempDate(new Date(value));
    setIosModalMode(mode);
  };

  const handleIosConfirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChange(tempDate);
    setIosModalMode(null);
  };

  const handleIosCancel = () => {
    void Haptics.selectionAsync();
    setIosModalMode(null);
  };

  // --- iOS Compact Inline Handlers ---
  const handleIosCompactDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (selectedDate) {
      void Haptics.selectionAsync();
      const updated = new Date(value);
      updated.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      onChange(updated);
    }
  };

  const handleIosCompactTimeChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (selectedDate) {
      void Haptics.selectionAsync();
      const updated = new Date(value);
      updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      onChange(updated);
    }
  };

  // Render for iOS Compact Mode
  if (Platform.OS === 'ios' && displayMode === 'compact') {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.row}>
          <View
            style={[
              styles.compactPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <DateTimePicker
              value={value}
              mode="date"
              display="compact"
              minimumDate={minimumDate}
              themeVariant={isDark ? 'dark' : 'light'}
              onChange={handleIosCompactDateChange}
              disabled={disabled}
              style={styles.compactPicker}
            />
          </View>

          <View
            style={[
              styles.compactPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <DateTimePicker
              value={value}
              mode="time"
              display="compact"
              themeVariant={isDark ? 'dark' : 'light'}
              onChange={handleIosCompactTimeChange}
              disabled={disabled}
              style={styles.compactPicker}
            />
          </View>
        </View>
      </View>
    );
  }

  // Standard tactile UI for Android dialogs and iOS modal workflow
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.row, isNarrow && styles.rowNarrow]}>
        {/* Date Selector Pill */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Date selected: ${format(value, 'EEEE, MMMM d, yyyy')}`}
          onPress={() =>
            Platform.OS === 'android'
              ? openAndroidPicker('date')
              : openIosModal('date')
          }
          disabled={disabled}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.pillContent}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.subLabel, { color: colors.textMuted }]}>
                Date
              </Text>
              <Text style={[styles.mainLabel, { color: colors.text }]}>
                {format(value, 'EEE, MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Time Selector Pill */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Time selected: ${format(value, 'hh:mm a')}`}
          onPress={() =>
            Platform.OS === 'android'
              ? openAndroidPicker('time')
              : openIosModal('time')
          }
          disabled={disabled}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.pillContent}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.surfaceInset },
              ]}
            >
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.subLabel, { color: colors.textMuted }]}>
                Time
              </Text>
              <Text style={[styles.mainLabel, { color: colors.text }]}>
                {format(value, 'hh:mm a')}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Android Dialog Renderer */}
      {Platform.OS === 'android' && androidPickerMode !== null && (
        <DateTimePicker
          value={value}
          mode={androidPickerMode}
          display="default"
          minimumDate={androidPickerMode === 'date' ? minimumDate : undefined}
          is24Hour={false}
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS Modal Spinner Sheet */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosModalMode !== null}
          transparent
          animationType="fade"
          onRequestClose={handleIosCancel}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={handleIosCancel}>
            <Pressable
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {iosModalMode === 'date' ? 'Select Due Date' : 'Select Due Time'}
                </Text>
                <Pressable onPress={handleIosCancel} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </View>

              <View style={styles.pickerContainer}>
                {iosModalMode && (
                  <DateTimePicker
                    value={tempDate}
                    mode={iosModalMode}
                    display="spinner"
                    minimumDate={iosModalMode === 'date' ? minimumDate : undefined}
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={(_event, date) => {
                      if (date) {
                        void Haptics.selectionAsync();
                        setTempDate(date);
                      }
                    }}
                    style={styles.iosSpinner}
                  />
                )}
              </View>

              <SoftButton
                title="Confirm"
                onPress={handleIosConfirm}
                style={{ width: '100%', marginTop: spacing.md }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowNarrow: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mainLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  compactPicker: {
    height: 40,
    width: 120,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosSpinner: {
    width: '100%',
    height: 200,
  },
});
