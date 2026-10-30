import { createElement, type CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD, or '' when nothing is selected yet
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Web has no equivalent of this component's native sibling:
 * `@react-native-community/datetimepicker` has no web implementation at all
 * (no `.web.js` in the package). Metro resolves `.web.tsx` over `.tsx` for
 * web builds, so this file — web only — renders a real `<input type="date">`
 * instead, which every browser already has a native picker UI for.
 */
export function DatePickerField({ label, value, onChange, minimumDate, maximumDate }: DatePickerFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        type: 'date',
        value,
        min: minimumDate ? toIsoDate(minimumDate) : undefined,
        max: maximumDate ? toIsoDate(maximumDate) : undefined,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
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
