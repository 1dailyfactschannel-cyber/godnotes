
declare global {
  interface Window {
    electron?: {
      selectDirectory: () => Promise<string | null>;
      getStoreValue: (key: string) => Promise<any>;
      setStoreValue: (key: string, value: any) => Promise<void>;
      getDocumentsPath: () => Promise<string>;
      fs: {
        writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        exists: (path: string) => Promise<boolean>;
        deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
        deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
        readdir: (path: string) => Promise<{ success: boolean; entries?: { name: string; isDirectory: boolean }[]; error?: string }>;
      };
      telegramRequest: (url: string, options?: RequestInit) => Promise<{ success: boolean; data?: any; error?: string }>;
      saveSecret: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      loadSecret: (key: string) => Promise<{ success: boolean; value?: string; error?: string }>;
      checkForUpdates: () => Promise<void>;
      startDownload: () => Promise<void>;
      exportToPdf: (html: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      quitAndInstall: () => Promise<void>;
      onUpdateStatus: (callback: (status: any) => void) => void;
      getAppVersion: () => Promise<string>;
    };
  }
}

export const isElectron = () => {
  return typeof window !== 'undefined' && !!window.electron;
};

export const electron = window.electron;

export const telegramRequest = async (url: string, options?: RequestInit) => {
  if (isElectron() && electron) {
    const res = await electron.telegramRequest(url, options);
    if (!res.success) throw new Error(res.error || 'Telegram request failed');
    return res.data;
  } else {
    // Fallback for web (might still fail CORS if not proxied)
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  }
};

export const selectDirectory = async () => {
  if (!electron) return null;
  return await electron.selectDirectory();
};

export const getStoreValue = async (key: string) => {
  if (!electron) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  }
  return await electron.getStoreValue(key);
};

export const setStoreValue = async (key: string, value: any) => {
  if (!electron) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error writing to localStorage', e);
    }
    return;
  }
  await electron.setStoreValue(key, value);
};

export const getDocumentsPath = async () => {
  if (!electron) return null;
  return await electron.getDocumentsPath();
};

export const fs = electron?.fs;
