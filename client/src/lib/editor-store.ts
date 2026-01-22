import { create } from 'zustand';
import { Editor } from '@tiptap/react';

interface EditorStore {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  isAiSidebarOpen: boolean;
  setAiSidebarOpen: (isOpen: boolean) => void;
  toggleAiSidebar: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  isAiSidebarOpen: false,
  setAiSidebarOpen: (isOpen) => set({ isAiSidebarOpen: isOpen }),
  toggleAiSidebar: () => set((state) => ({ isAiSidebarOpen: !state.isAiSidebarOpen })),
}));
