import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import {
  CustomInterval,
  ImageType,
  Priority,
  RepeatType,
} from '@/types';
import { useReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { SectionTitle } from '@/components/SoftCard';
import { SoftButton } from '@/components/SoftButton';
import { StickerPicker } from '@/components/StickerPicker';
import { DateTimePickerField } from '@/components/DateTimePickerField';
import { combineDateAndTime } from '@/utils/dates';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];
const REPEATS: RepeatType[] = [
  'None',
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
  'CustomInterval',
];

export default function AddScreen() {
  const { colors } = useTheme();
  const categories = useReminderStore((s) => s.categories);
  const stickers = useReminderStore((s) => s.stickers);
  const createFromDraft = useReminderStore((s) => s.createFromDraft);
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const defaultTime = useSettingsStore((s) => s.settings.defaultReminderTime);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState('cat-work');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [repeatType, setRepeatType] = useState<RepeatType>('None');
  const [every, setEvery] = useState('2');
  const [unit, setUnit] = useState<CustomInterval['unit']>('hours');
  const [stickerId, setStickerId] = useState('stk-work');
  const [imageType, setImageType] = useState<ImageType>('sticker');
  const [customImageUri, setCustomImageUri] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date>(() => combineDateAndTime(new Date(), defaultTime));

  const categoryStickers = useMemo(() => {
    const scoped = stickers.filter(
      (s) => !s.categoryId || s.categoryId === categoryId || s.categoryId === null
    );
    return scoped.length ? scoped : stickers;
  }, [stickers, categoryId]);

  const onCategoryChange = (id: string) => {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    const sticker = stickers.find((s) => s.categoryId === id);
    if (sticker) {
      setStickerId(sticker.id);
      setImageType('sticker');
    }
    if (cat?.defaultRepeatJson) {
      const parsed = JSON.parse(cat.defaultRepeatJson) as CustomInterval;
      setRepeatType('CustomInterval');
      setEvery(String(parsed.every));
      setUnit(parsed.unit);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCustomImageUri(result.assets[0].uri);
      setImageType('custom');
    }
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a reminder title.');
      return;
    }
    const due = dueDate;
    const customInterval: CustomInterval | undefined =
      repeatType === 'CustomInterval'
        ? { every: Math.max(1, Number(every) || 1), unit }
        : undefined;

    const created = await createFromDraft({
      title,
      notes,
      categoryId,
      priority,
      repeatType,
      customInterval,
      dueAt: due.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      stickerId,
    });

    if (imageType === 'custom' && customImageUri) {
      await updateReminder({
        ...created,
        imageType: 'custom',
        customImageUri,
        stickerId: null,
      });
    }

    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="New reminder" subtitle="Soft details, clear timing" />

        <Field label="Title" colors={colors}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What should we remind you?"
            placeholderTextColor={colors.textSoft}
            style={[styles.input, inputStyle(colors)]}
          />
        </Field>

        <Field label="Notes" colors={colors}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor={colors.textSoft}
            multiline
            style={[styles.input, inputStyle(colors), { minHeight: 80 }]}
          />
        </Field>

        <Field label="Due Date & Time" colors={colors}>
          <DateTimePickerField
            value={dueDate}
            onChange={setDueDate}
            minimumDate={new Date()}
          />
        </Field>

        <Field label="Category" colors={colors}>
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={categoryId === c.id}
                color={c.color}
                onPress={() => onCategoryChange(c.id)}
              />
            ))}
          </View>
        </Field>

        <Field label="Priority" colors={colors}>
          <View style={styles.wrap}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={p}
                active={priority === p}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>
        </Field>

        <Field label="Repeat" colors={colors}>
          <View style={styles.wrap}>
            {REPEATS.map((r) => (
              <Chip
                key={r}
                label={r}
                active={repeatType === r}
                onPress={() => setRepeatType(r)}
              />
            ))}
          </View>
        </Field>

        {repeatType === 'CustomInterval' ? (
          <View style={styles.row}>
            <TextInput
              value={every}
              onChangeText={setEvery}
              keyboardType="number-pad"
              style={[styles.input, inputStyle(colors), { flex: 1 }]}
            />
            <View style={[styles.wrap, { flex: 2 }]}>
              {(['minutes', 'hours', 'days'] as const).map((u) => (
                <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
          </View>
        ) : null}

        <Field label="Sticker" colors={colors}>
          <StickerPicker
            stickers={categoryStickers}
            selectedId={imageType === 'sticker' ? stickerId : null}
            onSelect={(id) => {
              setStickerId(id);
              setImageType('sticker');
              setCustomImageUri(null);
            }}
          />
          <SoftButton
            title={customImageUri ? 'Change custom image' : 'Upload custom image'}
            variant="secondary"
            onPress={pickImage}
            style={{ marginTop: spacing.md }}
          />
        </Field>

        <SoftButton title="Save reminder" onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: { text: string };
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primarySoft : colors.surface,
          borderColor: active ? color || colors.primary : colors.border,
        },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function inputStyle(colors: { surface: string; border: string; text: string }) {
  return {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.text,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 140,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
});
