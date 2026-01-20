
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
      };
    };
  }
}

export const isElectron = () => {
  return typeof window !== 'undefined' && !!window.electron;
};

export const electron = window.electron;

export const selectDirectory = async () => {
  if (!electron) return null;
  return await electron.selectDirectory();
};

export const getStoreValue = async (key: string) => {
  if (!electron) return null;
  return await electron.getStoreValue(key);
};

export const setStoreValue = async (key: string, value: any) => {
  if (!electron) return;
  await electron.setStoreValue(key, value);
};

export const getDocumentsPath = async () => {
  if (!electron) return null;
  return await electron.getDocumentsPath();
};

export const fs = electron?.fs;
