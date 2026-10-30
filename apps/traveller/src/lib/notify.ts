import { Alert, Platform } from 'react-native';

/**
 * `Alert.alert` silently no-ops on web (react-native-web has no native dialog
 * to back it with) — these wrappers fall back to `window.alert`/`window.confirm`
 * there so a "Coming soon" notice or a delete confirmation actually appears,
 * instead of the button looking like it does nothing.
 */
export function notifyInfo(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function notifyConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmLabel?: string; destructive?: boolean },
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: options?.confirmLabel ?? 'OK',
      style: options?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
