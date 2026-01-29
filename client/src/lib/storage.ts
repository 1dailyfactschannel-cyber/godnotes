import { isElectron, setStoreValue } from './electron';

// Minimal shape of the state we persist. We avoid tight coupling to the store types.
export type PersistableState = {
  items: any[];
  trashItems: any[];
  activeFileId: string | null;
  openFiles: string[];
  expandedFolders: Set<string>;
  sortOrder: string;
  theme: string;
  offlineQueue: any[];
};

/**
 * Persist essential application state to localStorage (and Electron store when available).
 * This helper centralizes persistence logic to reduce duplication inside the store.
 */
export function persistStateToLocalStorage(state: PersistableState) {
  try {
    localStorage.setItem('localItems', JSON.stringify(state.items));
    localStorage.setItem('trashItems', JSON.stringify(state.trashItems));
    localStorage.setItem('activeFileId', state.activeFileId || '');
    localStorage.setItem('openFiles', JSON.stringify(state.openFiles));
    localStorage.setItem('expandedFolders', JSON.stringify(Array.from(state.expandedFolders)));
    localStorage.setItem('sortOrder', state.sortOrder);
    localStorage.setItem('theme', state.theme);
    localStorage.setItem('offlineQueue', JSON.stringify(state.offlineQueue));
  } catch (e) {
    // Swallow localStorage errors (e.g., quota exceeded) to avoid crashing
    // You can extend with telemetry if needed
    console.warn('Failed to persist state to localStorage', e);
  }

  if (isElectron()) {
    try {
      setStoreValue('localItems', state.items);
      setStoreValue('trashItems', state.trashItems);
      setStoreValue('activeFileId', state.activeFileId || '');
      setStoreValue('openFiles', state.openFiles);
      setStoreValue('expandedFolders', Array.from(state.expandedFolders));
      setStoreValue('sortOrder', state.sortOrder);
      setStoreValue('theme', state.theme);
    } catch (e) {
      console.warn('Failed to persist state to Electron store', e);
    }
  }
}