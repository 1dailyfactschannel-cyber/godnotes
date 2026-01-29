import { app, BrowserWindow, shell, dialog, globalShortcut, ipcMain, safeStorage, session } from 'electron';
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

// Disable auto-download to allow manual user confirmation via UI
autoUpdater.autoDownload = false;
autoUpdater.allowPrerelease = false;

const store = new Store();

// Security: Path Validation Helper
const isPathAllowed = (targetPath) => {
  try {
    const resolvedTarget = path.resolve(targetPath);
    const allowedPaths = [app.getPath('documents')];
    
    // Add spaces to allowed paths
    const spaces = store.get('spaces') || [];
    if (Array.isArray(spaces)) {
      spaces.forEach(s => {
        if (s.path) allowedPaths.push(path.resolve(s.path));
      });
    }

    // Check if target is inside any allowed path
    return allowedPaths.some(allowed => {
      const relative = path.relative(allowed, resolvedTarget);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });
  } catch (e) {
    log.error('Path validation error:', e);
    return false;
  }
};

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
  if (!isPathAllowed(filePath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
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
  if (!isPathAllowed(filePath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    // log.error('fs-read-file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-exists', async (event, filePath) => {
  // Allow checking existence anywhere? Maybe safer to restrict too.
  if (!isPathAllowed(filePath)) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs-delete-file', async (event, filePath) => {
  if (!isPathAllowed(filePath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-delete-directory', async (event, dirPath) => {
  if (!isPathAllowed(dirPath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
  try {
    await shell.trashItem(dirPath);
    return { success: true };
  } catch (error) {
    log.error('Failed to move directory to trash:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-create-directory', async (event, dirPath) => {
  if (!isPathAllowed(dirPath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    log.error('fs-create-directory error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs-readdir', async (event, dirPath) => {
  if (!isPathAllowed(dirPath)) {
    return { success: false, error: 'Access denied: Path not allowed' };
  }
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

ipcMain.handle('save-secret', async (event, key, value) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { success: false, error: 'Encryption not available' };
  }
  try {
    const encrypted = safeStorage.encryptString(value);
    store.set('secret.' + key, encrypted.toString('hex'));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('load-secret', async (event, key) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { success: false, error: 'Encryption not available' };
  }
  try {
    const hex = store.get('secret.' + key);
    if (!hex) return { success: true, value: null };
    const buffer = Buffer.from(hex, 'hex');
    const decrypted = safeStorage.decryptString(buffer);
    return { success: true, value: decrypted };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('telegram-request', async (event, url, options) => {
  if (!url.startsWith('https://api.telegram.org/')) {
    return { success: false, error: 'Access denied: Only api.telegram.org is allowed' };
  }
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    log.error('telegram-request error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-pdf', async (event, htmlContent, defaultFilename) => {
  let printWindow = null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Сохранить как PDF',
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Cancelled' };
    }

    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    await fs.writeFile(filePath, pdfData);
    return { success: true, filePath };

  } catch (error) {
    log.error('Export PDF error:', error);
    return { success: false, error: error.message };
  } finally {
    if (printWindow) {
      printWindow.close();
    }
  }
});

ipcMain.handle('import-pdf', async (event, options = {}) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Выберите PDF файл для импорта',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Cancelled' };
    }

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    
    // Send progress start notification
    event.sender.send('import-progress', { 
      status: 'started', 
      filename: fileName,
      message: 'Начинаем импорт PDF файла...'
    });

    // Use pdfreader for PDF parsing
    const PdfReader = require('pdfreader').PdfReader;
    let fullText = '';
    let itemCount = 0;
    const maxItems = options.maxItems || 10000; // Limit for heavy files
    
    return new Promise((resolve) => {
      let timeoutId;
      
      // Timeout for very large files
      if (options.timeout !== false) {
        timeoutId = setTimeout(() => {
          event.sender.send('import-progress', { 
            status: 'timeout', 
            filename: fileName,
            message: 'Файл слишком большой, импорт остановлен'
          });
          resolve({ success: false, error: 'File too large or processing timeout' });
        }, options.timeout || 30000); // 30 seconds default
      }

      new PdfReader().parseFileItems(filePath, function(err, item) {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (err) {
          event.sender.send('import-progress', { 
            status: 'error', 
            filename: fileName,
            message: 'Ошибка при чтении файла: ' + err.message
          });
          resolve({ success: false, error: err.message });
        } else if (!item) {
          // End of file
          event.sender.send('import-progress', { 
            status: 'completed', 
            filename: fileName,
            message: 'Импорт завершен успешно!',
            textLength: fullText.length
          });
          
          resolve({ 
            success: true, 
            text: fullText.trim(),
            filename: fileName.replace('.pdf', ''),
            textLength: fullText.length
          });
        } else if (item.text) {
          fullText += item.text + ' ';
          itemCount++;
          
          // Send progress updates every 100 items
          if (itemCount % 100 === 0) {
            event.sender.send('import-progress', { 
              status: 'progress', 
              filename: fileName,
              processed: itemCount,
              message: `Обработано ${itemCount} элементов...`
            });
          }
          
          // Safety limit for very large files
          if (itemCount > maxItems) {
            event.sender.send('import-progress', { 
              status: 'warning', 
              filename: fileName,
              message: 'Файл очень большой, импортируем только часть содержимого'
            });
            // Continue but limit the amount of text
            if (fullText.length > 50000) { // ~50KB limit
              event.sender.send('import-progress', { 
                status: 'completed', 
                filename: fileName,
                message: 'Импорт завершен (ограниченная версия)'
              });
              resolve({ 
                success: true, 
                text: fullText.trim(),
                filename: fileName.replace('.pdf', ''),
                textLength: fullText.length,
                truncated: true
              });
            }
          }
        }
      });
    });

  } catch (error) {
    log.error('Import PDF error:', error);
    return { success: false, error: error.message };
  }
});

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // Disable auto download

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
       // In dev, load localhost with cache busting
       const PORT = process.env.VITE_PORT || process.env.PORT || 5001;
       const timestamp = Date.now();
       loadURLWithRetry(`http://localhost:${PORT}?v=${timestamp}`);
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

  function handleDeepLink(url) {
      if (!mainWindow) return;
      log.info('Received deep link:', url);
      
      try {
          // url format: godnotes://reset-password?userId=...&secret=...
          // We need to convert this to the internal hash route
          // godnotes://reset-password -> /#/reset-password
          
          const urlObj = new URL(url);
          const routePath = urlObj.hostname + urlObj.pathname; // reset-password or /reset-password
          const search = urlObj.search; // ?userId=...
          
          if (routePath.includes('reset-password')) {
              // Construct the internal URL
              // For hash router: #/reset-password?userId=...
              const internalRoute = `#/reset-password${search}`;
              
              log.info('Navigating to:', internalRoute);
              
              if (app.isPackaged) {
                 // In production (file://), we need to use hash navigation via JS or loadURL
                 // Since we use HashRouter, we can just reload the index with the hash?
                 // No, file://.../index.html#/reset-password
                 
                 const indexPath = path.join(__dirname, '../dist/public/index.html');
                 const fileUrl = `file://${indexPath}${internalRoute}`;
                 mainWindow.loadURL(fileUrl);
              } else {
                 // Dev mode
                 const PORT = process.env.VITE_PORT || process.env.PORT || 5001;
                 mainWindow.loadURL(`http://localhost:${PORT}/${internalRoute}`);
              }
          }
      } catch (e) {
          log.error('Failed to handle deep link:', e);
      }
  }

  app.on('open-url', (event, url) => {
      event.preventDefault();
      handleDeepLink(url);
  });

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Deep linking handler for Windows (protocol is passed as argument)
      const url = commandLine.find(arg => arg.startsWith('godnotes://'));
      if (url) {
         handleDeepLink(url);
      }
    }
  });

  // Handle deep linking on cold start (Windows/Linux)
  if (process.platform === 'win32') {
     const url = process.argv.find(arg => arg.startsWith('godnotes://'));
     if (url) {
        // We might not have window yet, wait for create
        // But since we are inside gotTheLock, we will create window.
        // We can store it in a global or handle it after create.
        global.deepLinkUrl = url;
     }
  }

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('godnotes', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('godnotes');
  }

  app.whenReady().then(() => {
    // CSP Configuration
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://api.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: blob: https:; " +
            "connect-src 'self' http://localhost:* https://api.telegram.org https://openrouter.ai https://api.openai.com https://api.anthropic.com https://github.com https://objects.githubusercontent.com https://1.1.1.1 wss:;"
          ]
        }
      });
    });

    // If we are in production build (bundled), we might need to spawn the server manually.
    // For now, we assume the server is started by the npm script wrapper.
    createWindow();

    // Check if we have a deep link from cold start
    if (global.deepLinkUrl) {
       handleDeepLink(global.deepLinkUrl);
    }

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

  autoUpdater.on('download-progress', (progressObj) => {
    // log.info('Download progress:', progressObj); // Optional: log progress
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'progress', progress: progressObj });
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    if (err.message && err.message.includes('404')) {
      log.warn('Update failed with 404. Check if the release files are available in the public releases repository.');
    }
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
  });

  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('start-download', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('open-task-window', async (event, taskId) => {
    // Determine if we are opening a specific task or the whole todo page
    const isTodoPage = taskId === 'todo-window-placeholder';
    const width = isTodoPage ? 1200 : 800;
    const height = isTodoPage ? 800 : 600;
    
    // For todo page, we might want a standard frame or keep it frameless with custom header?
    // Let's stick to frameless for consistency, but TodoPage doesn't have a custom header with close button yet.
    // So for TodoPage, let's use standard frame for now, or wrap it.
    // Actually, user asked for "new window", usually implies standard window behavior or similar to app.
    // Let's use frame: true for Todo page for better usability (maximize, minimize).
    const frame = isTodoPage; 

    const taskWindow = new BrowserWindow({
      width,
      height,
      frame, // true for todo page, false for task popup
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../client/public/icon.ico'),
      autoHideMenuBar: true,
    });

    const internalRoute = isTodoPage ? '#/todo-window' : `#/task/${taskId}`;
    
    if (app.isPackaged) {
        const indexPath = path.join(__dirname, '../dist/public/index.html');
        const fileUrl = `file://${indexPath}${internalRoute}`;
        taskWindow.loadURL(fileUrl);
    } else {
        const PORT = process.env.VITE_PORT || process.env.PORT || 5001;
        taskWindow.loadURL(`http://localhost:${PORT}/${internalRoute}`);
    }
    
    taskWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    return { success: true };
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
