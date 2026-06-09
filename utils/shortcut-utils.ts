import { DEFAULT_TIME_TOAST_SHORTCUT } from '../types/index.js';
import type { TimeToastShortcut } from '../types/index.js';

export function isModifierCode(code: string): boolean {
  return code.startsWith('Control') ||
         code.startsWith('Shift') ||
         code.startsWith('Alt') ||
         code.startsWith('Meta');
}

export function isTimeToastShortcutSafe(shortcut: TimeToastShortcut): boolean {
  return !!shortcut.code &&
         !isModifierCode(shortcut.code) &&
         (shortcut.ctrlOrMeta || shortcut.alt);
}

export function getSafeTimeToastShortcut(value: unknown): TimeToastShortcut {
  const shortcut = value as TimeToastShortcut | undefined;
  if (shortcut && isTimeToastShortcutSafe(shortcut)) {
    return shortcut;
  }
  return DEFAULT_TIME_TOAST_SHORTCUT;
}
