import { hashPassword } from '@/lib/utils';

export type SecurityConfig = {
  hashedPassword: string | null;
};

export async function setMasterPasswordUtil(password: string): Promise<SecurityConfig> {
  const hashedPassword = await hashPassword(password);
  const config: SecurityConfig = { hashedPassword };
  localStorage.setItem('securityConfig', JSON.stringify(config));
  return config;
}

export async function checkMasterPasswordUtil(password: string, currentHash: string | null): Promise<boolean> {
  if (!currentHash) return true;
  const hash = await hashPassword(password);
  return hash === currentHash;
}

export function deriveTagsForProtectedState(oldTags: string[], newProtectedState: boolean): string[] {
  const tags = oldTags || [];
  if (newProtectedState) {
    return tags.includes('protected') ? tags : [...tags, 'protected'];
  }
  return tags.filter(t => t !== 'protected');
}

export function addUnlockedNote(unlockedNotes: string[], id: string): string[] {
  const set = new Set(unlockedNotes || []);
  set.add(id);
  return Array.from(set);
}

export function removeUnlockedNote(unlockedNotes: string[], id: string): string[] {
  return (unlockedNotes || []).filter(noteId => noteId !== id);
}