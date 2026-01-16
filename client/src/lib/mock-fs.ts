import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { apiRequest } from '@/lib/queryClient';

const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export type ThemeType = 'obsidian-dark' | 'midnight-blue' | 'graphite' | 'light-mode';

export type FileSystemItem = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  content?: string;
  createdAt: number;
  isPinned?: boolean;
};

interface FileSystemState {
  items: FileSystemItem[];
  activeFileId: string | null;
  expandedFolders: Set<string>;
  lastCreatedFileId: string | null;
  lastCreatedFolderId: string | null;
  searchQuery: string;
  theme: ThemeType;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  
  fetchFolders: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  checkAuth: () => Promise<void>;
  addFile: (parentId: string | null, name?: string) => void;
  addFolder: (parentId: string | null, name?: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  renameItem: (id: string, newName: string) => Promise<void>;
  updateFileContent: (id: string, content: string) => void;
  selectFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setTheme: (theme: ThemeType) => void;
  login: () => void;
  logout: () => void;
  togglePin: (id: string) => void;
  moveItem: (id: string, newParentId: string | null) => Promise<void>;
}

const initialItems: FileSystemItem[] = [
  { id: '3', name: 'Мой дневник', type: 'file', parentId: '1', content: '<h1>Мой дневник</h1><p>Сегодня был отличный день. Я начал работу над новым проектом.</p>', createdAt: Date.now() },
  { id: '4', name: 'Идеи проектов', type: 'file', parentId: '2', content: '<h1>Идеи проектов</h1><ul><li>Собрать клон Obsidian</li><li>Изучить Rust</li><li>Пойти на пробежку</li></ul>', createdAt: Date.now() },
  { id: '5', name: 'Добро пожаловать', type: 'file', parentId: null, content: '<h1>Добро пожаловать в заметки</h1><p>Это простой клон Obsidian. Вы можете создавать папки, файлы и писать в Markdown.</p><h2>Возможности</h2><ul><li>Полноценный текстовый редактор</li><li>Папки и вложенные файлы</li><li>Темная тема по умолчанию</li><li>Быстрый поиск</li></ul>', createdAt: Date.now(), isPinned: true },
];

export const useFileSystem = create<FileSystemState>((set, get) => ({
  items: initialItems,
  activeFileId: '5',
  expandedFolders: new Set(),
  lastCreatedFileId: null,
   lastCreatedFolderId: null,
  searchQuery: '',
  theme: 'obsidian-dark',
  isAuthenticated: false,
   isAuthChecking: false,

  fetchFolders: async () => {
    try {
      const res = await apiRequest('GET', '/api/folders');
      if (res.ok) {
        const folders: any[] = await res.json();
        const folderItems: FileSystemItem[] = folders.map(f => ({
          id: f.id,
          name: f.name,
          type: 'folder',
          parentId: f.parentId,
          createdAt: new Date(f.createdAt).getTime(),
        }));
        
        set(state => {
          return {
            items: [...state.items.filter(i => i.type === 'file'), ...folderItems],
            expandedFolders: new Set([...Array.from(state.expandedFolders), ...folderItems.map(f => f.id)])
          };
        });
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  },

  fetchNotes: async () => {
    try {
      const res = await apiRequest('GET', '/api/notes');
      if (res.ok) {
        const notes: any[] = await res.json();
        const fileItems: FileSystemItem[] = notes.map(n => ({
          id: n.id,
          name: n.title,
          type: 'file',
          parentId: n.folderId,
          content: n.content,
          createdAt: new Date(n.createdAt).getTime(),
        }));
        set(state => {
          const folders = state.items.filter(i => i.type === 'folder');
          return {
            items: [...fileItems, ...folders],
            activeFileId: state.activeFileId && fileItems.find(f => f.id === state.activeFileId)
              ? state.activeFileId
              : fileItems[0]?.id ?? null,
          };
        });
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  },

  checkAuth: async () => {
    set({ isAuthChecking: true });
    try {
      const res = await apiRequest('GET', '/api/auth/me');
      if (res.ok) {
        set({ isAuthenticated: true });
        await Promise.all([get().fetchFolders(), get().fetchNotes()]);
      } else {
        set({ isAuthenticated: false, items: initialItems, activeFileId: '5' });
      }
    } catch (error) {
      set({ isAuthenticated: false, items: initialItems, activeFileId: '5' });
    } finally {
      set({ isAuthChecking: false });
    }
  },

  addFile: async (parentId, name = 'Новая заметка') => {
    const state = get();
    if (!state.isAuthenticated) {
      const newFile: FileSystemItem = {
        id: uuidv4(),
        name,
        type: 'file',
        parentId,
        content: '',
        createdAt: Date.now(),
      };
      set((s) => {
        if (!parentId) {
          return {
            items: [...s.items, newFile],
            activeFileId: newFile.id,
            lastCreatedFileId: newFile.id,
          };
        }
        const expanded = new Set(s.expandedFolders);
        expanded.add(parentId);
        return {
          items: [...s.items, newFile],
          activeFileId: newFile.id,
          expandedFolders: expanded,
          lastCreatedFileId: newFile.id,
        };
      });
      return;
    }
    try {
      const res = await apiRequest('POST', '/api/notes', {
        title: name,
        content: '',
        folderId: parentId,
      });
      if (res.ok) {
        const note = await res.json();
        const newFile: FileSystemItem = {
          id: note.id,
          name: note.title,
          type: 'file',
          parentId: note.folderId,
          content: note.content,
          createdAt: new Date(note.createdAt).getTime(),
        };
        set((s) => {
          if (!parentId) {
            return {
              items: [...s.items, newFile],
              activeFileId: newFile.id,
              lastCreatedFileId: newFile.id,
            };
          }
          const expanded = new Set(s.expandedFolders);
          expanded.add(parentId);
          return {
            items: [...s.items, newFile],
            activeFileId: newFile.id,
            expandedFolders: expanded,
            lastCreatedFileId: newFile.id,
          };
        });
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  },

  addFolder: async (parentId, name = 'Новая папка') => {
    try {
      const res = await apiRequest('POST', '/api/folders', {
        name,
        parentId
      });
      
      if (res.ok) {
        const folder = await res.json();
        const newFolder: FileSystemItem = {
          id: folder.id,
          name: folder.name,
          type: 'folder',
          parentId: folder.parentId,
          createdAt: new Date(folder.createdAt).getTime(),
        };
        
        set((state) => ({
          items: [...state.items, newFolder],
          expandedFolders: new Set([...Array.from(state.expandedFolders), newFolder.id]),
          lastCreatedFolderId: newFolder.id,
        }));
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  },

  deleteItem: async (id) => {
    const state = get();
    const item = state.items.find(i => i.id === id);
    
    // Helper to get all descendant IDs
    const getAllDescendants = (itemId: string): string[] => {
      const children = state.items.filter(i => i.parentId === itemId);
      return [itemId, ...children.flatMap(c => getAllDescendants(c.id))];
    };
    
    const idsToDelete = getAllDescendants(id);
    const foldersToDelete = idsToDelete.filter(id => state.items.find(i => i.id === id)?.type === 'folder');
    const filesToDelete = idsToDelete.filter(id => state.items.find(i => i.id === id)?.type === 'file');

    // Optimistically update UI
    set((state) => {
      const idsSet = new Set(idsToDelete);
      const newItems = state.items.filter(i => !idsSet.has(i.id));
      const newActiveId = idsSet.has(state.activeFileId || '') ? null : state.activeFileId;
      return {
        items: newItems,
        activeFileId: newActiveId,
      };
    });

    try {
      await Promise.all([
        ...foldersToDelete.map(folderId =>
          apiRequest('DELETE', `/api/folders/${folderId}`)
        ),
        ...filesToDelete.map(fileId =>
          apiRequest('DELETE', `/api/notes/${fileId}`)
        ),
      ]);
    } catch (error) {
      console.error('Failed to delete items:', error);
    }
  },

  renameItem: async (id, newName) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    // Optimistically update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, name: newName } : i),
    }));

    if (item.type === 'folder') {
      try {
        await apiRequest('PATCH', `/api/folders/${id}`, { name: newName });
      } catch (error) {
        console.error('Failed to rename folder:', error);
        set((state) => ({
          items: state.items.map(i => i.id === id ? { ...i, name: item.name } : i),
        }));
      }
    } else {
      try {
        await apiRequest('PATCH', `/api/notes/${id}`, { title: newName });
      } catch (error) {
        console.error('Failed to rename note:', error);
        set((state) => ({
          items: state.items.map(i => i.id === id ? { ...i, name: item.name } : i),
        }));
      }
    }
  },

  updateFileContent: async (id, content) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, content } : i),
    }));

    const item = get().items.find(i => i.id === id);
    const state = get();
    if (!item || !state.isAuthenticated || item.type !== 'file') {
      return;
    }

    const existingTimeout = saveTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(async () => {
      try {
        await apiRequest('PATCH', `/api/notes/${id}`, { content });
      } catch (error) {
        console.error('Failed to update note content:', error);
      } finally {
        saveTimeouts.delete(id);
      }
    }, 400);

    saveTimeouts.set(id, timeoutId);
  },

  selectFile: (id) => {
    set({ activeFileId: id });
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
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setTheme: (theme) => {
    set({ theme });
  },

  login: () => {
    set({ isAuthenticated: true });
    get().fetchFolders();
  },
  
  logout: () => {
    set({ isAuthenticated: false, items: initialItems });
  },
  
  togglePin: (id) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPinned: !i.isPinned } : i),
    }));
  },

  moveItem: async (id, newParentId) => {
    const state = get();
    // Prevent moving an item into itself
    if (id === newParentId) return;
    
    // Prevent moving an item into its own descendant
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

    // Optimistically update
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, parentId: newParentId } : i),
    }));

    if (item.type === 'folder') {
      try {
        await apiRequest('PATCH', `/api/folders/${id}`, { parentId: newParentId });
      } catch (error) {
        console.error('Failed to move folder:', error);
        set((state) => ({
          items: state.items.map(i => i.id === id ? { ...i, parentId: oldParentId } : i),
        }));
      }
    } else {
      try {
        await apiRequest('PATCH', `/api/notes/${id}`, { folderId: newParentId });
      } catch (error) {
        console.error('Failed to move note:', error);
        set((state) => ({
          items: state.items.map(i => i.id === id ? { ...i, parentId: oldParentId } : i),
        }));
      }
    }
  },
}));
