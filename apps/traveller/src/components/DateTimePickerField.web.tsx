import { createElement, type CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface DateTimePickerFieldProps {
  label: string;
  value: string; // full ISO instant, or '' when unset
  onChange: (isoDateTime: string) => void;
}

/** `<input type="datetime-local">`'s value has no timezone — it's always the
 * browser's local wall-clock time, so we format/parse using local getters,
 * matching the native side's behavior (see DateTimePickerField.tsx). */
function toInputValue(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Web has no equivalent of this component's native sibling — see
 * `DatePickerField.web.tsx` for why `.web.tsx` files exist in this app. */
export function DateTimePickerField({ label, value, onChange }: DateTimePickerFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        type: 'datetime-local',
        value: toInputValue(value),
        onChange: (e: { target: { value: string } }) => {
          if (!e.target.value) {
            onChange('');
            return;
          }
          const [datePart, timePart] = e.target.value.split('T');
          const [y, m, d] = datePart!.split('-').map(Number);
          const [hh, mm] = timePart!.split(':').map(Number);
          onChange(new Date(y!, m! - 1, d!, hh, mm).toISOString());
        },
        style: inputStyle,
      })}
    </View>
  );
}

const inputStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: spacing.md,
  fontSize: 16,
  color: colors.textPrimary,
  backgroundColor: colors.surface,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
});
