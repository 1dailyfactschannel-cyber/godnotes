import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { account, databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { ID, Query, Permission, Role, Models } from 'appwrite';
import { fs, getDocumentsPath, isElectron, selectDirectory, getStoreValue, setStoreValue } from './electron';
import { useTasks } from './tasks-store';
import { hashPassword } from '@/lib/utils';

const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export type ThemeType = 'obsidian-dark' | 'midnight-blue' | 'graphite' | 'light-mode' | 'forest' | 'sunset' | 'ocean' | 'cyberpunk';

export type SortOrder = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

// Custom equality function to ignore 'content' changes
export function compareItems(prev: FileSystemItem[], next: FileSystemItem[]) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    
    if (a === b) continue;
    
    // Check all properties except content
    if (a.id !== b.id || 
        a.name !== b.name || 
        a.type !== b.type || 
        a.parentId !== b.parentId || 
        a.isPinned !== b.isPinned || 
        a.isFavorite !== b.isFavorite || 
        a.createdAt !== b.createdAt ||
        a.updatedAt !== b.updatedAt) {
      return false;
    }
    
    // Deep compare tags if needed
    if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) return false;
  }
  
  return true;
}

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
};

export type User = Models.User<Models.Preferences & { 
  telegram?: string; 
  telegramChatId?: string;
  aiConfig?: string;
  aiCustomConfig?: string;
}>;

export type AIConfig = {
  provider: 'openai' | 'anthropic' | 'custom' | 'openrouter';
  apiKey: string;
  baseUrl?: string;
  model: string;
  availableModels?: string[];
};

export type SecurityConfig = {
  hashedPassword: string | null;
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
  logout: () => Promise<void>;
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
}

const initialItems: FileSystemItem[] = [
  { id: '5', name: 'Добро пожаловать', type: 'file', parentId: null, content: '<h1>Добро пожаловать в заметки</h1><p>Это Godnotes. Вы можете создавать папки, файлы и писать в Markdown.</p><h2>Возможности</h2><ul><li>Полноценный текстовый редактор</li><li>Папки и вложенные файлы</li><li>Темная тема по умолчанию</li><li>Быстрый поиск</li></ul>', createdAt: Date.now(), updatedAt: Date.now(), isPinned: true },
];

