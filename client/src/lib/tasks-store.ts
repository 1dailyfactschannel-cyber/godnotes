import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

export type Priority = 'high' | 'medium' | 'low';
export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskStatus = string; // Changed from union to string for dynamic columns

export interface Column {
  id: string;
  title: string;
}

export type Task = {
  id: string;
  content: string;
  description?: string;
  callLink?: string;
  isCompleted: boolean;
  status?: TaskStatus; // New field for Kanban
  parentId?: string; // For subtasks
  dueDate?: number; // Timestamp
  createdAt: number;
  notify?: boolean;
  isNotified?: boolean;
  priority?: Priority;
  tags?: string[];
  recurring?: RecurringInterval;
};

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface TasksState {
  tasks: Task[];
  columns: Column[];
  columnOrder: string[];
  viewMode: 'list' | 'board';
  telegramConfig: TelegramConfig;
  addTask: (content: string, parentId?: string, dueDate?: number, notify?: boolean, description?: string, callLink?: string, priority?: Priority, tags?: string[], recurring?: RecurringInterval) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void; // New action for Kanban
  setTaskDate: (id: string, date: number | undefined) => void;
  toggleNotify: (id: string) => void;
  markNotified: (id: string) => void;
  setTelegramConfig: (config: TelegramConfig) => void;
  setColumnOrder: (order: string[]) => void;
  setViewMode: (mode: 'list' | 'board') => void;
  addColumn: (title: string) => void;
  updateColumn: (id: string, title: string) => void;
  deleteColumn: (id: string) => void;
}

export const useTasks = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],
      columns: [
          { id: 'todo', title: 'Нужно сделать' },
          { id: 'in_progress', title: 'В процессе' },
          { id: 'done', title: 'Готово' }
      ],
      columnOrder: ['todo', 'in_progress', 'done'],
      viewMode: 'list',
      telegramConfig: {
        botToken: '',
        chatId: '',
      },
      addTask: (content, parentId, dueDate, notify = false, description, callLink, priority = 'medium', tags = [], recurring) => set((state) => ({
        tasks: [
          ...state.tasks,
          {
            id: uuidv4(),
            content,
            description,
            callLink,
            isCompleted: false,
            status: 'todo', // Default status
            parentId,
            dueDate,
            createdAt: Date.now(),
            notify,
            isNotified: false,
            priority,
            tags,
            recurring
          },
        ],
      })),
      toggleTask: (id) => set((state) => {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return state;

        const isCompleting = !task.isCompleted;
        const newStatus = isCompleting ? 'done' : 'todo'; // Sync status
        let newTasks = [...state.tasks];

        // Handle recurring tasks
        if (isCompleting && task.recurring && task.dueDate) {
          let nextDate: Date;
          const currentDate = new Date(task.dueDate);
          
          switch (task.recurring) {
            case 'daily': nextDate = addDays(currentDate, 1); break;
            case 'weekly': nextDate = addWeeks(currentDate, 1); break;
            case 'monthly': nextDate = addMonths(currentDate, 1); break;
            case 'yearly': nextDate = addYears(currentDate, 1); break;
            default: nextDate = addDays(currentDate, 1);
          }

          const nextTask: Task = {
            ...task,
            id: uuidv4(),
            dueDate: nextDate.getTime(),
            isCompleted: false,
            status: 'todo',
            createdAt: Date.now(),
            isNotified: false,
            // Keep recurring on the new task
            recurring: task.recurring
          };
          
          newTasks.push(nextTask);
        }

        return {
          tasks: newTasks.map((t) =>
            t.id === id ? { ...t, isCompleted: isCompleting, status: newStatus } : t
          ),
        };
      }),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
      })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),
      moveTask: (id, status) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, status, isCompleted: status === 'done' } : t
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
      setColumnOrder: (order) => set(() => ({
        columnOrder: order,
      })),
      setViewMode: (mode) => set(() => ({
        viewMode: mode,
      })),
      addColumn: (title) => set((state) => {
        const newId = uuidv4();
        const currentColumns = state.columns || [
          { id: 'todo', title: 'Нужно сделать' },
          { id: 'in_progress', title: 'В процессе' },
          { id: 'done', title: 'Готово' }
        ];
        const currentOrder = state.columnOrder || currentColumns.map(c => c.id);
        
        return {
          columns: [...currentColumns, { id: newId, title }],
          columnOrder: [...currentOrder, newId]
        };
      }),
      updateColumn: (id, title) => set((state) => ({
        columns: (state.columns || []).map(c => c.id === id ? { ...c, title } : c)
      })),
      deleteColumn: (id) => set((state) => {
        const fallbackColumn = state.columns.find(c => c.id !== id)?.id || 'todo';
        return {
          columns: state.columns.filter(c => c.id !== id),
          columnOrder: (state.columnOrder || []).filter(cId => cId !== id),
          tasks: state.tasks.map(t => t.status === id ? { ...t, status: fallbackColumn } : t)
        };
      }),
    }),
    {
      name: 'godnotes-tasks', // unique name
      partialize: (state) => ({
        ...state,
        telegramConfig: {
          ...state.telegramConfig,
          botToken: '', // Don't persist botToken
        },
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (!state.columns || state.columns.length === 0)) {
           state.columns = [
             { id: 'todo', title: 'Нужно сделать' },
             { id: 'in_progress', title: 'В процессе' },
             { id: 'done', title: 'Готово' }
           ];
           state.columnOrder = ['todo', 'in_progress', 'done'];
        }
      }
    }
  )
);