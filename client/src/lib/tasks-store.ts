import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
async function apiRequest(method: string, endpoint: string, body?: any) {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  if (res.status === 204) return null;
  return res.json();
}

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
  loadTasks: () => void;
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
      addTask: (content, parentId, dueDate, notify = false, description, callLink, priority = 'medium', tags = [], recurring) => {
        const payload: any = {
          content,
          description,
          callLink,
          status: 'todo',
          parentId,
          dueDate,
          notify,
          isNotified: false,
          priority,
          tags,
          recurring,
        };
        apiRequest('POST', '/tasks', payload)
          .then((created) => {
            set((state) => ({
              tasks: [...state.tasks, created as Task],
            }));
          })
          .catch((err) => console.error('Failed to create task:', err));
      },
      toggleTask: (id) => {
        const state = useTasks.getState();
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        const isCompleting = !task.isCompleted;
        const newStatus = isCompleting ? 'done' : 'todo';

        apiRequest('PATCH', `/tasks/${id}`, { isCompleted: isCompleting, status: newStatus })
          .then((updated) => {
            set((s) => ({
              tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to toggle task:', err));

        if (isCompleting && task.recurring && task.dueDate) {
          let nextDate: Date;
          const currentDate = new Date(task.dueDate);
          switch (task.recurring) {
            case 'daily':
              nextDate = addDays(currentDate, 1);
              break;
            case 'weekly':
              nextDate = addWeeks(currentDate, 1);
              break;
            case 'monthly':
              nextDate = addMonths(currentDate, 1);
              break;
            case 'yearly':
              nextDate = addYears(currentDate, 1);
              break;
            default:
              nextDate = addDays(currentDate, 1);
          }
          const nextPayload: any = {
            content: task.content,
            description: task.description,
            callLink: task.callLink,
            status: 'todo',
            parentId: task.parentId,
            dueDate: nextDate.getTime(),
            notify: task.notify,
            isNotified: false,
            priority: task.priority,
            tags: task.tags,
            recurring: task.recurring,
          };
          apiRequest('POST', '/tasks', nextPayload)
            .then((created) => {
              set((s) => ({ tasks: [...s.tasks, created as Task] }));
            })
            .catch((err) => console.error('Failed to create next recurring task:', err));
        }
      },
      deleteTask: (id) => {
        const current = useTasks.getState();
        const children = current.tasks.filter((t) => t.parentId === id).map((t) => t.id);
        apiRequest('DELETE', `/tasks/${id}`)
          .then(() => {
            set((state) => ({
              tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
            }));
            children.forEach((childId) => {
              apiRequest('DELETE', `/tasks/${childId}`).catch(() => {});
            });
          })
          .catch((err) => console.error('Failed to delete task:', err));
      },
      updateTask: (id, updates) => {
        apiRequest('PATCH', `/tasks/${id}`, updates)
          .then((updated) => {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to update task:', err));
      },
      moveTask: (id, status) => {
        const isCompleted = status === 'done';
        apiRequest('PATCH', `/tasks/${id}`, { status, isCompleted })
          .then((updated) => {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to move task:', err));
      },
      setTaskDate: (id, date) => {
        apiRequest('PATCH', `/tasks/${id}`, { dueDate: date })
          .then((updated) => {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to set task date:', err));
      },
      toggleNotify: (id) => {
        const current = useTasks.getState();
        const task = current.tasks.find((t) => t.id === id);
        if (!task) return;
        apiRequest('PATCH', `/tasks/${id}`, { notify: !task.notify })
          .then((updated) => {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to toggle notify:', err));
      },
      markNotified: (id) => {
        apiRequest('PATCH', `/tasks/${id}`, { isNotified: true })
          .then((updated) => {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
            }));
          })
          .catch((err) => console.error('Failed to mark notified:', err));
      },
      setTelegramConfig: (config) => {
        set(() => ({
          telegramConfig: config,
        }));
      },
      setColumnOrder: (order) => {
        set(() => ({
          columnOrder: order,
        }));
      },
      setViewMode: (mode) => {
        set(() => ({
          viewMode: mode,
        }));
      },
      addColumn: (title) => {
        const newId = uuidv4();
        const state = useTasks.getState();
        const currentColumns = state.columns || [
          { id: 'todo', title: 'Нужно сделать' },
          { id: 'in_progress', title: 'В процессе' },
          { id: 'done', title: 'Готово' },
        ];
        const currentOrder = state.columnOrder || currentColumns.map((c) => c.id);

        set(() => ({
          columns: [...currentColumns, { id: newId, title }],
          columnOrder: [...currentOrder, newId],
        }));
      },
      updateColumn: (id, title) => {
        set((state) => ({
          columns: (state.columns || []).map((c) => (c.id === id ? { ...c, title } : c)),
        }));
      },
      deleteColumn: (id) => {
        set((state) => {
          const fallbackColumn = state.columns.find((c) => c.id !== id)?.id || 'todo';
          return {
            columns: state.columns.filter((c) => c.id !== id),
            columnOrder: (state.columnOrder || []).filter((cId) => cId !== id),
            tasks: state.tasks.map((t) => (t.status === id ? { ...t, status: fallbackColumn } : t)),
          };
        });
      },
      loadTasks: () => {
        apiRequest('GET', '/tasks')
          .then((tasks) => {
            set(() => ({ tasks }));
          })
          .catch((err) => console.error('Failed to load tasks:', err));
      },
    }),
    {
      name: 'godnotes-tasks', // unique name
      partialize: (state) => ({
        columns: state.columns,
        columnOrder: state.columnOrder,
        viewMode: state.viewMode,
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
        try {
          useTasks.getState().loadTasks();
        } catch {}
      }
    }
  )
);
