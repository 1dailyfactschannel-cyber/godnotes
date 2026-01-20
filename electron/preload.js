const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
  fs: {
    writeFile: (path, content) => ipcRenderer.invoke('fs-write-file', path, content),
    readFile: (path) => ipcRenderer.invoke('fs-read-file', path),
    exists: (path) => ipcRenderer.invoke('fs-exists', path),
    deleteFile: (path) => ipcRenderer.invoke('fs-delete-file', path),
  }
});
