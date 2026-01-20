import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';

export type Task = {
  id: string;
  content: string;
  description?: string;
  isCompleted: boolean;
  parentId?: string; // For subtasks
  dueDate?: number; // Timestamp
  createdAt: number;
  notify?: boolean;
  isNotified?: boolean;
};

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface TasksState {
  tasks: Task[];
  telegramConfig: TelegramConfig;
  addTask: (content: string, parentId?: string, dueDate?: number, notify?: boolean, description?: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setTaskDate: (id: string, date: number | undefined) => void;
  toggleNotify: (id: string) => void;
  markNotified: (id: string) => void;
  setTelegramConfig: (config: TelegramConfig) => void;
}

export const useTasks = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],
      telegramConfig: {
        botToken: '8302831843:AAGoscf-zWrH3cxlTINmMTwQzHmh_gGPO0E',
        chatId: '',
      },
      addTask: (content, parentId, dueDate, notify = false, description) => set((state) => ({
        tasks: [
          ...state.tasks,
          {
            id: uuidv4(),
            content,
            description,
            isCompleted: false,
            parentId,
            dueDate,
            createdAt: Date.now(),
            notify,
            isNotified: false
          },
        ],
      })),
      toggleTask: (id) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
        ),
      })),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
      })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),
      setTaskDate: (id, date) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, dueDate: date } : t
        ),
      })),
      toggleNotify: (id) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, notify: !t.notify } : t
        ),
      })),
      markNotified: (id) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, isNotified: true } : t
        ),
      })),
      setTelegramConfig: (config) => set(() => ({
        telegramConfig: config,
      })),
    }),
    {
      name: 'godnotes-tasks', // unique name
    }
  )
);
