import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useReminderStore } from '@/store/reminderStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SectionTitle, SoftCard } from '@/components/SoftCard';
import { SoftButton } from '@/components/SoftButton';
import { ensureNotificationPermissions } from '@/services/notifications';
import { exportBackup, importBackup, ImportMode } from '@/services/backupService';
import { getGeminiApiKey } from '@/services/agent/llmProvider';
import { ThemePreference } from '@/types';
import { ReminderOverlay } from '@/modules/reminderOverlayModule';
import { REMINDER_STICKERS } from '@/config/reminderStickers';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const refreshReminders = useReminderStore((s) => s.refresh);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);

  const checkOverlayStatus = useCallback(async () => {
    if (Platform.OS === 'android') {
      const canDraw = await ReminderOverlay.canDrawOverlays();
      setOverlayEnabled(canDraw);
    }
  }, []);

  useEffect(() => {
    void checkOverlayStatus();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkOverlayStatus();
      }
    });
    return () => sub.remove();
  }, [checkOverlayStatus]);

  const themes: ThemePreference[] = ['system', 'light', 'dark'];
  const activeApiKey = getGeminiApiKey(settings.geminiApiKey);

  // --- Export Handler ---
  const handleExport = async () => {
    setIsExporting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await exportBackup();
    setIsExporting(false);

    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Export Successful',
        `Successfully exported ${result.count ?? 0} reminders and application settings to JSON.`
      );
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Export Failed', result.error || 'Could not export backup file.');
    }
  };

  // --- Import Handler ---
  const handleImport = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      'Restore Backup',
      'Choose how you want to restore the JSON backup:\n\n• Merge: Adds new items and updates existing ones without deleting current data.\n• Overwrite: Completely replaces all reminders and custom categories.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Merge',
          onPress: () => performImport('merge'),
        },
        {
          text: 'Overwrite',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Overwrite',
              'Are you sure you want to completely overwrite all existing reminders? All current notifications will be purged and replaced.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Overwrite',
                  style: 'destructive',
                  onPress: () => performImport('overwrite'),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performImport = async (mode: ImportMode) => {
    setIsImporting(true);
    const result = await importBackup(mode);
    setIsImporting(false);

    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([refreshReminders(), hydrateSettings()]);
      Alert.alert(
        'Restore Complete',
        `Successfully restored ${result.importedCount} reminders using "${mode}" mode.`
      );
    } else if (!result.canceled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Import Failed', result.error || 'Could not restore backup file.');
    }
  };

  const handleSaveApiKey = async () => {
    await update({ geminiApiKey: apiKeyInput.trim() });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Key Saved', 'Gemini API key updated successfully.');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Settings" subtitle="Theme, agent intelligence, and backups" />

        {/* Theme Preference */}
        <SoftCard>
          <Text style={[styles.label, { color: colors.text }]}>Theme</Text>
          <View style={styles.rowWrap}>
            {themes.map((t) => (
              <Pressable
                key={t}
                onPress={() => update({ theme: t })}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      settings.theme === t ? colors.primarySoft : colors.bgElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: '700',
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </SoftCard>

        {/* Default Reminder Time */}
        <SoftCard>
          <Text style={[styles.label, { color: colors.text }]}>
            Default reminder time (HH:mm)
          </Text>
          <TextInput
            value={settings.defaultReminderTime}
            onChangeText={(v) => update({ defaultReminderTime: v })}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
              },
            ]}
          />
        </SoftCard>

        {/* Gemini AI Agent Integration */}
        <SoftCard>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
              Gemini AI Integration
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, lineHeight: 18 }}>
            Enables advanced natural language parsing via Google Gemini 3.8 Flash. If offline or unconfigured, Remindly seamlessly falls back to on-device regex.
          </Text>

          <View style={styles.statusBadgeRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: activeApiKey ? 'rgba(91, 168, 138, 0.15)' : 'rgba(201, 146, 58, 0.15)',
                  borderColor: activeApiKey ? colors.accent : colors.warning,
                },
              ]}
            >
              <Text
                style={{
                  color: activeApiKey ? colors.accent : colors.warning,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {activeApiKey ? '● Gemini Enabled' : '○ Local Regex Only'}
              </Text>
            </View>
          </View>

          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surfaceInset }]}>
            <TextInput
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="Paste Gemini API Key"
              placeholderTextColor={colors.textSoft}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              style={[styles.apiKeyInput, { color: colors.text }]}
            />
            <Pressable onPress={() => setShowApiKey(!showApiKey)} hitSlop={8} style={{ paddingHorizontal: 8 }}>
              <Ionicons
                name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSoft}
              />
            </Pressable>
          </View>

          <SoftButton
            title="Save Gemini Key"
            variant="secondary"
            onPress={handleSaveApiKey}
            style={{ marginTop: spacing.sm }}
          />
        </SoftCard>

        {/* Agent Switches */}
        <SoftCard>
          <Row
            label="Natural language create"
            value={settings.enableNlCreate}
            onChange={(v) => update({ enableNlCreate: v })}
          />
          <Row
            label="Smart suggestions"
            value={settings.enableSuggestions}
            onChange={(v) => update({ enableSuggestions: v })}
          />
          <Row
            label="Daily brief"
            value={settings.enableDailyBrief}
            onChange={(v) => update({ enableDailyBrief: v })}
          />
        </SoftCard>

        {/* Backup & Restore Section */}
        <SoftCard>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
              Data Backup & Restore
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 18 }}>
            Safeguard your reminders, custom intervals, categories, and preferences. Export to a JSON file or restore from a previous backup.
          </Text>

          <View style={{ gap: spacing.sm }}>
            <SoftButton
              title={isExporting ? 'Exporting...' : 'Export Backup (JSON)'}
              onPress={handleExport}
              disabled={isExporting || isImporting}
            />

            <SoftButton
              title={isImporting ? 'Restoring...' : 'Restore Backup (JSON)'}
              variant="secondary"
              onPress={handleImport}
              disabled={isExporting || isImporting}
            />
          </View>

          {(isExporting || isImporting) && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8 }}>
                {isExporting ? 'Preparing export archive...' : 'Validating & restoring database...'}
              </Text>
            </View>
          )}
        </SoftCard>

        {/* Floating Reminders Section */}
        <SoftCard>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="copy-outline" size={20} color={colors.primary} />
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
              Floating Reminders
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 18 }}>
            Show reminder stickers on top of other apps (like YouTube, WhatsApp, or Chrome) when a reminder is due.
          </Text>

          {Platform.OS === 'android' ? (
            <>
              <View
                style={{
                  padding: spacing.sm,
                  borderRadius: radii.sm,
                  backgroundColor: overlayEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  marginBottom: spacing.md,
                }}
              >
                <Text
                  style={{
                    color: overlayEnabled ? '#16A34A' : '#DC2626',
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {overlayEnabled
                    ? '✓ Floating reminders are enabled.'
                    : "Floating reminders are disabled. You'll still receive normal notifications."}
                </Text>
              </View>

              <SoftButton
                title={overlayEnabled ? 'Manage Overlay Permission' : 'Enable Floating Reminders'}
                variant={overlayEnabled ? 'secondary' : 'primary'}
                onPress={async () => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await ReminderOverlay.openOverlaySettings();
                }}
              />

              {overlayEnabled && (
                <>
                  <SoftButton
                    title="Test Water Sticker Overlay"
                    variant="secondary"
                    style={{ marginTop: spacing.sm }}
                    onPress={async () => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      await ReminderOverlay.showReminder({
                        reminderId: 'test-water-reminder',
                        title: '💧 Paani Pilo!',
                        body: 'Time to drink water and stay hydrated.',
                        theme: 'water',
                        stickerKey: 'water-pani-pilo',
                      });
                    }}
                  />

                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                      marginTop: spacing.sm,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Test All 12 Category Overlays
                  </Text>
                  <View style={styles.rowWrap}>
                    {[
                      { key: 'water-pani-pilo', label: '💧 Water' },
                      { key: 'birthday', label: '🎈 Birthday' },
                      { key: 'medicine', label: '💊 Medicine' },
                      { key: 'workout', label: '⚡ Workout' },
                      { key: 'bills', label: '💳 Bills' },
                      { key: 'work', label: '💼 Work' },
                      { key: 'stretch', label: '🌸 Stretch' },
                      { key: 'travel', label: '✈️ Travel' },
                      { key: 'appointments', label: '📅 Appts' },
                      { key: 'subscriptions', label: '🔄 Subs' },
                      { key: 'general', label: '✨ General' },
                      { key: 'default', label: '✨ Default' },
                    ].map((cat) => (
                      <Pressable
                        key={cat.key}
                        onPress={async () => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const conf = REMINDER_STICKERS[cat.key];
                          await ReminderOverlay.showReminder({
                            reminderId: `test-${cat.key}-reminder`,
                            title: conf.defaultTitle,
                            body: conf.defaultBody,
                            theme: cat.key,
                            stickerKey: cat.key,
                          });
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: colors.bgElevated,
                            borderColor: colors.border,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <Text style={{ color: colors.textSoft, fontSize: 12, lineHeight: 16 }}>
              Floating sticker overlays over other apps use Android's SYSTEM_ALERT_WINDOW permission. On iOS, rich notifications with quick actions and in-app popup dialogs are used.
            </Text>
          )}
        </SoftCard>

        {/* Notifications Permission */}
        <SoftButton
          title="Check notification permissions"
          variant="secondary"
          onPress={async () => {
            const granted = await ensureNotificationPermissions();
            void Haptics.notificationAsync(
              granted
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Warning
            );
            Alert.alert(
              'Permissions',
              granted
                ? 'Notifications are active and authorized.'
                : 'Notification permissions were denied. Please enable them in system settings.'
            );
          }}
        />

        {/* Notification details info */}
        <SoftCard>
          <Text style={[styles.label, { color: colors.text }]}>About notifications</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
            Android shows rich high-importance notifications with custom vibration patterns and instant Snooze / Done actions. iOS delivers scheduled alerts with quick actions and foreground popup dialogs.
          </Text>
        </SoftCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 10,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  label: { fontWeight: '800', marginBottom: 10, fontSize: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 6,
  },
  apiKeyInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  statusBadgeRow: {
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
