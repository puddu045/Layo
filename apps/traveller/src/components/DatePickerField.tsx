import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD, or '' when nothing is selected yet
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

/** Local calendar date, not `toISOString()` — that's UTC and can shift the day
 * depending on the device's timezone relative to midnight. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function formatDisplay(value: string): string {
  return parseIsoDate(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Native (iOS/Android) only — see `DatePickerField.web.tsx` for web, which
 * Metro resolves instead on that platform (this library has no web build).
 *
 * Android's date picker is a one-shot system dialog triggered imperatively
 * (`DateTimePickerAndroid.open`), not a component you keep mounted — that's
 * this library's intentional per-platform API. iOS renders the picker inline
 * once opened.
 */
export function DatePickerField({ label, value, onChange, minimumDate, maximumDate, placeholder }: DatePickerFieldProps) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const dateValue = parseIsoDate(value);

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowIosPicker(false);
    if (event.type === 'set' && selected) onChange(toIsoDate(selected));
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateValue,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: handlePickerChange,
      });
      return;
    }
    setShowIosPicker((v) => !v);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.input}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplay(value) : (placeholder ?? 'Select a date')}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </Pressable>

      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handlePickerChange}
          style={styles.inlinePicker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  valueText: { fontSize: 16, color: colors.textPrimary },
  placeholderText: { fontSize: 16, color: colors.textSecondary },
  inlinePicker: { marginTop: spacing.sm },
});
