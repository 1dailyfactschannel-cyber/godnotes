import { app, BrowserWindow, shell, dialog, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import log from 'electron-log';
import Store from 'electron-store';
import fs from 'fs/promises';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const store = new Store();

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-documents-path', () => {
  return app.getPath('documents');
});

ipcMain.handle('fs-write-file', async (event, filePath, content) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    log.error('fs-write-file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    // log.error('fs-read-file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs-delete-file', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-readdir', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return {
      success: true,
      entries: entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-store-value', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('telegram-request', async (event, url, options) => {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    log.error('telegram-request error:', error);
    return { success: false, error: error.message };
  }
});

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Start server in production
// if (app.isPackaged) {
//   try {
//     // Attempt to load .env from resources path (where app is running)
//     const envPath = path.join(process.resourcesPath, '..', '.env');
//     log.info(`Attempting to load .env from ${envPath}`);
//     require('dotenv').config({ path: envPath });

//     // Also try to load from inside the app (in case it's packed)
//     const internalEnvPath = path.join(app.getAppPath(), '.env');
//     require('dotenv').config({ path: internalEnvPath });

//     const serverPath = path.join(__dirname, '../dist/index.cjs');
//     log.info(`Starting server from ${serverPath}`);
    
//     // Set environment variables for production if not set
//     if (!process.env.DATABASE_URL) {
//       // In a real desktop app, you might use SQLite or a local Postgres instance.
//       // For now, we'll try to use the same env if it exists, or log an error.
//       log.warn('DATABASE_URL is not set in production. Database connection may fail.');
//     }
    
//     // require(serverPath); // Legacy server removed
//   } catch (err) {
//     log.error('Failed to start server:', err);
//   }
// }

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../client/public/icon.ico'), // Use ICO for Windows compatibility
      autoHideMenuBar: true, // Hide the default menu bar
    });
    
    // Explicitly set icon (sometimes needed)
    mainWindow.setIcon(path.join(__dirname, '../client/public/icon.ico'));

    // Load the app
    const loadURLWithRetry = (url, retries = 10) => {
      if (!mainWindow) return;
      mainWindow.loadURL(url).catch((err) => {
        if (retries > 0) {
          log.info(`Failed to load URL ${url}, retrying in 500ms... (${retries} left)`);
          setTimeout(() => loadURLWithRetry(url, retries - 1), 500);
        } else {
          log.error('Failed to load app:', err);
          dialog.showErrorBox('Connection Error', 'Failed to connect to the server.');
        }
      });
    };

    if (app.isPackaged) {
       // In production, load the local bundled file
       const indexPath = path.join(__dirname, '../dist/public/index.html');
       mainWindow.loadFile(indexPath).catch(e => log.error('Failed to load index.html:', e));
    } else {
       // In dev, load localhost
       const PORT = process.env.PORT || 5001;
       loadURLWithRetry(`http://localhost:${PORT}`);
    }

    // Open external links in default browser, not Electron
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // If we are in production build (bundled), we might need to spawn the server manually.
    // For now, we assume the server is started by the npm script wrapper.
    createWindow();

    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();

    globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available', info });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', info);
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', info });
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
  });

  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
