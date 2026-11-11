import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface DateTimePickerFieldProps {
  label: string;
  value: string; // full ISO instant (e.g. 2026-11-20T22:00:00.000Z), or '' when unset
  onChange: (isoDateTime: string) => void;
  placeholder?: string;
}

function formatDisplay(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Native (iOS/Android) only — see `DateTimePickerField.web.tsx` for web.
 *
 * Android's DateTimePicker has no combined "datetime" mode (iOS does) — so on
 * Android we chain two system dialogs, date then time, and merge them into one
 * Date before calling onChange. The stored value is always a full ISO instant,
 * computed from the device's local time, matching whatever wall-clock time the
 * user picked (appropriate here since this is unverified manual entry, not a
 * schedule-provider lookup with real per-airport timezone data).
 */
export function DateTimePickerField({ label, value, onChange, placeholder }: DateTimePickerFieldProps) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const dateValue = value ? new Date(value) : new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateValue,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, pickedDate?: Date) => {
          if (event.type !== 'set' || !pickedDate) return;
          DateTimePickerAndroid.open({
            value: dateValue,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvent: DateTimePickerEvent, pickedTime?: Date) => {
              if (timeEvent.type !== 'set' || !pickedTime) return;
              const merged = new Date(pickedDate);
              merged.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
              onChange(merged.toISOString());
            },
          });
        },
      });
      return;
    }
    setShowIosPicker((v) => !v);
  };

  const handleIosChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowIosPicker(false);
    if (event.type === 'set' && selected) onChange(selected.toISOString());
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.input}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplay(value) : (placeholder ?? 'Select date & time')}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </Pressable>

      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={dateValue}
          mode="datetime"
          display="inline"
          onChange={handleIosChange}
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
