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
}

const initialItems: FileSystemItem[] = [
  { id: '1', name: 'Personal', type: 'folder', parentId: null, createdAt: Date.now() },
  { id: '2', name: 'Work', type: 'folder', parentId: null, createdAt: Date.now() },
  { id: '3', name: 'Journal', type: 'file', parentId: '1', content: '<h1>My Journal</h1><p>Today was a good day. I started working on a new project.</p>', createdAt: Date.now() },
  { id: '4', name: 'Project Ideas', type: 'file', parentId: '2', content: '<h1>Project Ideas</h1><ul><li>Build a clone of Obsidian</li><li>Learn Rust</li><li>Go for a run</li></ul>', createdAt: Date.now() },
  { id: '5', name: 'Welcome', type: 'file', parentId: null, content: '<h1>Welcome to Your Notes</h1><p>This is a simple clone of Obsidian. You can create folders, files, and write in Markdown.</p><h2>Features</h2><ul><li>Full text editing</li><li>Folders and nested files</li><li>Dark mode by default</li><li>Fast search</li></ul>', createdAt: Date.now() },
];

export const useFileSystem = create<FileSystemState>((set, get) => ({
  items: initialItems,
  activeFileId: '5',
  expandedFolders: new Set(['1', '2']),
  searchQuery: '',
  theme: 'obsidian-dark',
  isAuthenticated: false,

  addFile: (parentId, name = 'Untitled Note') => {
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

  addFolder: (parentId, name = 'New Folder') => {
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
}));
