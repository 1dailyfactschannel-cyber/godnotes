import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isHotkeyMatch(event: KeyboardEvent | React.KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split('+');
  const isCtrl = parts.includes('ctrl') || parts.includes('cmd');
  const isShift = parts.includes('shift');
  const isAlt = parts.includes('alt');
  const keyPart = parts.find(p => !['ctrl', 'cmd', 'shift', 'alt'].includes(p));

  const eventCtrl = event.metaKey || event.ctrlKey;
  const eventShift = event.shiftKey;
  const eventAlt = event.altKey;

  if (eventCtrl !== isCtrl || eventShift !== isShift || eventAlt !== isAlt) {
    return false;
  }

  if (!keyPart) return false;

  if (keyPart.length === 1 && keyPart >= 'a' && keyPart <= 'z') {
    // Check both code and key for letters to support layouts
    // event.code is like "KeyK", keyPart is "k"
    return event.code === `Key${keyPart.toUpperCase()}` || event.key.toLowerCase() === keyPart;
  } else if (!isNaN(parseInt(keyPart))) {
    return event.code === `Digit${keyPart}` || event.key === keyPart;
  } else {
    // For other keys like Enter, Escape, etc.
    return event.key.toLowerCase() === keyPart;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
