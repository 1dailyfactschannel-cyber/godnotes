import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

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
  searchQuery: string;
  theme: ThemeType;
  isAuthenticated: boolean;
  
  // Actions
  addFile: (parentId: string | null, name?: string) => void;
  addFolder: (parentId: string | null, name?: string) => void;
  deleteItem: (id: string) => void;
  renameItem: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  selectFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setTheme: (theme: ThemeType) => void;
  login: () => void;
  logout: () => void;
  togglePin: (id: string) => void;
  moveItem: (id: string, newParentId: string | null) => void;
}

const initialItems: FileSystemItem[] = [
  { id: '1', name: 'Личное', type: 'folder', parentId: null, createdAt: Date.now(), isPinned: true },
  { id: '2', name: 'Работа', type: 'folder', parentId: null, createdAt: Date.now() },
  { id: '3', name: 'Мой дневник', type: 'file', parentId: '1', content: '<h1>Мой дневник</h1><p>Сегодня был отличный день. Я начал работу над новым проектом.</p>', createdAt: Date.now() },
  { id: '4', name: 'Идеи проектов', type: 'file', parentId: '2', content: '<h1>Идеи проектов</h1><ul><li>Собрать клон Obsidian</li><li>Изучить Rust</li><li>Пойти на пробежку</li></ul>', createdAt: Date.now() },
  { id: '5', name: 'Добро пожаловать', type: 'file', parentId: null, content: '<h1>Добро пожаловать в заметки</h1><p>Это простой клон Obsidian. Вы можете создавать папки, файлы и писать в Markdown.</p><h2>Возможности</h2><ul><li>Полноценный текстовый редактор</li><li>Папки и вложенные файлы</li><li>Темная тема по умолчанию</li><li>Быстрый поиск</li></ul>', createdAt: Date.now(), isPinned: true },
];

export const useFileSystem = create<FileSystemState>((set, get) => ({
  items: initialItems,
  activeFileId: '5',
  expandedFolders: new Set(['1', '2']),
  searchQuery: '',
  theme: 'obsidian-dark',
  isAuthenticated: false,

  addFile: (parentId, name = 'Новая заметка') => {
    const newFile: FileSystemItem = {
      id: uuidv4(),
      name,
      type: 'file',
      parentId,
      content: '',
      createdAt: Date.now(),
    };
    set((state) => ({
      items: [...state.items, newFile],
      activeFileId: newFile.id,
    }));
  },

  addFolder: (parentId, name = 'Новая папка') => {
    const newFolder: FileSystemItem = {
      id: uuidv4(),
      name,
      type: 'folder',
      parentId,
      createdAt: Date.now(),
    };
    set((state) => ({
      items: [...state.items, newFolder],
      expandedFolders: new Set([...Array.from(state.expandedFolders), newFolder.id]),
    }));
  },

  deleteItem: (id) => {
    set((state) => {
      const getAllDescendants = (itemId: string): string[] => {
        const children = state.items.filter(i => i.parentId === itemId);
        return [itemId, ...children.flatMap(c => getAllDescendants(c.id))];
      };
      
      const idsToDelete = new Set(getAllDescendants(id));
      const newItems = state.items.filter(i => !idsToDelete.has(i.id));
      const newActiveId = idsToDelete.has(state.activeFileId || '') ? null : state.activeFileId;

      return {
        items: newItems,
        activeFileId: newActiveId,
      };
    });
  },

  renameItem: (id, newName) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, name: newName } : i),
    }));
  },

  updateFileContent: (id, content) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, content } : i),
    }));
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

  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  
  togglePin: (id) => {
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, isPinned: !i.isPinned } : i),
    }));
  },

  moveItem: (id, newParentId) => {
    set((state) => {
      // Prevent moving an item into itself or its descendants
      if (id === newParentId) return state;
      
      const isDescendant = (parentId: string, targetId: string): boolean => {
        if (parentId === targetId) return true;
        const parent = state.items.find(i => i.id === parentId);
        if (parent?.parentId) return isDescendant(parent.parentId, targetId);
        return false;
      };

      if (newParentId && isDescendant(newParentId, id)) {
        return state;
      }

      return {
        items: state.items.map(i => i.id === id ? { ...i, parentId: newParentId } : i),
      };
    });
  },
}));
