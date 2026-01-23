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
    deleteDirectory: (path) => ipcRenderer.invoke('fs-delete-directory', path),
    createDirectory: (path) => ipcRenderer.invoke('fs-create-directory', path),
    readdir: (path) => ipcRenderer.invoke('fs-readdir', path),
    stat: (path) => ipcRenderer.invoke('fs-stat', path),
  },
  telegramRequest: (url, options) => ipcRenderer.invoke('telegram-request', url, options),
  saveSecret: (key, value) => ipcRenderer.invoke('save-secret', key, value),
  loadSecret: (key) => ipcRenderer.invoke('load-secret', key),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  startDownload: () => ipcRenderer.invoke('start-download'),
  exportToPdf: (html, filename) => ipcRenderer.invoke('export-pdf', html, filename),
  importPdf: () => ipcRenderer.invoke('import-pdf'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, ...args) => callback(...args)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openTaskWindow: (taskId) => ipcRenderer.invoke('open-task-window', taskId),
});