export const useFileSystem = create<FileSystemState>((set, get) => ({
  items: (() => {
    try {
      const saved = localStorage.getItem('localItems');
      return saved ? JSON.parse(saved) : initialItems;
    } catch {
      return initialItems;
    }
  })(),
  trashItems: (() => {
    try {
      const saved = localStorage.getItem('trashItems');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  activeFileId: localStorage.getItem('activeFileId') || '5',
  openFiles: (() => {
    try {
      const saved = localStorage.getItem('openFiles');
      return saved ? JSON.parse(saved) : ['5'];
    } catch {
      return ['5'];
    }
  })(),
  expandedFolders: (() => {
    try {
      const saved = localStorage.getItem('expandedFolders');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  })(),
  lastCreatedFileId: null,
  lastCreatedFolderId: null,
  searchQuery: '',
  sortOrder: (localStorage.getItem('sortOrder') as SortOrder) || 'name-asc',
  theme: (localStorage.getItem('theme') as ThemeType) || 'obsidian-dark',
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

  // Вспомогательная функция для сохранения состояния в LocalStorage
  saveToLocalStorage: () => {
    const state = get();
    localStorage.setItem('localItems', JSON.stringify(state.items));
    localStorage.setItem('trashItems', JSON.stringify(state.trashItems));
    localStorage.setItem('activeFileId', state.activeFileId || '');
    localStorage.setItem('openFiles', JSON.stringify(state.openFiles));
    localStorage.setItem('expandedFolders', JSON.stringify(Array.from(state.expandedFolders)));
    localStorage.setItem('sortOrder', state.sortOrder);
    localStorage.setItem('theme', state.theme);
    if (isElectron()) {
      setStoreValue('localItems', state.items);
      setStoreValue('trashItems', state.trashItems);
      setStoreValue('activeFileId', state.activeFileId || '');
      setStoreValue('openFiles', state.openFiles);
      setStoreValue('expandedFolders', Array.from(state.expandedFolders));
      setStoreValue('sortOrder', state.sortOrder);
      setStoreValue('theme', state.theme);
    }
  },

  setStoragePath: (path: string) => {
    set({ localDocumentsPath: path });
  },

  toggleOfflineMode: () => {
    const newVal = !get().isOfflineMode;
    localStorage.setItem('isOfflineMode', String(newVal));
    set({ isOfflineMode: newVal });
  },

  toggleZenMode: () => {
    set(state => ({ isZenMode: !state.isZenMode }));
  },

  updateUserPrefs: async (prefs) => {
    const user = get().user;
    if (!user) return;
    try {
      const currentPrefs = user.prefs || {};
      const newPrefs = { ...currentPrefs, ...prefs };
      const updatedUser = await account.updatePrefs(newPrefs);
      set({ user: updatedUser });
    } catch (error) {
      console.error('Failed to update user prefs:', error);
      throw error;
    }
  },

  updateAccountPassword: async (password, oldPassword) => {
    try {
      await account.updatePassword(password, oldPassword);
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
    if (get().isOfflineMode) return;
    const user = get().user;
    if (!user) return;

    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.FOLDERS,
        [Query.equal('userId', user.$id), Query.limit(1000)]
      );

      const folderItems: FileSystemItem[] = res.documents
        .map((f: any) => ({
          id: f.$id,
          name: f.name,
          type: 'folder' as const,
          parentId: f.parentId || null,
          createdAt: new Date(f.$createdAt).getTime(),
          updatedAt: new Date(f.$updatedAt).getTime(),
          isFavorite: f.isFavorite,
          tags: f.tags || [],
        }))
        .filter(item => !item.tags?.some((t: string) => t.startsWith('deleted:')));
      
      set(state => {
        return {
          items: [...state.items.filter(i => i.type === 'file'), ...folderItems],
          expandedFolders: new Set([...Array.from(state.expandedFolders), ...folderItems.map(f => f.id)])
        };
      });
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  },

  fetchNotes: async () => {
    if (get().isOfflineMode) return;
    const user = get().user;
    if (!user) return;

    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.NOTES,
        [
          Query.equal('userId', user.$id), 
          Query.limit(1000),
          Query.select(['$id', 'title', 'folderId', '$createdAt', '$updatedAt', 'isFavorite', 'tags', '$permissions'])
        ]
      );


      const fileItems: FileSystemItem[] = res.documents
        .map((n: any) => ({
          id: n.$id,
          name: n.title,
          type: 'file' as const,
          parentId: n.folderId || null,
          content: undefined, // Content is loaded lazily on open
          createdAt: new Date(n.$createdAt).getTime(),
          updatedAt: new Date(n.$updatedAt).getTime(),
          isFavorite: n.isFavorite,
          tags: n.tags || [],
          isPublic: n.$permissions && n.$permissions.some((p: string) => p.includes('role:any') || p.includes('any')),
        }))
        .filter(item => !item.tags?.some((t: string) => t.startsWith('deleted:')));

      set(state => {
        const folders = state.items.filter(i => i.type === 'folder');
        
        // Remove duplicates from fileItems if any (based on ID)
        const uniqueFileItems = Array.from(new Map(fileItems.map(item => [item.id, item])).values());
        
        // Preserve in-memory content for currently loaded notes
        const preservedFileItems = uniqueFileItems.map(item => {
          const prev = state.items.find(i => i.id === item.id && i.type === 'file');
          if (prev && prev.content !== undefined) {
            return { ...item, content: prev.content };
          }
          return item;
        });
        
        // Ensure we don't have files in folders list (already filtered by type)
        // Merge: unique files from Appwrite + existing folders
        const allItems = [...preservedFileItems, ...folders];
        
        // Log if we found duplicates during merge (debug only)
        if (fileItems.length !== uniqueFileItems.length) {
             console.warn('[fetchNotes] Duplicates found in Appwrite response!', fileItems.length - uniqueFileItems.length);
        }

        // Check if active file is still valid (in new files list OR existing folders list)
        // This prevents activeFileId from being reset when a folder is selected
        const isActiveValid = state.activeFileId && allItems.some(i => i.id === state.activeFileId);

        return {
          items: allItems,
          activeFileId: isActiveValid
            ? state.activeFileId
            : uniqueFileItems[0]?.id ?? null,
        };
      });
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  },

  fetchTrash: async () => {
    const user = get().user;
    if (!user) return;

    try {
      const [foldersRes, notesRes] = await Promise.all([
        databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.FOLDERS,
          [Query.equal('userId', user.$id), Query.limit(1000)]
        ),
        databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.NOTES,
          [
            Query.equal('userId', user.$id), 
            Query.limit(1000),
            Query.select(['$id', 'title', 'folderId', '$createdAt', 'isFavorite', 'tags'])
          ]
        )
      ]);

      const trashFolders = foldersRes.documents
        .map((f: any) => ({
          id: f.$id,
          name: f.name,
          type: 'folder' as const,
          parentId: f.parentId || null,
          createdAt: new Date(f.$createdAt).getTime(),
          isFavorite: f.isFavorite,
          tags: f.tags || [],
        }))
        .filter(item => item.tags?.some((t: string) => t.startsWith('deleted:')));

      const trashNotes = notesRes.documents
        .map((n: any) => ({
          id: n.$id,
          name: n.title,
          type: 'file' as const,
          parentId: n.folderId || null,
          content: undefined, // Content is loaded lazily
          createdAt: new Date(n.$createdAt).getTime(),
          isFavorite: n.isFavorite,
          tags: n.tags || [],
        }))
        .filter(item => item.tags?.some((t: string) => t.startsWith('deleted:')));

      set({ trashItems: [...trashFolders, ...trashNotes] });
    } catch (error) {
      console.error('Failed to fetch trash:', error);
    }
  },

  checkAuth: async () => {
    set({ isAuthChecking: true });
    try {
      const user = await account.get() as unknown as User;
      set({ isAuthenticated: true, user });
      get().startSessionRefresh();

      // Sync Telegram config
      const currentConfig = useTasks.getState().telegramConfig;
      const cloudChatId = user.prefs?.telegramChatId;
      
      // Sync AI config from cloud
      const cloudAiConfig = user.prefs?.aiConfig;
      if (cloudAiConfig) {
        try {
          const parsed = JSON.parse(cloudAiConfig);
          set({ aiConfig: parsed });
          localStorage.setItem('aiConfig', cloudAiConfig);
        } catch (e) {
          console.error('Failed to parse cloud AI config:', e);
        }
      } else if (localStorage.getItem('aiConfig')) {
        // Migration: if cloud is empty but local has config, push to cloud
        get().updateUserPrefs({ aiConfig: localStorage.getItem('aiConfig') })
          .catch(e => console.error('Failed to migrate local AI config to cloud:', e));
      }

      // Sync custom AI config (backup)
      const cloudCustomConfig = user.prefs?.aiCustomConfig;
      if (cloudCustomConfig) {
        localStorage.setItem('aiCustomConfig', cloudCustomConfig);
      } else if (localStorage.getItem('aiCustomConfig')) {
        get().updateUserPrefs({ aiCustomConfig: localStorage.getItem('aiCustomConfig') })
          .catch(e => console.error('Failed to migrate local custom AI config to cloud:', e));
      }

      // 1. If Cloud has a value (even empty string), it is the source of truth
      if (cloudChatId !== undefined && cloudChatId !== null) {
          if (cloudChatId !== currentConfig.chatId) {
              useTasks.getState().setTelegramConfig({
                  ...currentConfig,
                  chatId: cloudChatId
              });
          }
      } 
      // 2. If Cloud is empty (undefined) but Local has value -> Push Local to Cloud (Legacy Migration)
      else if (currentConfig.chatId) {
          try {
              await get().updateUserPrefs({ telegramChatId: currentConfig.chatId });
              console.log('Synced local Telegram config to cloud');
          } catch (e) {
              console.error('Failed to sync local Telegram config to cloud:', e);
          }
      }

      await Promise.all([get().fetchFolders(), get().fetchNotes()]);
    } catch (error: any) {
      // Ignore 401 Unauthorized as it just means user is not logged in
      // Check both number and string types, and also Appwrite specific properties
      const code = error?.code || error?.response?.code;
      const type = error?.type || error?.response?.type;
      
      // Filter out 401 errors (unauthorized) which are expected when not logged in
      const isUnauthorized = 
        code === 401 || 
        code === "401" || 
        type === "general_unauthorized_scope";

      if (!isUnauthorized) {
          console.error("checkAuth failed:", error);
      }
      // При ошибке авторизации (или если пользователь не вошел), 
      // мы НЕ сбрасываем items до initialItems, чтобы локальные данные сохранились.
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
    const newId = ID.unique();
    const createdAt = Date.now();

    const newFile: FileSystemItem = {
      id: newId,
      name,
      type: 'file',
      parentId: effectiveParentId,
      content: initialContent,
      createdAt: createdAt,
    };

    // Optimistic update
    set((s) => {
        const expanded = new Set(s.expandedFolders);
        if (effectiveParentId) expanded.add(effectiveParentId);
        
        // Ensure unique items by ID
        const existingItems = s.items.filter(i => i.id !== newId);
        return {
          items: [...existingItems, newFile],
          activeFileId: newId,
          expandedFolders: expanded,
          lastCreatedFileId: newId,
        };
    });
    get().saveToLocalStorage();

    if (!state.isAuthenticated || !state.user) {
      return;
    }

    try {
            const note = await databases.createDocument(
              DATABASE_ID,
              COLLECTIONS.NOTES,
              newId,
              {
                title: name,
                content: initialContent,
                folderId: effectiveParentId,
                userId: state.user.$id,
                tags: [],
                isFavorite: false
              },
              [
                Permission.read(Role.user(state.user.$id)),
                Permission.update(Role.user(state.user.$id)),
                Permission.delete(Role.user(state.user.$id)),
              ]
            );
            
            // Verify folderId was saved correctly
            if (effectiveParentId && note.folderId !== effectiveParentId) {
                console.warn('[addFile] folderId mismatch! Attempting to fix...');
                try {
                    await databases.updateDocument(
                        DATABASE_ID, 
                        COLLECTIONS.NOTES, 
                        note.$id, 
                        { folderId: effectiveParentId }
                    );
                    console.log('[addFile] folderId fixed.');
                } catch (fixErr) {
                    console.error('[addFile] Failed to fix folderId:', fixErr);
                }
            }
    } catch (error: any) {
        console.error('Failed to create note on server (kept locally):', error);
        if (error.code === 401) {
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
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.NOTES,
          noteId,
          {
            title: dateStr,
            content: welcomeText,
            folderId: folderId,
            userId: state.user.$id,
            tags: ['daily'],
            isFavorite: false
          }
        );
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
    const newId = ID.unique();
    const createdAt = Date.now();
    
    const newFolder: FileSystemItem = {
      id: newId,
      name,
      type: 'folder',
      parentId: effectiveParentId,
      createdAt: createdAt,
    };

    // Optimistic update
    set((s) => {
        const expanded = new Set(s.expandedFolders);
        expanded.add(newId);
        if (effectiveParentId) expanded.add(effectiveParentId);
        
        const existingItems = s.items.filter(i => i.id !== newId);
        return {
          items: [...existingItems, newFolder],
          expandedFolders: expanded,
          lastCreatedFolderId: newId,
        };
    });
    get().saveToLocalStorage();
    
    if (!state.isAuthenticated || !state.user) {
      return;
    }

    try {
        const folder = await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.FOLDERS,
          newId,
          {
            name,
            parentId: effectiveParentId,
            userId: state.user.$id,
            tags: [],
            isFavorite: false
          },
          [
            Permission.read(Role.user(state.user.$id)),
            Permission.update(Role.user(state.user.$id)),
            Permission.delete(Role.user(state.user.$id)),
          ]
        );
        
        if (effectiveParentId && folder.parentId !== effectiveParentId) {
             console.warn('[addFolder] parentId mismatch! Attempting to fix...');
             try {
                 await databases.updateDocument(
                     DATABASE_ID, 
                     COLLECTIONS.FOLDERS, 
                     folder.$id, 
                     { parentId: effectiveParentId }
                 );
             } catch (fixErr) {
                 console.error('[addFolder] Failed to fix parentId:', fixErr);
             }
        }
    } catch (error: any) {
      console.error('Failed to create folder on server (kept locally):', error);
      if (error.code === 401) {
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

    if (!state.isAuthenticated) return;

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
         const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
         const newTags = [...(item.tags || []), deletedTag];
         await databases.updateDocument(DATABASE_ID, collectionId, item.id, { tags: newTags });
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

    if (!state.isAuthenticated) return;

    try {
        const itemsToRestore = state.trashItems.filter(i => idsToRestore.includes(i.id));
        for (const item of itemsToRestore) {
            const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
            const newTags = (item.tags || []).filter(t => !t.startsWith('deleted:'));
            await databases.updateDocument(DATABASE_ID, collectionId, item.id, { tags: newTags });
        }
    } catch (error: any) {
        console.error('Failed to restore item:', error);
        if (error.code === 401) {
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

    if (!state.isAuthenticated) return;

    try {
        const itemsToDelete = state.trashItems.filter(i => idsToDelete.includes(i.id));
        for (const item of itemsToDelete) {
            const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
            await databases.deleteDocument(DATABASE_ID, collectionId, item.id);
        }
    } catch (error: any) {
        console.error('Failed to permanently delete item:', error);
        if (error.code === 401) {
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

    if (!state.isAuthenticated) return;

    try {
        await Promise.all(itemsToDelete.map(item => {
            const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
            return databases.deleteDocument(DATABASE_ID, collectionId, item.id);
        }));
    } catch (error: any) {
        console.error('Failed to empty trash:', error);
        if (error.code === 401) {
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

    if (!get().isAuthenticated) return;

    try {
      if (item.type === 'folder') {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.FOLDERS, id, { name: newName });
      } else {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.NOTES, id, { title: newName });
      }
    } catch (error: any) {
      console.error('Failed to rename item:', error);
      if (error.code === 401) {
          set({ isAuthenticated: false, user: null });
      }
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, name: item.name } : i),
      }));
    }
  },

  updateFileContent: async (id, content) => {
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

        // Only save to Appwrite if authenticated and online
        if (state.isAuthenticated && !state.isOfflineMode) {
            const updatedDoc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.NOTES, id, { content });
            
            // Update local metadata and manifest with new timestamp
            const newUpdatedAt = new Date(updatedDoc.$updatedAt).getTime();
            set(s => ({
                items: s.items.map(i => i.id === id ? { ...i, updatedAt: newUpdatedAt } : i)
            }));

            if (state.localDocumentsPath && isElectron()) {
                const manifest = { ...get().syncManifest, [id]: newUpdatedAt };
                set({ syncManifest: manifest });
                await get().saveSyncManifest();
            }
        }
        set({ lastSavedAt: Date.now(), lastSavedFileId: id });
      } catch (error: any) {
        console.error('Failed to update note content:', error);
        if (error.code === 401) {
            set({ isAuthenticated: false, user: null });
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
            const note = await databases.getDocument(DATABASE_ID, COLLECTIONS.NOTES, id);
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
                // Fetch full content for the batch
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.NOTES,
                    [
                        Query.equal('$id', batch.map(f => f.id)),
                        Query.limit(BATCH_SIZE)
                    ]
                );

                for (const note of res.documents) {
                    const file = batch.find(f => f.id === note.$id);
                    if (!file) continue;

                    const content = note.content || "";
                    const localPath = `${state.localDocumentsPath}/GodNotes/${file.id}.md`;
                    
                    if (fs) {
                        await fs.writeFile(localPath, content);
                        
                        // Update manifest
                        manifest[file.id] = file.updatedAt || Date.now();
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
    if (!query) return [];
    
    // Client-side search
    const localResults = get().items.filter(i => 
       i.type === 'file' && !i.tags?.some(t => t.startsWith('deleted:')) &&
       (i.name.toLowerCase().includes(query.toLowerCase()) ||
       (i.content && i.content.toLowerCase().includes(query.toLowerCase())))
    );

    if (get().isOfflineMode) {
       return localResults;
    }

    try {
       const res = await databases.listDocuments(
         DATABASE_ID,
         COLLECTIONS.NOTES,
         [Query.search('content', query), Query.limit(10)]
       );

       const serverItems: FileSystemItem[] = res.documents.map((n: any) => ({
          id: n.$id,
          name: n.title,
          type: 'file',
          parentId: n.folderId || null,
          content: n.content,
          createdAt: new Date(n.$createdAt).getTime(),
          isFavorite: n.isFavorite,
          tags: n.tags || [],
       }));

       const serverIds = new Set(serverItems.map(i => i.id));
       const filteredLocal = localResults.filter(i => !serverIds.has(i.id));
       
       return [...serverItems, ...filteredLocal];
    } catch (e) {
       // console.error("Global search failed (likely no index), falling back to local");
       return localResults;
    }
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
    let newTags: string[];

    if (newProtectedState) {
        if (!oldTags.includes('protected')) {
            newTags = [...oldTags, 'protected'];
        } else {
            newTags = oldTags;
        }
    } else {
        newTags = oldTags.filter(t => t !== 'protected');
    }

    // Optimistic update
    set(state => ({
      items: state.items.map(i => i.id === id ? { ...i, isProtected: newProtectedState, tags: newTags } : i),
    }));

    if (state.isAuthenticated) {
        try {
            const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
            await databases.updateDocument(DATABASE_ID, collectionId, id, { tags: newTags });
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
    const hashedPassword = await hashPassword(password);
    const config = { hashedPassword };
    localStorage.setItem('securityConfig', JSON.stringify(config));
    set({ securityConfig: config });
    console.log('Master password set, config:', config);
  },

  checkMasterPassword: async (password) => {
    const currentHash = get().securityConfig.hashedPassword;
    if (!currentHash) return true; // No password set
    const hash = await hashPassword(password);
    return hash === currentHash;
  },

  unlockNote: async (id, password) => {
    const isValid = await get().checkMasterPassword(password);
    if (isValid) {
        set(state => ({
            unlockedNotes: [...state.unlockedNotes, id]
        }));
        return true;
    }
    return false;
  },

  lockNote: (id) => {
    set(state => ({
        unlockedNotes: state.unlockedNotes.filter(noteId => noteId !== id)
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
    
    await account.createEmailPasswordSession(email, password);
    await get().checkAuth();
    if (!get().isAuthenticated) {
        throw new Error("Вход выполнен, но проверка сессии не удалась. Возможно, ваш браузер блокирует cookies или домен не добавлен в Appwrite.");
    }
  },

  register: async (email, password, name) => {
     await account.create(ID.unique(), email, password, name);
     
     // Clear any existing user data before login
     get().clearUserData();
     
     await get().login(email, password);
  },
  
  resetPassword: async (email: string) => {
    try {
      // Use the deployed web app URL for password recovery.
      // This ensures the link works in standard browsers and avoids deep linking issues.
      // The web app at this address handles the /#/reset-password route.
      await account.createRecovery(email, 'https://godnotes-8aoh.vercel.app/#/reset-password');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      
      // Check for specific Appwrite platform error
      if (error?.message?.includes('Register your new client') || error?.response?.message?.includes('Register your new client')) {
         throw new Error("Ошибка конфигурации Appwrite: Необходимо добавить домен 'godnotes-8aoh.vercel.app' как Веб-платформу в консоли Appwrite (Overview -> Platforms -> Add Platform -> Web).");
      }
      
      throw error;
    }
  },

  updateRecovery: async (userId, secret, password, passwordAgain) => {
    try {
      // passwordAgain is not used in newer SDK versions but kept in function signature for compatibility
      await account.updateRecovery(userId, secret, password);
    } catch (error) {
      console.error('Update recovery failed:', error);
      throw error;
    }
  },

  logout: async () => {
    get().stopSessionRefresh();
    try {
      await account.deleteSession('current');
    } catch (e) {
      console.error('Logout failed', e);
    }
    
    // Clear all user-specific data
    get().clearUserData();
    
    set({ 
      isAuthenticated: false, 
      user: null, 
      items: initialItems, 
      activeFileId: '5', 
      openFiles: ['5'],
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
  },
  
  togglePin: (id) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPinned: !i.isPinned } : i),
    }));
  },

  toggleFavorite: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    // Optimistic update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i),
    }));

    if (!get().isAuthenticated) return;

    try {
      const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
      await databases.updateDocument(DATABASE_ID, collectionId, id, { isFavorite: !item.isFavorite });
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      if (error.code === 401) {
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

    if (!get().isAuthenticated) return;

    try {
      const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
      await databases.updateDocument(DATABASE_ID, collectionId, id, { tags });
    } catch (error) {
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

    if (!state.isAuthenticated) return;

    try {
      const collectionId = item.type === 'folder' ? COLLECTIONS.FOLDERS : COLLECTIONS.NOTES;
      // Note: "folderId" for notes, "parentId" for folders.
      const data = item.type === 'folder' ? { parentId: newParentId } : { folderId: newParentId };
      await databases.updateDocument(DATABASE_ID, collectionId, id, data);
    } catch (error: any) {
      console.error('Failed to move item:', error);
      if (error.code === 401) {
          set({ isAuthenticated: false, user: null });
      }
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, parentId: oldParentId } : i),
      }));
    }
  },

  togglePublic: async (id) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    if (!item) return null;

    if (!state.isAuthenticated || state.isOfflineMode || !state.user) {
         return null;
    }

    const newIsPublic = !item.isPublic;
    
    // Optimistic update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPublic: newIsPublic } : i),
    }));

    try {
        const permissions = [
            Permission.read(Role.user(state.user.$id)),
            Permission.update(Role.user(state.user.$id)),
            Permission.delete(Role.user(state.user.$id)),
        ];

        if (newIsPublic) {
            permissions.push(Permission.read(Role.any()));
        }

        await databases.updateDocument(
            DATABASE_ID, 
            COLLECTIONS.NOTES, 
            id, 
            {}, 
            permissions
        );

        if (newIsPublic) {
            const baseUrl = isElectron() ? 'https://godnotes-8aoh.vercel.app' : window.location.origin;
            return `${baseUrl}/#/share/${id}`;
        }
    } catch (e) {
        console.error("Failed to toggle public access:", e);
        // Revert
        set((state) => ({
            items: state.items.map(i => i.id === id ? { ...i, isPublic: !newIsPublic } : i),
        }));
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
             const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.NOTES, id);
             content = doc.content;
         } catch (e) {
             console.error('Failed to fetch content for versioning:', e);
             return;
         }
    }

    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.NOTES,
        ID.unique(),
        {
          title: `${item.name} (v.${new Date().toLocaleString()})`,
          content: content,
          folderId: null, // No folder, so it doesn't show up in tree if we missed filter, but we filter by tag
          userId: state.user.$id,
          tags: [`version:of:${id}`],
          isFavorite: false
        },
        [
            Permission.read(Role.user(state.user.$id)),
            Permission.update(Role.user(state.user.$id)),
            Permission.delete(Role.user(state.user.$id)),
        ]
      );
    } catch (error: any) {
      console.error('Failed to create note:', error);
      if (error.code === 401) {
          set({ isAuthenticated: false, user: null });
      }
    }
  },

  getVersions: async (id) => {
    const state = get();
    if (!state.user) return [];

    try {
        // We cannot search by tag easily if it is not indexed, but tags are usually indexed or we can filter client side if we fetch all (bad).
        // Appwrite supports array search.
        const res = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.NOTES,
            [
                Query.equal('userId', state.user.$id),
                Query.search('tags', `version:of:${id}`), // Assuming tags are searchable
                Query.orderDesc('$createdAt')
            ]
        );
        
        // Fallback if search index is not ready or configured for tags: fetch recent notes and filter?
        // Actually, 'tags' usually requires an index. If not indexed, Query.search might fail or Query.equal might fail for array.
        // Let's try Query.equal for array element. Appwrite supports Query.equal('tags', 'value').
        
        return res.documents.map((n: any) => ({
          id: n.$id,
          name: n.title,
          type: 'file',
          parentId: null,
          content: n.content,
          createdAt: new Date(n.$createdAt).getTime(),
          isFavorite: false,
          tags: n.tags || [],
        }));
    } catch (error) {
        // Fallback: try Query.equal
         try {
            const res = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.NOTES,
                [
                    Query.equal('userId', state.user.$id),
                    Query.equal('tags', `version:of:${id}`),
                    Query.orderDesc('$createdAt')
                ]
            );
            return res.documents.map((n: any) => ({
                id: n.$id,
                name: n.title,
                type: 'file',
                parentId: null,
                content: n.content,
                createdAt: new Date(n.$createdAt).getTime(),
                isFavorite: false,
                tags: n.tags || [],
            }));
         } catch (e) {
             console.error('Failed to get versions:', e);
             return [];
         }
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

    // Ping Appwrite every 30 minutes to keep session alive
    const interval = setInterval(async () => {
      try {
        await account.get();
        // console.log('Session refreshed');
      } catch (error: any) {
        console.error('Session refresh failed:', error);
        if (error.code === 401) {
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
