import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { compareItems } from './compare';
export { compareItems };
import { apiRequest, API_BASE_URL } from './api';

import { fs, getDocumentsPath, isElectron, selectDirectory, getStoreValue, setStoreValue } from './electron';
import { persistStateToLocalStorage } from './storage';
import { setMasterPasswordUtil, checkMasterPasswordUtil, deriveTagsForProtectedState, addUnlockedNote, removeUnlockedNote, type SecurityConfig } from './security';
import { useTasks } from './tasks-store';
import { authService, type User as AuthUser } from '@/lib/auth-service';
import { enqueueOffline, processOfflineQueue as processOffline, type OfflineQueueItem } from './offline-queue';
import { searchGlobalUtility } from './search';


const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export type ThemeType = 'obsidian-dark' | 'midnight-blue' | 'graphite' | 'light-mode' | 'forest' | 'sunset' | 'ocean' | 'cyberpunk';

export type SortOrder = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';


export type FileSystemItem = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  content?: string;
  createdAt: number;
  updatedAt?: number;
  isPinned?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  backlinks?: string[];
  isProtected?: boolean;
  isPublic?: boolean;
  isPending?: boolean;
};

export type User = AuthUser & {
  prefs?: {
    telegram?: string;
    telegramChatId?: string;
    aiConfig?: string;
    aiCustomConfig?: string;
  };
};

export type AIConfig = {
  provider: 'openai' | 'anthropic' | 'custom' | 'openrouter';
  apiKey: string;
  baseUrl?: string;
  model: string;
  availableModels?: string[];
};


export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '', 
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  availableModels: []
};

interface FileSystemState {
  items: FileSystemItem[];
  trashItems: FileSystemItem[];
  activeFileId: string | null;
  openFiles: string[];
  expandedFolders: Set<string>;
  lastCreatedFileId: string | null;
  lastCreatedFolderId: string | null;
  searchQuery: string;
  sortOrder: SortOrder;
  theme: ThemeType;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  user: User | null;
  hotkeys: Record<string, string>;
  localDocumentsPath: string | null;
  syncManifest: Record<string, number>;
  syncInterval: NodeJS.Timeout | null;
  isOfflineMode: boolean;
  aiConfig: AIConfig;
  securityConfig: SecurityConfig;
  unlockedNotes: string[];
  isZenMode: boolean;
  lastSavedAt: number | null;
  lastSavedFileId: string | null;
  offlineQueue: OfflineQueueItem[];
  saveToLocalStorage: () => void;
  setStoragePath: (path: string) => void;
  sessionRefreshInterval: NodeJS.Timeout | null;
  startSessionRefresh: () => void;
  stopSessionRefresh: () => void;
  
  toggleOfflineMode: () => void;
  toggleZenMode: () => void;
  updateUserPrefs: (prefs: Record<string, any>) => Promise<void>;
  updateAccountPassword: (password: string, oldPassword: string) => Promise<void>;
  initLocalFs: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  fetchTrash: () => Promise<void>;
  syncMissingNotes: () => Promise<void>;
  checkAuth: () => Promise<void>;
  addFile: (parentId: string | null, name?: string, initialContent?: string) => Promise<void>;
  addDailyNote: () => Promise<void>;
  addFolder: (parentId: string | null, name?: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentDeleteItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  renameItem: (id: string, newName: string) => Promise<void>;
  updateFileContent: (id: string, content: string) => void;
  updateBacklinks: (noteId: string, content: string) => void;
  loadFileContent: (id: string, content: string) => void;
  selectFile: (id: string) => void;
  closeFile: (id: string) => void;
  closeAllFiles: () => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setSortOrder: (order: SortOrder) => void;
  setTheme: (theme: ThemeType) => void;
  setHotkey: (action: string, key: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateRecovery: (userId: string, secret: string, password: string, passwordAgain: string) => Promise<void>;
  logout: (onSuccess?: () => void) => Promise<void>;
  clearUserData: () => void;
  togglePin: (id: string) => void;
  toggleFavorite: (id: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => Promise<void>;
  applyTemplate: (id: string, templateContent: string) => void;
  moveItem: (id: string, newParentId: string | null) => Promise<void>;
  downloadAllFiles: () => Promise<void>;
  fetchContent: (id: string) => Promise<void>;
  loadSyncManifest: () => Promise<void>;
  saveSyncManifest: () => Promise<void>;
  startPeriodicSync: () => void;
  stopPeriodicSync: () => void;
  syncBackground: () => Promise<void>;
  searchGlobal: (query: string) => Promise<FileSystemItem[]>;
  updateAIConfig: (config: Partial<AIConfig>) => void;
  toggleLock: (id: string) => void;
  setMasterPassword: (password: string) => Promise<void>;
  checkMasterPassword: (password: string) => Promise<boolean>;
  unlockNote: (id: string, password: string) => Promise<boolean>;
  lockNote: (id: string) => void;
  togglePublic: (id: string) => Promise<string | null>;
  createVersion: (id: string) => Promise<void>;
  getVersions: (id: string) => Promise<FileSystemItem[]>;
  restoreVersion: (id: string, content: string) => Promise<void>;
  enqueueOfflineOp: (op: { method: 'PATCH'|'POST'|'DELETE'; endpoint: string; payload?: any; itemId?: string }) => void;
  processOfflineQueue: () => Promise<void>;
}

const initialItems: FileSystemItem[] = [];

export const useFileSystem = create<FileSystemState>((set, get) => ({
  items: initialItems,
  trashItems: [],
  activeFileId: null,
  openFiles: [],
  expandedFolders: new Set(),
  lastCreatedFileId: null,
  lastCreatedFolderId: null,
  searchQuery: '',
  sortOrder: 'name-asc',
  theme: 'obsidian-dark',
  // Состояния аутентификации теперь берутся из useAuthContext
  isAuthenticated: false,
  isAuthChecking: true,
  user: null,
  localDocumentsPath: null,
  syncManifest: {},
  syncInterval: null,
  isZenMode: false,
  isOfflineMode: localStorage.getItem('isOfflineMode') === 'true',
  lastSavedAt: null,
  lastSavedFileId: null,
  sessionRefreshInterval: null,
  aiConfig: (() => {
    try {
      const saved = localStorage.getItem('aiConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
      return DEFAULT_AI_CONFIG;
    } catch {
      return DEFAULT_AI_CONFIG;
    }
  })(),
  securityConfig: (() => {
    try {
      const saved = localStorage.getItem('securityConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { hashedPassword: parsed.hashedPassword || null };
      }
      return { hashedPassword: null };
    } catch {
      return { hashedPassword: null };
    }
  })(),
  unlockedNotes: [],
  hotkeys: (() => {
    const defaults = {
      commandPalette: 'Ctrl+K',
      bold: 'Ctrl+B',
      italic: 'Ctrl+I',
      link: 'Ctrl+L', // Changed from Ctrl+K to avoid conflict
      taskList: 'Ctrl+Shift+9',
      newNote: 'Ctrl+Alt+N',
      settings: 'Ctrl+,',
      toggleSidebar: 'Ctrl+\\'
    };

    try {
      const saved = localStorage.getItem('hotkeys');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  })(),
  offlineQueue: (() => {
    try {
      const saved = localStorage.getItem('offlineQueue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  // Вспомогательная функция для сохранения состояния в LocalStorage
  saveToLocalStorage: () => {
    const state = get();
    persistStateToLocalStorage({
      items: state.items,
      trashItems: state.trashItems,
      activeFileId: state.activeFileId || null,
      openFiles: state.openFiles,
      expandedFolders: state.expandedFolders,
      sortOrder: state.sortOrder,
      theme: state.theme,
      offlineQueue: state.offlineQueue,
    });
  },

  setStoragePath: (path: string) => {
    set({ localDocumentsPath: path });
  },

  toggleOfflineMode: () => {
    const newVal = !get().isOfflineMode;
    localStorage.setItem('isOfflineMode', String(newVal));
    set({ isOfflineMode: newVal });
    if (!newVal) {
      get().processOfflineQueue();
    }
  },

  toggleZenMode: () => {
    set(state => ({ isZenMode: !state.isZenMode }));
  },

  enqueueOfflineOp: (op) => {
    set(state => {
      const newQueue = enqueueOffline(state.offlineQueue, op);
      localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
      return { offlineQueue: newQueue };
    });
  },

  processOfflineQueue: async () => {
    const state = get();
    const newQueue = await processOffline(state.offlineQueue, {
      isAuthenticated: state.isAuthenticated,
      isOfflineMode: state.isOfflineMode,
      onUnauthorized: () => set({ isAuthenticated: false, user: null })
    });
    set({ offlineQueue: newQueue });
    localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
  },

  updateUserPrefs: async (prefs) => {
    const user = get().user;
    if (!user) return;
    try {
      const currentPrefs = user.prefs || {};
      const newPrefs = { ...currentPrefs, ...prefs };
      
      // Store user preferences locally
      const userSettingsKey = `user_settings_${(user as any).id ?? (user as any).$id}`;
      localStorage.setItem(userSettingsKey, JSON.stringify(newPrefs));
      
      // Update local user object
      const updatedUser = { ...user, prefs: newPrefs };
      set({ user: updatedUser });
      
      console.log('User prefs updated in localStorage:', newPrefs);
    } catch (error) {
      console.error('Failed to update user prefs:', error);
      throw error;
    }
  },

  updateAccountPassword: async (password, oldPassword) => {
    try {
      await authService.updatePassword(oldPassword, password);
    } catch (error) {
      console.error('Failed to update account password:', error);
      throw error;
    }
  },

  initLocalFs: async () => {
    if (isElectron()) {
      let path = await getStoreValue('storagePath');

      if (!path) {
        // Check if default path has data, to support existing users
        const defaultPath = await getDocumentsPath();
        if (defaultPath) {
          path = defaultPath;
          await setStoreValue('storagePath', path);
        }
      }

      if (path) {
        set({ localDocumentsPath: path });
        // Ensure godnotes directory exists
        const godnotesPath = `${path}/GodNotes`;
        const exists = await fs?.exists(godnotesPath);
        if (!exists && fs) {
            // We need mkdir but our current API only has writeFile/readFile/exists/deleteFile
            // However, fs-write-file in main.js handles mkdir recursive.
            // So we can just write a dummy file or wait until first write.
        }
        try {
          const storedItems = await getStoreValue('localItems');
          const storedActiveFileId = await getStoreValue('activeFileId');
          const storedOpenFiles = await getStoreValue('openFiles');
          const storedExpanded = await getStoreValue('expandedFolders');
          const storedSort = await getStoreValue('sortOrder');
          const storedTheme = await getStoreValue('theme');
          set(state => ({
            items: Array.isArray(storedItems) ? storedItems : state.items,
            activeFileId: typeof storedActiveFileId === 'string' ? storedActiveFileId : state.activeFileId,
            openFiles: Array.isArray(storedOpenFiles) ? storedOpenFiles : state.openFiles,
            expandedFolders: Array.isArray(storedExpanded) ? new Set(storedExpanded) : state.expandedFolders,
            sortOrder: typeof storedSort === 'string' ? storedSort as SortOrder : state.sortOrder,
            theme: typeof storedTheme === 'string' ? storedTheme as ThemeType : state.theme,
          }));
        } catch {}
      } else {
        set({ localDocumentsPath: null });
      }
    }
  },

  fetchFolders: async () => {
    // Load folders from API and merge into items (preserve local-only folders)
    if (!get().isAuthenticated || get().isOfflineMode) return;
    try {
      const folders = await apiRequest('GET', '/folders');
      if (!folders) return;

      const serverFolders: FileSystemItem[] = folders.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: 'folder',
        parentId: f.parentId || null,
        createdAt: new Date(f.createdAt).getTime(),
        updatedAt: f.updatedAt ? new Date(f.updatedAt).getTime() : undefined,
        isFavorite: !!f.isFavorite,
        tags: Array.isArray(f.tags) ? f.tags : []
      }));

      const stateItems = get().items;
      const nonFolderItems = stateItems.filter(i => i.type !== 'folder');
      const currentFolders = stateItems.filter(i => i.type === 'folder');

      // Merge by id: start from existing folders, update/add from server
      const folderMap = new Map<string, FileSystemItem>(currentFolders.map(f => [f.id, f]));
      for (const sf of serverFolders) {
        const existing = folderMap.get(sf.id);
        if (existing) {
          folderMap.set(sf.id, {
            ...existing,
            name: sf.name,
            parentId: sf.parentId,
            createdAt: sf.createdAt,
            updatedAt: sf.updatedAt,
            isFavorite: sf.isFavorite,
            tags: sf.tags,
          });
        } else {
          folderMap.set(sf.id, sf);
        }
      }

      set({ items: [...Array.from(folderMap.values()), ...nonFolderItems] });
    } catch (e) {
      console.error('Failed to fetch folders:', e);
    }
  },

  fetchNotes: async () => {
    // Load notes from API and merge into items (preserve local-only notes)
    if (!get().isAuthenticated || get().isOfflineMode) return;
    try {
      const notes = await apiRequest('GET', '/notes');
      if (!notes) return;

      const serverNotes: FileSystemItem[] = notes.map((n: any) => ({
        id: n.id,
        name: n.title,
        type: 'file',
        parentId: n.folderId || null,
        content: n.content,
        createdAt: new Date(n.createdAt).getTime(),
        updatedAt: n.updatedAt ? new Date(n.updatedAt).getTime() : undefined,
        isFavorite: !!n.isFavorite,
        tags: Array.isArray(n.tags) ? n.tags : [],
        isPublic: !!n.isPublic
      }));

      const stateItems = get().items;
      const nonFileItems = stateItems.filter(i => i.type !== 'file');
      const currentNotes = stateItems.filter(i => i.type === 'file');

      // Merge by id: start from existing notes, update/add from server
      const noteMap = new Map<string, FileSystemItem>(currentNotes.map(n => [n.id, n]));
      for (const sn of serverNotes) {
        const existing = noteMap.get(sn.id);
        if (existing) {
          noteMap.set(sn.id, {
            ...existing,
            name: sn.name,
            parentId: sn.parentId,
            content: sn.content,
            createdAt: sn.createdAt,
            updatedAt: sn.updatedAt,
            isFavorite: sn.isFavorite,
            tags: sn.tags,
            isPublic: sn.isPublic,
          });
        } else {
          noteMap.set(sn.id, sn);
        }
      }

      set({ items: [...nonFileItems, ...Array.from(noteMap.values())] });
    } catch (e) {
      console.error('Failed to fetch notes:', e);
    }
  },

  fetchTrash: async () => {
    if (!get().isAuthenticated || get().isOfflineMode) return;
    try {
        const trash = await apiRequest('GET', '/trash');
        if (!trash) return;

        const trashFolders: FileSystemItem[] = trash.folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            type: 'folder',
            parentId: f.parentId || null,
            createdAt: new Date(f.createdAt).getTime(),
            updatedAt: new Date(f.updatedAt).getTime(),
            isFavorite: f.isFavorite,
            tags: f.tags || []
        }));

        const trashNotes: FileSystemItem[] = trash.notes.map((n: any) => ({
            id: n.id,
            name: n.title,
            type: 'file',
            parentId: n.folderId || null,
            content: n.content,
            createdAt: new Date(n.createdAt).getTime(),
            updatedAt: new Date(n.updatedAt).getTime(),
            isFavorite: n.isFavorite,
            tags: n.tags || [],
            isPublic: n.isPublic
        }));

        set({ trashItems: [...trashFolders, ...trashNotes] });
    } catch (e) {
        console.error('Failed to fetch trash:', e);
    }
  },

  // Create missing server notes for local-only files and migrate temp ids to server ids
  syncMissingNotes: async () => {
    const state = get();
    if (!state.isAuthenticated || state.isOfflineMode) return;
    try {
      const serverNotes: any[] = await apiRequest('GET', '/notes');
      const serverIds = new Set<string>((serverNotes || []).map((n: any) => n.id));
      const localFiles = state.items.filter(i => i.type === 'file');

      for (const localItem of localFiles) {
        if (!serverIds.has(localItem.id)) {
          try {
            const created = await apiRequest('POST', '/notes', {
              title: localItem.name,
              content: localItem.content ?? '',
              folderId: localItem.parentId ?? null,
              isFavorite: !!localItem.isFavorite,
              tags: localItem.tags || []
            });
            const createdUpdatedAt = new Date(created.updatedAt).getTime();
            set(s => ({
              items: s.items.map(i => i.id === localItem.id ? { ...i, id: created.id, createdAt: new Date(created.createdAt).getTime(), updatedAt: createdUpdatedAt } : i),
              activeFileId: s.activeFileId === localItem.id ? created.id : s.activeFileId,
              openFiles: s.openFiles.map(fid => fid === localItem.id ? created.id : fid),
              lastCreatedFileId: s.lastCreatedFileId === localItem.id ? created.id : s.lastCreatedFileId
            }));
            get().saveToLocalStorage();
            if (state.localDocumentsPath && isElectron() && fs) {
              const oldPath = `${state.localDocumentsPath}/GodNotes/${localItem.id}.md`;
              const newPath = `${state.localDocumentsPath}/GodNotes/${created.id}.md`;
              try {
                const existsOld = await fs.exists(oldPath);
                if (existsOld) {
                  const readRes = await fs.readFile(oldPath);
                  if (readRes.success && typeof readRes.content === 'string') {
                    await fs.writeFile(newPath, readRes.content);
                    await fs.deleteFile(oldPath);
                  } else {
                    await fs.writeFile(newPath, localItem.content ?? '');
                  }
                } else {
                  await fs.writeFile(newPath, localItem.content ?? '');
                }
              } catch (fsErr) {
                console.error('syncMissingNotes: local file migration failed', fsErr);
              }
            }
            try {
              const manifest = { ...get().syncManifest };
              delete manifest[localItem.id];
              manifest[created.id] = createdUpdatedAt;
              set({ syncManifest: manifest });
              await get().saveSyncManifest();
            } catch (mErr) {
              console.error('syncMissingNotes: manifest update failed', mErr);
            }
            try {
              const prevQueue = get().offlineQueue || [];
              const migratedQueue = prevQueue.map(q => {
                if (q.itemId === localItem.id || q.endpoint === `/notes/${localItem.id}`) {
                  const newEndpoint = q.endpoint.replace(`/notes/${localItem.id}`, `/notes/${created.id}`);
                  return { ...q, itemId: q.itemId === localItem.id ? created.id : q.itemId, endpoint: newEndpoint };
                }
                return q;
              });
              set({ offlineQueue: migratedQueue });
              localStorage.setItem('offlineQueue', JSON.stringify(migratedQueue));
            } catch (qErr) {
              console.error('syncMissingNotes: offline queue rewrite failed', qErr);
            }
            set({ lastSavedAt: Date.now(), lastSavedFileId: created.id });
          } catch (createErr) {
            console.error('syncMissingNotes: failed to create server note', createErr);
          }
        }
      }
    } catch (e) {
      console.error('syncMissingNotes failed', e);
    }
  },

  checkAuth: async () => {
    set({ isAuthChecking: true });
    try {
      console.log('checkAuth: Starting authentication check');
      
      // Use our new JWT-based auth service
      const currentUser = await authService.getCurrentUser();
      console.log('checkAuth: Current user from authService:', currentUser);
      
      if (currentUser) {
        const user = {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          username: currentUser.username,
          avatar_url: currentUser.avatar_url,
          is_verified: currentUser.is_verified,
          is_active: currentUser.is_active,
          created_at: currentUser.created_at,
          prefs: {},
        };
        
        set({ isAuthenticated: true, user: user as unknown as User });
        
        // Only fetch data if we don't have items loaded yet
        const currentState = get();
        console.log('checkAuth: Fetching user data (folders and notes)');
        await Promise.all([get().fetchFolders(), get().fetchNotes()]);
        await get().processOfflineQueue();
        await get().syncMissingNotes();

        // Validate activeFileId and openFiles
        const state = get();
        const allIds = new Set(state.items.map(i => i.id));
        if (state.activeFileId && !allIds.has(state.activeFileId)) {
          set({ activeFileId: null });
        }
        const validOpenFiles = state.openFiles.filter(id => allIds.has(id));
        if (validOpenFiles.length !== state.openFiles.length) {
          set({ openFiles: validOpenFiles });
        }
      } else {
        console.log('checkAuth: No user found, setting unauthenticated');
        set({ isAuthenticated: false, user: null });
      }
    } catch (error: any) {
      console.error('checkAuth failed:', error);
      set({ isAuthenticated: false, user: null });
    } finally {
      set({ isAuthChecking: false });
    }
  },

  addFile: async (parentId: string | null, name: string = 'Новая заметка', initialContent: string = '') => {
    // Explicitly handle parentId to ensure it's not lost.
    // Ensure empty string is treated as null.
    const effectiveParentId = (typeof parentId === 'string' && parentId.trim().length > 0) ? parentId : null;
    
    // Check if we need to select a local path first
    if (isElectron() && !get().localDocumentsPath) {
       const path = await getDocumentsPath();
       if (!path) return;
       
       await setStoreValue('storagePath', path);
       set({ localDocumentsPath: path });
       await get().initLocalFs();
    }

    const state = get();
    const createdAt = Date.now();

    // Optimistically create a local item with temp id
    const tempId = uuidv4();
    const newFile: FileSystemItem = {
      id: tempId,
      name,
      type: 'file',
      parentId: effectiveParentId,
      content: initialContent,
      createdAt,
    };

    set((s) => {
      const expanded = new Set(s.expandedFolders);
      if (effectiveParentId) expanded.add(effectiveParentId);
      const existingItems = s.items.filter(i => i.id !== tempId);
      return {
        items: [...existingItems, newFile],
        activeFileId: tempId,
        expandedFolders: expanded,
        lastCreatedFileId: tempId,
      };
    });
    get().saveToLocalStorage();

    if (!state.isAuthenticated || !state.user) {
      return;
    }

    try {
      const created = await apiRequest('POST', '/notes', {
        title: name,
        content: initialContent,
        folderId: effectiveParentId,
        isFavorite: false,
        tags: []
      });

      // Replace temp item with server item
      set((s) => {
        const items = s.items.map(i => i.id === tempId ? {
          ...i,
          id: created.id,
          createdAt: new Date(created.createdAt).getTime(),
          updatedAt: new Date(created.updatedAt).getTime(),
        } : i);
        return {
          items,
          activeFileId: created.id,
          lastCreatedFileId: created.id,
        };
      });
      get().saveToLocalStorage();
    } catch (error: any) {
      console.error('Failed to create note on server (kept locally):', error);
      if (String(error).includes('401')) {
        set({ isAuthenticated: false, user: null });
      }
    }
  },

  addDailyNote: async () => {
    const state = get();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const folderName = 'Daily Notes';
    
    // 1. Find or create "Daily Notes" folder
    let dailyFolder = state.items.find(i => i.name === folderName && i.type === 'folder' && i.parentId === null);
    
    if (!dailyFolder) {
      const folderId = uuidv4();
      await state.addFolder(null, folderName);
      dailyFolder = get().items.find(i => i.id === folderId) || get().items.find(i => i.name === folderName);
    }
    
    const folderId = dailyFolder?.id || null;
    
    // 2. Check if note for today already exists in that folder
    const existingNote = state.items.find(i => i.name === dateStr && i.type === 'file' && i.parentId === folderId);
    
    if (existingNote) {
      state.selectFile(existingNote.id);
      return;
    }
    
    // 3. Create new note for today
    const noteId = uuidv4();
    const welcomeText = `<h1>📅 Заметка на ${dateStr}</h1><p>Что вы планируете сделать сегодня?</p><ul><li></li></ul>`;
    
    set((s) => ({
      items: [...s.items, {
        id: noteId,
        name: dateStr,
        type: 'file',
        parentId: folderId,
        content: welcomeText,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['daily']
      }],
      activeFileId: noteId,
      openFiles: [...new Set([...s.openFiles, noteId])]
    }));
    
    get().saveToLocalStorage();
    
    // 4. Sync to server if authenticated
    if (state.isAuthenticated && state.user) {
      try {
        const note = await apiRequest('POST', '/notes', {
            title: dateStr,
            content: welcomeText,
            folderId: folderId,
            isFavorite: false,
            tags: ['daily']
        });
        
        // Update local ID with server ID
        set(s => ({
            items: s.items.map(i => i.id === noteId ? { ...i, id: note.id } : i),
            activeFileId: s.activeFileId === noteId ? note.id : s.activeFileId,
            openFiles: s.openFiles.map(id => id === noteId ? note.id : id)
        }));
      } catch (err) {
        console.error('Failed to sync daily note:', err);
      }
    }
  },

  addFolder: async (parentId, name = 'Новая папка') => {
    // Explicitly handle parentId
    const effectiveParentId = (typeof parentId === 'string' && parentId.trim().length > 0) ? parentId : null;

    // Check if we need to select a local path first
    if (isElectron() && !get().localDocumentsPath) {
       const path = await selectDirectory();
       if (!path) return; // User cancelled
       
       await setStoreValue('storagePath', path);
       set({ localDocumentsPath: path });
       await get().initLocalFs();
    }

    const state = get();

    if (!state.isAuthenticated || !state.user) {
      // Offline mode or not authenticated - use local ID
      const newId = uuidv4();
      const createdAt = Date.now();
      
      const newFolder: FileSystemItem = {
        id: newId,
        name,
        type: 'folder',
        parentId: effectiveParentId,
        createdAt: createdAt,
      };

      set((s) => {
          const expanded = new Set(s.expandedFolders);
          expanded.add(newId);
          if (effectiveParentId) expanded.add(effectiveParentId);
          
          return {
            items: [...s.items, newFolder],
            expandedFolders: expanded,
            lastCreatedFolderId: newId,
          };
      });
      get().saveToLocalStorage();
      return;
    }

    // Онлайн-режим: оптимистичное создание
    const tempId = uuidv4();
    const createdAt = Date.now();

    set((s) => {
      const expanded = new Set(s.expandedFolders);
      expanded.add(tempId);
      if (effectiveParentId) expanded.add(effectiveParentId);
      const tempFolder: FileSystemItem = {
        id: tempId,
        name,
        type: 'folder',
        parentId: effectiveParentId,
        createdAt,
        isPending: true,
      };
      return {
        items: [...s.items, tempFolder],
        expandedFolders: expanded,
        lastCreatedFolderId: tempId,
      };
    });
    get().saveToLocalStorage();

    try {
      const folder = await apiRequest('POST', '/folders', {
        name,
        parentId: effectiveParentId
      });

      set((s) => {
        const expanded = new Set(s.expandedFolders);
        const currentTemp = s.items.find(i => i.id === tempId);
        const serverFolder: FileSystemItem = {
          id: folder.id,
          name: currentTemp?.name ?? folder.name,
          type: 'folder',
          parentId: folder.parentId,
          createdAt: new Date(folder.createdAt).getTime(),
          updatedAt: new Date(folder.updatedAt).getTime(),
          isFavorite: folder.isFavorite,
          tags: folder.tags || []
        };
        const items = s.items.map(i => i.id === tempId ? serverFolder : i);
        expanded.delete(tempId);
        expanded.add(serverFolder.id);
        if (effectiveParentId) expanded.add(effectiveParentId);
        return {
          items,
          expandedFolders: expanded,
          lastCreatedFolderId: serverFolder.id,
        };
      });
      get().saveToLocalStorage();
    } catch (error: any) {
      // Откат оптимистичного элемента
      set((s) => ({ items: s.items.filter(i => i.id !== tempId) }));
      console.error('Failed to create folder on server:', error);
      if (error.message?.includes('401')) {
        set({ isAuthenticated: false, user: null });
      }
    }
  },

  deleteItem: async (id) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    
    const getAllDescendants = (itemId: string): string[] => {
      const children = state.items.filter(i => i.parentId === itemId);
      return [itemId, ...children.flatMap(c => getAllDescendants(c.id))];
    };
    
    const idsToDelete = getAllDescendants(id);
    const timestamp = Date.now();
    const deletedTag = `deleted:${timestamp}`;

    // Optimistically update UI
    set((state) => {
      const idsSet = new Set(idsToDelete);
      const itemsToDelete = state.items.filter(i => idsSet.has(i.id));
      const newItems = state.items.filter(i => !idsSet.has(i.id));
      const newActiveId = idsSet.has(state.activeFileId || '') ? null : state.activeFileId;
      
      const newTrashItems = [
        ...state.trashItems, 
        ...itemsToDelete.map(i => ({
          ...i,
          tags: [...(i.tags || []), deletedTag]
        }))
      ];

      return {
        items: newItems,
        trashItems: newTrashItems,
        activeFileId: newActiveId,
      };
    });
    get().saveToLocalStorage();

    if (!state.isAuthenticated || state.isOfflineMode) {
      const itemsToDelete = state.items.filter(i => idsToDelete.includes(i.id));
      for (const it of itemsToDelete) {
        const collectionId = it.type === 'folder' ? 'folders' : 'notes';
        const newTags = [...(it.tags || []), deletedTag];
        get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${it.id}`, payload: { tags: newTags }, itemId: it.id });
      }
      return;
    }

    try {
      for (const deleteId of idsToDelete) {
        const itemToDelete = state.items.find(i => i.id === deleteId); // This might be undefined since we just removed it from state?
        // Actually we should capture it before set. But we can't easily.
        // Wait, 'item' is the top level one. We can find others.
        // But better to iterate idsToDelete and find in the original state capture if possible?
        // No, we need the item type to know collection.
        // Let's rely on the item found in state BEFORE the set call.
        // Wait, I can't access 'state.items' inside the loop if 'state' is the old one.
        // Yes I can, 'state' is 'get()'.
        // But I need to know which collection.
        // Let's rebuild the itemsToDelete list before set.
      }
      
      const itemsToDelete = state.items.filter(i => idsToDelete.includes(i.id));
      
      for (const item of itemsToDelete) {
         const collectionId = item.type === 'folder' ? 'folders' : 'notes';
         const newTags = [...(item.tags || []), deletedTag];
         await apiRequest('PATCH', `/${collectionId}/${item.id}`, { tags: newTags });
      }
      
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      if (error.code === 401) {
          set({ isAuthenticated: false, user: null });
      }
      // Revert logic would be complex, let's assume success or partial success.
    }
  },

  restoreItem: async (id) => {
    const state = get();
    const item = state.trashItems.find(i => i.id === id);
    if (!item) return;

    // We should also restore descendants if they were deleted at the same time?
    // Or just restore the item itself.
    // If we restore a folder, we probably want its children.
    // Children in trash also have 'deleted:' tag.
    // But how do we know they are children? 'parentId' is still set.
    
    const getAllTrashDescendants = (itemId: string): string[] => {
        const children = state.trashItems.filter(i => i.parentId === itemId);
        return [itemId, ...children.flatMap(c => getAllTrashDescendants(c.id))];
    };

    const idsToRestore = getAllTrashDescendants(id);

    // Optimistically update
    set((state) => {
        const idsSet = new Set(idsToRestore);
        const itemsToRestore = state.trashItems.filter(i => idsSet.has(i.id));
        const newTrashItems = state.trashItems.filter(i => !idsSet.has(i.id));
        
        const restoredItems = itemsToRestore.map(i => ({
            ...i,
            tags: (i.tags || []).filter(t => !t.startsWith('deleted:'))
        }));

        return {
            items: [...state.items, ...restoredItems],
            trashItems: newTrashItems
        };
    });
    get().saveToLocalStorage();

    if (!state.isAuthenticated || state.isOfflineMode) {
        const itemsToRestore = state.trashItems.filter(i => idsToRestore.includes(i.id));
        for (const it of itemsToRestore) {
          if (it.type === 'folder') {
            get().enqueueOfflineOp({ method: 'POST', endpoint: `/trash/restore/folder/${it.id}`, payload: {}, itemId: it.id });
          } else {
            get().enqueueOfflineOp({ method: 'POST', endpoint: `/trash/restore/note/${it.id}`, payload: {}, itemId: it.id });
          }
        }
        return;
    }

    try {
        const itemsToRestore = state.trashItems.filter(i => idsToRestore.includes(i.id));
        for (const item of itemsToRestore) {
            if (item.type === 'folder') {
              await apiRequest('POST', `/trash/restore/folder/${item.id}`);
            } else {
              await apiRequest('POST', `/trash/restore/note/${item.id}`);
            }
        }
    } catch (error: any) {
        console.error('Failed to restore item:', error);
        if (String(error).includes('401')) {
            set({ isAuthenticated: false, user: null });
        }
    }
  },

  permanentDeleteItem: async (id) => {
    const state = get();
    // Should also delete descendants permanently
    const getAllTrashDescendants = (itemId: string): string[] => {
        const children = state.trashItems.filter(i => i.parentId === itemId);
        return [itemId, ...children.flatMap(c => getAllTrashDescendants(c.id))];
    };

    const idsToDelete = getAllTrashDescendants(id);

    set((state) => ({
        trashItems: state.trashItems.filter(i => !idsToDelete.includes(i.id))
    }));
    get().saveToLocalStorage();

    if (!state.isAuthenticated || state.isOfflineMode) {
        const itemsToDelete = state.trashItems.filter(i => idsToDelete.includes(i.id));
        for (const it of itemsToDelete) {
            const collectionId = it.type === 'folder' ? 'folders' : 'notes';
            get().enqueueOfflineOp({ method: 'DELETE', endpoint: `/${collectionId}/${it.id}`, payload: {}, itemId: it.id });
        }
        return;
    }

    try {
        const itemsToDelete = state.trashItems.filter(i => idsToDelete.includes(i.id));
        for (const item of itemsToDelete) {
            const collectionId = item.type === 'folder' ? 'folders' : 'notes';
            await apiRequest('DELETE', `/${collectionId}/${item.id}`);
        }
    } catch (error: any) {
        console.error('Failed to permanently delete item:', error);
        if (error.message?.includes('401')) {
            set({ isAuthenticated: false, user: null });
        }
    }
  },

  emptyTrash: async () => {
    const state = get();
    if (state.trashItems.length === 0) return;

    // Optimistic update
    const itemsToDelete = [...state.trashItems];
    set({ trashItems: [] });
    get().saveToLocalStorage();

    if (!state.isAuthenticated || state.isOfflineMode) {
        for (const it of itemsToDelete) {
            const collectionId = it.type === 'folder' ? 'folders' : 'notes';
            get().enqueueOfflineOp({ method: 'DELETE', endpoint: `/${collectionId}/${it.id}`, payload: {}, itemId: it.id });
        }
        return;
    }

    try {
        await Promise.all(itemsToDelete.map(item => {
            const collectionId = item.type === 'folder' ? 'folders' : 'notes';
            return apiRequest('DELETE', `/${collectionId}/${item.id}`);
        }));
    } catch (error: any) {
        console.error('Failed to empty trash:', error);
        if (error.message?.includes('401')) {
            set({ isAuthenticated: false, user: null });
        }
        // Re-fetch to ensure consistency if something failed
        await get().fetchTrash();
    }
  },

  renameItem: async (id, newName) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    // Optimistically update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, name: newName } : i),
    }));
    get().saveToLocalStorage();

    if (!get().isAuthenticated || get().isOfflineMode) {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      const payload = item.type === 'folder' ? { name: newName } : { title: newName };
      get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${id}`, payload, itemId: id });
      return;
    }

    try {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      const endpoint = `/${collectionId}/${id}`;
      
      // Handle rename via API
      await apiRequest('PATCH', endpoint, {
          [item.type === 'folder' ? 'name' : 'title']: newName
      });
    } catch (error: any) {
      console.error('Failed to rename item:', error);
      if (error.message?.includes('401')) {
          set({ isAuthenticated: false, user: null });
      }
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, name: item.name } : i),
      }));
    }
  },

  updateFileContent: async (id, content) => {
    console.log(`updateFileContent called for id: ${id}, content length: ${content.length}`);
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, content } : i),
    }));
    get().saveToLocalStorage();
    get().updateBacklinks(id, content);

    const item = get().items.find(i => i.id === id);
    const state = get();
    if (!item || item.type !== 'file') {
      return;
    }

    const existingTimeout = saveTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(async () => {
      try {
        // Save to local FS (if Electron) - Debounced
        if (state.localDocumentsPath && isElectron() && fs) {
            const localPath = `${state.localDocumentsPath}/GodNotes/${id}.md`;
            // Fire and forget or await? Await is safer here since we are in async timeout
            await fs.writeFile(localPath, content).catch(e => console.error('Failed to save locally:', e));
             
             // Update local sync manifest to mark local version as latest
             const now = Date.now();
             const manifest = { ...get().syncManifest, [id]: now };
             set({ syncManifest: manifest });
             await get().saveSyncManifest();
        }

        // Save to server via REST if authenticated and online
        if (state.isAuthenticated && !state.isOfflineMode) {
            const updated = await apiRequest('PATCH', `/notes/${id}`, { content });
            const newUpdatedAt = new Date(updated.updatedAt).getTime();
            set(s => ({
                items: s.items.map(i => i.id === id ? { ...i, updatedAt: newUpdatedAt } : i)
            }));

            if (state.localDocumentsPath && isElectron()) {
                const manifest = { ...get().syncManifest, [id]: newUpdatedAt };
                set({ syncManifest: manifest });
                await get().saveSyncManifest();
            }
        } else {
            get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/notes/${id}`, payload: { content }, itemId: id });
        }
        set({ lastSavedAt: Date.now(), lastSavedFileId: id });
      } catch (error: any) {
        const msg = String(error?.message || error);
        console.error('Failed to update note content:', error);
        // Handle unauthorized cases robustly
        if (msg.includes('401') || (error as any)?.code === 401) {
            set({ isAuthenticated: false, user: null });
        }
        // Fallback: if note doesn't exist on server (404), create it and replace local id
        if (msg.includes('404') && state.isAuthenticated && !state.isOfflineMode) {
            const localItem = get().items.find(i => i.id === id);
            if (localItem && localItem.type === 'file') {
                try {
                    const created = await apiRequest('POST', '/notes', {
                        title: localItem.name,
                        content,
                        folderId: localItem.parentId ?? null,
                        isFavorite: !!localItem.isFavorite,
                        tags: localItem.tags || []
                    });
                    const createdUpdatedAt = new Date(created.updatedAt).getTime();
                    // Update in-memory items and UI references to new id
                    set(s => ({
                        items: s.items.map(i => i.id === id ? { ...i, id: created.id, createdAt: new Date(created.createdAt).getTime(), updatedAt: createdUpdatedAt } : i),
                        activeFileId: s.activeFileId === id ? created.id : s.activeFileId,
                        openFiles: s.openFiles.map(fid => fid === id ? created.id : fid),
                        lastCreatedFileId: s.lastCreatedFileId === id ? created.id : s.lastCreatedFileId
                    }));
                    get().saveToLocalStorage();

                    // Migrate local file from old id to new id (Electron)
                    if (state.localDocumentsPath && isElectron() && fs) {
                        const oldPath = `${state.localDocumentsPath}/GodNotes/${id}.md`;
                        const newPath = `${state.localDocumentsPath}/GodNotes/${created.id}.md`;
                        try {
                            const existsOld = await fs.exists(oldPath);
                            if (existsOld) {
                                const readRes = await fs.readFile(oldPath);
                                if (readRes.success && typeof readRes.content === 'string') {
                                    await fs.writeFile(newPath, readRes.content);
                                    await fs.deleteFile(oldPath);
                                } else {
                                    await fs.writeFile(newPath, content);
                                }
                            } else {
                                // If the old file wasn't found, at least ensure the new file exists with current content
                                await fs.writeFile(newPath, content);
                            }
                        } catch (fsErr) {
                            console.error('Local file migrate failed:', fsErr);
                        }
                    }

                    // Update sync manifest: remove old id, set new id
                    try {
                        const manifest = { ...get().syncManifest };
                        delete manifest[id];
                        manifest[created.id] = createdUpdatedAt;
                        set({ syncManifest: manifest });
                        await get().saveSyncManifest();
                    } catch (mErr) {
                        console.error('Failed to update sync manifest during id migration:', mErr);
                    }

                    // Rewrite offline queue entries to point to the new id
                    try {
                        const prevQueue = get().offlineQueue || [];
                        const migratedQueue = prevQueue.map(q => {
                            if (q.itemId === id || q.endpoint === `/notes/${id}`) {
                                const newEndpoint = q.endpoint.replace(`/notes/${id}`, `/notes/${created.id}`);
                                return { ...q, itemId: q.itemId === id ? created.id : q.itemId, endpoint: newEndpoint };
                            }
                            return q;
                        });
                        set({ offlineQueue: migratedQueue });
                        localStorage.setItem('offlineQueue', JSON.stringify(migratedQueue));
                    } catch (qErr) {
                        console.error('Failed to rewrite offline queue after id migration:', qErr);
                    }

                    // Ensure last saved refers to new server id
                    set({ lastSavedAt: Date.now(), lastSavedFileId: created.id });
                } catch (createErr: any) {
                    console.error('Fallback create note failed:', createErr);
                    const createMsg = String(createErr?.message || createErr);
                    if (createMsg.includes('401') || (createErr as any)?.code === 401) {
                        set({ isAuthenticated: false, user: null });
                    }
                }
            }
        }
      } finally {
        saveTimeouts.delete(id);
      }
    }, 1000); // Debounce 1s

    saveTimeouts.set(id, timeoutId);
  },

  updateBacklinks: (noteId: string, content: string) => {
    // Extract IDs from godnotes://open?id=...
    const linkRegex = /godnotes:\/\/open\?id=([a-zA-Z0-9_-]+)/g;
    const matches = Array.from(content.matchAll(linkRegex));
    const linkedNoteIds = new Set(matches.map(m => m[1]));

    set(state => {
      const newItems = state.items.map(item => {
        // If this item is linked by the current note
        if (linkedNoteIds.has(item.id)) {
          const currentBacklinks = item.backlinks || [];
          if (!currentBacklinks.includes(noteId)) {
            return { ...item, backlinks: [...currentBacklinks, noteId] };
          }
        } 
        // If this item was linked but is no longer linked
        else if (item.backlinks?.includes(noteId)) {
          return { ...item, backlinks: item.backlinks.filter(id => id !== noteId) };
        }
        return item;
      });
      return { items: newItems };
    });
    
    get().saveToLocalStorage();
  },

  loadFileContent: (id: string, content: string) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, content } : i),
    }));
  },

  selectFile: async (id) => {
    set((state) => {
      const openFiles = state.openFiles.includes(id) 
        ? state.openFiles 
        : [...state.openFiles, id];
      return { activeFileId: id, openFiles };
    });
    get().saveToLocalStorage();

    const state = get();
    const file = state.items.find(i => i.id === id);
    
    // If content is missing and we are authenticated, fetch it
    if (file && file.content === undefined && file.type === 'file' && state.isAuthenticated) {
        await get().fetchContent(id);
    }
  },

  closeFile: (id) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter(fileId => fileId !== id);
      
      let newActiveFileId = state.activeFileId;
      if (state.activeFileId === id) {
        newActiveFileId = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
      }
      
      return { 
        openFiles: newOpenFiles, 
        activeFileId: newActiveFileId 
      };
    });
    get().saveToLocalStorage();
  },

  closeAllFiles: () => {
    set({ openFiles: [], activeFileId: null });
    get().saveToLocalStorage();
  },

  toggleFolder: (id) => {
    set((state) => {
      const newExpanded = new Set(Array.from(state.expandedFolders));
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedFolders: newExpanded };
    });
    get().saveToLocalStorage();
  },

  downloadAllFiles: async () => {
      const state = get();
      if (!state.localDocumentsPath || !isElectron() || !fs) {
          console.warn("Cannot download files: Local FS not available");
          return;
      }
      
      // Use syncBackground logic to ensure versions are checked and updated
      await state.syncBackground();
  },

  fetchContent: async (id: string) => {
    const state = get();
    const file = state.items.find(i => i.id === id);
    if (!file || file.type !== 'file' || !state.isAuthenticated) return;

    // Local Sync Logic
    let content = "";
    let loadedFromLocal = false;

    if (state.localDocumentsPath && isElectron() && fs) {
        const localPath = `${state.localDocumentsPath}/GodNotes/${id}.md`;
        const exists = await fs.exists(localPath);
        
        if (exists) {
            // Check if local version is up-to-date using manifest
            await state.loadSyncManifest();
            const manifest = get().syncManifest;
            const localUpdated = manifest[id] || 0;
            const remoteUpdated = file.updatedAt || 0;

            // If local is newer or same as remote, use it
            if (localUpdated >= remoteUpdated) {
                const res = await fs.readFile(localPath);
                if (res.success && res.content !== undefined) {
                    content = res.content;
                    loadedFromLocal = true;
                    get().loadFileContent(id, content);
                }
            }
        }
    }

    if (!loadedFromLocal) {
        try {
            const note = await apiRequest('GET', `/notes/${id}`);
            content = note.content || "";
            get().loadFileContent(id, content);

            // Save to local for next time
            if (state.localDocumentsPath && isElectron() && fs) {
                const localPath = `${state.localDocumentsPath}/GodNotes/${id}.md`;
                await fs.writeFile(localPath, content);
                
                // Update manifest
                const updatedFile = get().items.find(i => i.id === id);
                if (updatedFile) {
                    const manifest = { ...get().syncManifest };
                    manifest[id] = updatedFile.updatedAt || Date.now();
                    set({ syncManifest: manifest });
                    get().saveSyncManifest();
                }
            }
        } catch (e) {
            console.error('Failed to fetch note content from cloud', e);
            
            // If cloud fails, try local as fallback even if outdated
            if (state.localDocumentsPath && isElectron() && fs) {
                const localPath = `${state.localDocumentsPath}/GodNotes/${id}.md`;
                if (await fs.exists(localPath)) {
                    const res = await fs.readFile(localPath);
                    if (res.success && res.content !== undefined) {
                        get().loadFileContent(id, res.content);
                    }
                }
            }
        }
    }
  },

  loadSyncManifest: async () => {
    const state = get();
    if (!state.localDocumentsPath || !isElectron() || !fs) return;
    
    const manifestPath = `${state.localDocumentsPath}/GodNotes/sync-manifest.json`;
    const exists = await fs.exists(manifestPath);
    if (exists) {
        const res = await fs.readFile(manifestPath);
        if (res.success && res.content) {
            try {
                const manifest = JSON.parse(res.content);
                set({ syncManifest: manifest });
            } catch (e) {
                console.error("Failed to parse sync manifest", e);
            }
        }
    }
  },
  
  saveSyncManifest: async () => {
    const state = get();
    if (!state.localDocumentsPath || !isElectron() || !fs) return;
    
    const manifestPath = `${state.localDocumentsPath}/GodNotes/sync-manifest.json`;
    await fs.writeFile(manifestPath, JSON.stringify(state.syncManifest, null, 2));
  },

  startPeriodicSync: () => {
      const state = get();
      if (state.syncInterval) return;

      const interval = setInterval(() => {
          get().processOfflineQueue();
          get().syncBackground();
      }, 5 * 60 * 1000); // 5 minutes

      set({ syncInterval: interval });
  },

  stopPeriodicSync: () => {
      const state = get();
      if (state.syncInterval) {
          clearInterval(state.syncInterval);
          set({ syncInterval: null });
      }
  },

  syncBackground: async () => {
    const state = get();
    if (state.isOfflineMode) return;
    if (!state.localDocumentsPath || !isElectron() || !fs) return;

    // 1. Refresh file list (metadata)
    await state.fetchNotes();
    
    // 2. Load manifest
    await state.loadSyncManifest();
    const manifest = { ...get().syncManifest };
    let manifestChanged = false;

    const files = get().items.filter(i => i.type === 'file');
    
    // Identify files that need syncing
    const filesToSync = files.filter(file => {
        const localUpdated = manifest[file.id];
        return !localUpdated || (file.updatedAt && localUpdated < file.updatedAt);
    });

    if (filesToSync.length > 0) {
        // Batch process downloads to reduce requests
        const BATCH_SIZE = 10;
        for (let i = 0; i < filesToSync.length; i += BATCH_SIZE) {
            const batch = filesToSync.slice(i, i + BATCH_SIZE);
            try {
                // Fetch full content for the batch (tolerant to 404)
                const results = await Promise.allSettled(batch.map(f => apiRequest('GET', `/notes/${f.id}`)));

                for (const res of results) {
                    if (res.status !== 'fulfilled') {
                        console.warn('syncBackground: failed to fetch note in batch', res.reason);
                        continue;
                    }
                    const note = res.value;
                    const file = batch.find(f => f.id === note.id);
                    if (!file) continue;

                    const content = note.content || "";
                    const localPath = `${state.localDocumentsPath}/GodNotes/${file.id}.md`;
                    
                    if (fs) {
                        await fs.writeFile(localPath, content);
                        
                        // Update manifest
                        manifest[file.id] = note.updatedAt ? new Date(note.updatedAt).getTime() : Date.now();
                        manifestChanged = true;
                        
                        // If file is currently loaded in memory, update it
                        const currentItem = get().items.find(i => i.id === file.id);
                        if (currentItem && currentItem.content !== undefined) {
                             get().loadFileContent(file.id, content);
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to sync batch ${i}`, e);
            }
        }
    }
    
    if (manifestChanged) {
        set({ syncManifest: manifest });
        await state.saveSyncManifest();
    }
  },

  searchGlobal: async (query: string) => {
    return await searchGlobalUtility(query, get);
  },

  updateAIConfig: (config) => {
    set(state => {
      const newConfig = { ...state.aiConfig, ...config };
      localStorage.setItem('aiConfig', JSON.stringify(newConfig));
      
      // Синхронизируем с облаком, если пользователь авторизован
      if (state.isAuthenticated && state.user) {
        state.updateUserPrefs({
          aiConfig: JSON.stringify(newConfig)
        }).catch(err => console.error('Failed to sync AI config to cloud:', err));
      }
      
      return { aiConfig: newConfig };
    });
  },

  toggleLock: async (id) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    const newProtectedState = !item.isProtected;
    const oldTags = item.tags || [];
    const newTags = deriveTagsForProtectedState(oldTags, newProtectedState);

    // Optimistic update
    set(state => ({
      items: state.items.map(i => i.id === id ? { ...i, isProtected: newProtectedState, tags: newTags } : i),
    }));

    if (state.isAuthenticated) {
        try {
            const collectionId = item.type === 'folder' ? 'folders' : 'notes';
            await apiRequest('PATCH', `/${collectionId}/${id}`, { tags: newTags });
        } catch (e) {
            console.error('Failed to sync lock state:', e);
            // Revert
            set(state => ({
                items: state.items.map(i => i.id === id ? { ...i, isProtected: !newProtectedState, tags: oldTags } : i),
            }));
        }
    }
  },

  setMasterPassword: async (password) => {
    const config = await setMasterPasswordUtil(password);
    set({ securityConfig: config });
    console.log('Master password set, config:', config);
  },

  checkMasterPassword: async (password) => {
    const currentHash = get().securityConfig.hashedPassword;
    return checkMasterPasswordUtil(password, currentHash);
  },

  unlockNote: async (id, password) => {
    const isValid = await get().checkMasterPassword(password);
    if (isValid) {
        set(state => ({
            unlockedNotes: addUnlockedNote(state.unlockedNotes, id)
        }));
        return true;
    }
    return false;
  },

  lockNote: (id) => {
    set(state => ({
        unlockedNotes: removeUnlockedNote(state.unlockedNotes, id)
    }));
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setSortOrder: (order) => {
    set({ sortOrder: order });
    get().saveToLocalStorage();
  },

  setTheme: (theme) => {
    set({ theme });
    get().saveToLocalStorage();
  },

  setHotkey: (action, key) => {
    set((state) => {
      const newHotkeys = { ...state.hotkeys, [action]: key };
      localStorage.setItem('hotkeys', JSON.stringify(newHotkeys));
      return { hotkeys: newHotkeys };
    });
  },

  login: async (email, password) => {
    // Clear any existing user data before login
    get().clearUserData();
    
    const res = await authService.login(email, password);
    set({ isAuthenticated: true, user: {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      username: res.user.username,
      avatar_url: res.user.avatar_url,
      is_verified: res.user.is_verified,
      is_active: res.user.is_active,
      created_at: res.user.created_at,
      prefs: {}
    } as unknown as User });
    await get().fetchFolders();
    await get().fetchNotes();
    await get().processOfflineQueue();
  },

  register: async (email, password, name) => {
     const res = await authService.register(email, password, name);
     
     // Clear any existing user data before login
     get().clearUserData();
     
     set({ isAuthenticated: true, user: {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      username: res.user.username,
      avatar_url: res.user.avatar_url,
      is_verified: res.user.is_verified,
      is_active: res.user.is_active,
      created_at: res.user.created_at,
      prefs: {}
     } as unknown as User });
     await get().fetchFolders();
     await get().fetchNotes();
  },
  
  resetPassword: async (email: string) => {
    try {
      await authService.resetPassword(email);
    } catch (error: any) {
      console.error('Password reset failed:', error);
      throw error;
    }
  },

  updateRecovery: async (userId, secret, password, passwordAgain) => {
    try {
      if (password !== passwordAgain) {
        throw new Error('Пароли не совпадают');
      }
      await apiRequest('POST', '/auth/recover-password', {
        userId,
        secret,
        new_password: password,
      });
    } catch (error: any) {
      console.error('Update recovery failed:', error);
      const message = error?.message || String(error) || 'Не удалось обновить пароль';
      throw new Error(message);
    }
  },

  logout: async (onSuccess?: () => void) => {
    get().stopSessionRefresh();
    try {
      // Use our new JWT-based auth service
      await authService.logout();
    } catch (e) {
      console.error('Logout failed', e);
      // Still clear local data even if API call fails
    }
    
    // Clear all user-specific data
    get().clearUserData();
    
    set({ 
      isAuthenticated: false, 
      user: null, 
      items: [], 
      activeFileId: null, 
      openFiles: [],
      trashItems: [],
      expandedFolders: new Set(),
      lastCreatedFileId: null,
      lastCreatedFolderId: null,
      searchQuery: '',
      aiConfig: DEFAULT_AI_CONFIG,
      securityConfig: { hashedPassword: null },
      unlockedNotes: [],
      lastSavedAt: null,
      lastSavedFileId: null
    });
    
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    
    // Force immediate redirect to login
    window.location.hash = '#/login';
    
    // Call success callback if provided (for backward compatibility)
    if (onSuccess) {
      onSuccess();
    }
  },
  
  togglePin: (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    const newIsPinned = !item.isPinned;
    // Оптимистическое обновление
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPinned: newIsPinned } : i),
    }));

    const state = get();
    if (!state.isAuthenticated || state.isOfflineMode) {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${id}`, payload: { isPinned: newIsPinned }, itemId: id });
      return;
    }

    (async () => {
      try {
        const endpoint = item.type === 'folder' ? `/folders/${id}` : `/notes/${id}`;
        await apiRequest('PATCH', endpoint, { isPinned: newIsPinned });
      } catch (error: any) {
        console.error('Failed to toggle pin:', error);
        if (String(error).includes('401')) {
          set({ isAuthenticated: false, user: null });
        }
        // Откат оптимистичного обновления
        set((state) => ({
          items: state.items.map(i => i.id === id ? { ...i, isPinned: !newIsPinned } : i),
        }));
      }
    })();
  },

  toggleFavorite: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    // Optimistic update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i),
    }));

    if (!get().isAuthenticated || get().isOfflineMode) {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${id}`, payload: { isFavorite: !item.isFavorite }, itemId: id });
      return;
    }

    try {
      const endpoint = item.type === 'folder' ? `/folders/${id}` : `/notes/${id}`;
      await apiRequest('PATCH', endpoint, { isFavorite: !item.isFavorite });
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      if (String(error).includes('401')) {
          set({ isAuthenticated: false, user: null });
      }
      // Revert
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, isFavorite: item.isFavorite } : i),
      }));
    }
  },

  updateTags: async (id, tags) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    const oldTags = item.tags;

    // Optimistic update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, tags } : i),
    }));

    // Offline or unauthenticated: enqueue PATCH and exit
    if (!get().isAuthenticated || get().isOfflineMode) {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${id}`, payload: { tags }, itemId: id });
      return;
    }

    try {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      await apiRequest('PATCH', `/${collectionId}/${id}`, { tags });
    } catch (error: any) {
      console.error('Failed to update tags:', error);
      // Revert
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, tags: oldTags } : i),
      }));
    }
  },

  applyTemplate: (id, templateContent) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    const newContent = item.content ? `${item.content}<br>${templateContent}` : templateContent;
    state.updateFileContent(id, newContent);
  },

  moveItem: async (id, newParentId) => {
    const state = get();
    if (id === newParentId) return;
    
    const isDescendant = (parentId: string, targetId: string): boolean => {
      const parent = state.items.find(i => i.id === parentId);
      if (!parent) return false;
      if (parent.parentId === targetId) return true;
      if (parent.parentId) return isDescendant(parent.parentId, targetId);
      return false;
    };

    if (newParentId && isDescendant(newParentId, id)) {
      return;
    }

    const item = state.items.find(i => i.id === id);
    if (!item) return;
    const oldParentId = item.parentId;

    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, parentId: newParentId } : i),
    }));

    // Offline or unauthenticated: enqueue PATCH and exit
    if (!state.isAuthenticated || state.isOfflineMode) {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      const data = item.type === 'folder' ? { parentId: newParentId } : { folderId: newParentId };
      get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/${collectionId}/${id}`, payload: data, itemId: id });
      return;
    }

    try {
      const collectionId = item.type === 'folder' ? 'folders' : 'notes';
      const data = item.type === 'folder' ? { parentId: newParentId } : { folderId: newParentId };
      await apiRequest('PATCH', `/${collectionId}/${id}`, data);
    } catch (error: any) {
      console.error('Failed to move item:', error);
      if (error.message?.includes('401')) {
          set({ isAuthenticated: false, user: null });
      }
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, parentId: oldParentId } : i),
      }));
    }
  },

  togglePublic: async (id) => {
    console.log('=== togglePublic DEBUG START ===');
    console.log('togglePublic called for id:', id);
    const state = get();
    const item = state.items.find(i => i.id === id);
    
    console.log('State check:', {
      isAuthenticated: state.isAuthenticated,
      isOfflineMode: state.isOfflineMode,
      user: !!state.user,
      item: !!item
    });
    
    if (!item) {
      console.error('Item not found:', id);
      console.log('=== togglePublic DEBUG END (item not found) ===');
      return null;
    }
    
    const newIsPublic = !item.isPublic;
    
    // Optimistic update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPublic: newIsPublic } : i),
    }));

    if (!state.isAuthenticated || state.isOfflineMode || !state.user) {
         // Enqueue server patch to be processed later
         get().enqueueOfflineOp({ method: 'PATCH', endpoint: `/notes/${id}/public`, payload: { isPublic: newIsPublic }, itemId: id });
         console.log('=== togglePublic DEBUG END (enqueued offline) ===');
         return null;
    }

    console.log('togglePublic: Setting isPublic to', newIsPublic, 'for item', id);

    try {
        console.log('togglePublic: Updating PostgreSQL database for item', id);
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('auth_token');
        console.log('JWT token present:', !!token);
        console.log('Full token value:', token ? token.substring(0, 20) + '...' : 'null');
        
        if (!token) {
          console.error('No JWT token found in localStorage');
          // Revert optimistic update
          set((state) => ({
            items: state.items.map(i => i.id === id ? { ...i, isPublic: !newIsPublic } : i),
          }));
          console.log('=== togglePublic DEBUG END (no token) ===');
          return null;
        }
        
        // Make request to our backend API
        const apiUrl = `${API_BASE_URL}/notes/${id}/public`;
        console.log('Making API request to:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                isPublic: newIsPublic
            })
        });

        console.log('API response status:', response.status);
        console.log('API response headers:', [...response.headers.entries()]);
        
        const responseText = await response.text();
        console.log('API response body:', responseText);
        
        if (!response.ok) {
            console.error('API error:', response.status, responseText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
        }

        const result = JSON.parse(responseText);
        console.log('togglePublic: API response parsed:', result);

        if (newIsPublic) {
            const baseUrl = isElectron() ? 'https://godnotes-8aoh.vercel.app' : window.location.origin;
            const shareLink = `${baseUrl}/#/share/${id}`;
            console.log('Generated share link:', shareLink);
            console.log('=== togglePublic DEBUG END (success) ===');
            return shareLink;
        }
        console.log('=== togglePublic DEBUG END (success, private) ===');
    } catch (e) {
        console.error("Failed to toggle public access:", e);
        console.error("Error details:", {
            name: (e as any).name,
            message: (e as any).message,
            code: (e as any).code,
            response: (e as any).response
        });
        // Revert
        set((state) => ({
            items: state.items.map(i => i.id === id ? { ...i, isPublic: !newIsPublic } : i),
        }));
        console.log('=== togglePublic DEBUG END (error) ===');
        return null;
    }
    return null;
  },

  createVersion: async (id) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    if (!item || !state.user) return;

    // Ensure we have the latest content
    let content = item.content;
    if (content === undefined) {
         try {
             const doc = await apiRequest('GET', `/notes/${id}`);
             content = doc.content;
         } catch (e) {
             console.error('Failed to fetch content for versioning:', e);
             return;
         }
    }

    try {
      await apiRequest('POST', '/notes', {
        title: `${item.name} (v.${new Date().toLocaleString()})`,
        content: content,
        folderId: null,
        isFavorite: false,
        tags: [`version:of:${id}`]
      });
    } catch (error: any) {
      console.error('Failed to create note:', error);
      if (String(error).includes('401')) {
          set({ isAuthenticated: false, user: null });
      }
    }
  },

  getVersions: async (id) => {
    const state = get();
    if (!state.user) return [];

    try {
        const notes = await apiRequest('GET', '/notes');
        if (!notes) return [];
        
        // Filter manually for versions
        // In a real API, we would pass query params
        return notes
            .filter((n: any) => n.tags?.includes(`version:of:${id}`))
            .map((n: any) => ({
                id: n.id,
                name: n.title,
                type: 'file',
                parentId: null,
                content: n.content,
                createdAt: new Date(n.createdAt).getTime(),
                isFavorite: false,
                tags: n.tags || [],
            }))
            .sort((a: any, b: any) => b.createdAt - a.createdAt);
            
    } catch (error) {
        console.error('Failed to get versions:', error);
        return [];
    }
  },

  restoreVersion: async (id, content) => {
      const state = get();
      // Update local state immediately
      state.updateFileContent(id, content);
      
      // Force save to server immediately (bypass debounce if possible, or just let updateFileContent handle it)
      // updateFileContent handles it via debounce. To force save, we might need to clear timeout and save.
      // But updateFileContent is fine.
      
      // We might want to create a version of the *current* state before restoring? 
      // Let's leave that to the user manual action for now to avoid complexity.
  },

  startSessionRefresh: () => {
    const state = get();
    if (state.sessionRefreshInterval) return;

    // Ping backend every 30 minutes to keep session alive
    const interval = setInterval(async () => {
      try {
        await authService.getCurrentUser();
        // console.log('Session refreshed');
      } catch (error: any) {
        console.error('Session refresh failed:', error);
        if (String(error).includes('401')) {
          get().stopSessionRefresh();
          set({ isAuthenticated: false, user: null });
        }
      }
    }, 30 * 60 * 1000); // 30 minutes

    set({ sessionRefreshInterval: interval });
  },

  stopSessionRefresh: () => {
    const state = get();
    if (state.sessionRefreshInterval) {
      clearInterval(state.sessionRefreshInterval);
      set({ sessionRefreshInterval: null });
    }
  },

  clearUserData: () => {
    // Clear all user-specific data from localStorage
    localStorage.removeItem('localItems');
    localStorage.removeItem('trashItems');
    localStorage.removeItem('activeFileId');
    localStorage.removeItem('openFiles');
    localStorage.removeItem('expandedFolders');
    localStorage.removeItem('aiConfig');
    localStorage.removeItem('securityConfig');
    localStorage.removeItem('aiCustomConfig');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    
    // Clear user settings
    const user = get().user;
    const uid = (user as any)?.id ?? (user as any)?.$id;
    if (uid) {
      const userSettingsKey = `user_settings_${uid}`;
      localStorage.removeItem(userSettingsKey);
      console.log('Removed user settings from localStorage:', userSettingsKey);
    }
    
    // Clear Electron store if available
    if (isElectron()) {
      setStoreValue('localItems', []);
      setStoreValue('trashItems', []);
      setStoreValue('activeFileId', '');
      setStoreValue('openFiles', []);
      setStoreValue('expandedFolders', []);
      setStoreValue('aiConfig', null);
      setStoreValue('securityConfig', null);
    }
    
    console.log('User data cleared');
  }

}));
