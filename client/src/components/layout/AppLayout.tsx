import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation, Link } from "wouter";
import { selectDirectory, getStoreValue, setStoreValue, telegramRequest, isElectron, electron } from '@/lib/electron';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { TrashDialog } from '@/components/trash/TrashDialog';
import { Logo } from '@/components/Logo';
import { TabBar } from '@/components/layout/TabBar';
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog';

import { CommandPalette } from '@/components/CommandPalette';
import { FileTree } from '@/components/sidebar/FileTree';
import { FavoritesDialog } from '@/components/favorites/FavoritesDialog';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import ErrorBoundary from '@/components/ErrorBoundary.tsx';
const TiptapEditor = lazy(() => import('@/components/editor/TiptapEditor'));
import { AIChatSidebar } from '@/components/editor/AIChatSidebar';
import { useEditorStore } from '@/lib/editor-store';
import { Search, Hash, ChevronRight, Minimize2, Maximize2, Square, X, Settings, Check, Clock, Star, Trash2, Sidebar, BookOpen, PenLine, FolderOpen, Plus, CheckCircle2, User, ChevronsUpDown, PanelLeft, Calendar as CalendarIcon, ListTodo, Send, Loader2, Unplug, Sparkles, Share2 } from 'lucide-react';
import { useFileSystem, ThemeType } from '@/lib/mock-fs';
import { useTasks } from '@/lib/tasks-store';
import { cn, isHotkeyMatch } from '@/lib/utils';
import { GraphView } from '@/components/graph/GraphView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function AppLayout() {
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId, theme, setTheme, toggleFolder, expandedFolders, hotkeys, setHotkey, initLocalFs, startPeriodicSync, stopPeriodicSync, isOfflineMode, toggleOfflineMode, updateUserPrefs, addFile, isZenMode, toggleZenMode } = useFileSystem();
  const { telegramConfig, setTelegramConfig } = useTasks();
  const { isAiSidebarOpen, toggleAiSidebar } = useEditorStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [location, setLocation] = useLocation();
  const [searchHighlight, setSearchHighlight] = useState('');
  const [storagePath, setStoragePath] = useState<string>('');
  const [spaces, setSpaces] = useState<{ id: string; name: string; path: string }[]>([]);
  const { toast } = useToast();
  const [trashOpen, setTrashOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  const [spaceNameDialogOpen, setSpaceNameDialogOpen] = useState(false);
  const [pendingSpacePath, setPendingSpacePath] = useState<string | null>(null);
  const [spaceNameInput, setSpaceNameInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectTelegram = async () => {
    if (!telegramConfig.botToken) {
      toast({ variant: "destructive", title: "Ошибка", description: "Bot Token не задан" });
      return;
    }
    setIsConnecting(true);
    const code = crypto.randomUUID().split('-')[0];
    const botUrl = `https://t.me/godnotes_bot?start=${code}`;
    window.open(botUrl, '_blank');

    const start = Date.now();
    const token = telegramConfig.botToken;
    let connected = false;

    // Poll for update
    while (Date.now() - start < 60000 && !connected) { // 1 min timeout
      try {
        const data = await telegramRequest(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
        if (data.ok) {
          const update = data.result.find((u: any) => u.message?.text === `/start ${code}`);
          if (update) {
            const chatId = update.message.chat.id.toString();
            const username = update.message.from.username;

            setTelegramConfig({ ...telegramConfig, chatId });
            
            if (username) {
               try {
                 await updateUserPrefs({ telegram: username });
               } catch(e) { console.error('Failed to update profile', e); }
            }

            await telegramRequest(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '✅ GodNotes: Уведомления успешно подключены!',
              }),
            });

            toast({ title: "Успех", description: "Telegram уведомления подключены" });
            connected = true;
          }
        }
      } catch (e) {
        console.error(e);
      }
      if (!connected) await new Promise(r => setTimeout(r, 2000));
    }

    setIsConnecting(false);
    if (!connected) {
      toast({ title: "Ошибка", description: "Не удалось подключить Telegram (таймаут)", variant: "destructive" });
    }
  };

  const handleDisconnectTelegram = () => {
    setTelegramConfig({ ...telegramConfig, chatId: '' });
    toast({ title: "Отключено", description: "Telegram уведомления отключены" });
  };


  const testTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      toast({ variant: "destructive", title: "Ошибка", description: "Заполните Bot Token и Chat ID" });
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramConfig.chatId,
          text: '🔔 Тестовое уведомление от GodNotes',
        }),
      });
      if (res.ok) {
        toast({ title: "Успех", description: "Тестовое сообщение отправлено" });
      } else {
        throw new Error('Failed to send');
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось отправить сообщение" });
    }
  };

  useEffect(() => {
    // Check for notifications
    const checkNotifications = async () => {
      const now = Date.now();
      const { tasks, markNotified, telegramConfig } = useTasks.getState();
      
      if (!telegramConfig.botToken || !telegramConfig.chatId) return;

      const tasksToNotify = tasks.filter(t => 
        t.notify && 
        !t.isNotified && 
        t.dueDate && 
        t.dueDate <= now
      );

      for (const task of tasksToNotify) {
        try {
          await telegramRequest(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramConfig.chatId,
              text: `🔔 Напоминание: ${task.content}`,
            }),
          });
          markNotified(task.id);
          toast({ title: "Уведомление отправлено", description: task.content });
        } catch (e) {
          console.error('Failed to send telegram notification', e);
        }
      }
    };

    const interval = setInterval(checkNotifications, 60000); // Check every minute
    checkNotifications(); // Check immediately on mount
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isZenMode && isAiSidebarOpen) {
      toggleAiSidebar();
    }
  }, [isZenMode]);

  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (isHotkeyMatch(e, hotkeys.newNote || 'Ctrl+Alt+N')) {
        e.preventDefault();
        const currentFile = items.find(i => i.id === activeFileId);
        addFile(currentFile?.parentId || null);
      }

      if (isHotkeyMatch(e, hotkeys.settings || 'Ctrl+,')) {
        e.preventDefault();
        setSettingsOpen(true);
      }

      if (isHotkeyMatch(e, hotkeys.toggleSidebar || 'Ctrl+\\')) {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleGlobalHotkeys);
    return () => document.removeEventListener('keydown', handleGlobalHotkeys);
  }, [hotkeys, addFile, items, activeFileId]);

  useEffect(() => {
    // Initialize local file system for sync
    initLocalFs();
    startPeriodicSync();
    
    // Load secure settings
    const loadSecureSettings = async () => {
      if (isElectron() && electron && electron.loadSecret) {
        try {
          const res = await electron.loadSecret('telegramBotToken');
          if (res.success && res.value) {
            setTelegramConfig({ ...useTasks.getState().telegramConfig, botToken: res.value });
          }
        } catch (e) {
          console.error('Failed to load secure settings:', e);
        }
      }
    };
    loadSecureSettings();

    const loadSettings = async () => {
      try {
        const path = await getStoreValue('storagePath');
        if (path) setStoragePath(path);

        const savedSpaces = await getStoreValue('spaces');
        if (savedSpaces && Array.isArray(savedSpaces)) {
          setSpaces(savedSpaces);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();

    return () => {
      stopPeriodicSync();
    };
  }, []);

  const handleAddSpace = async () => {
    try {
      let result: string | null = null;
      
      if (isElectron()) {
        result = await selectDirectory();
      } else {
        // Web version: simulate a path or use a unique ID
        result = `space-${Date.now()}`;
      }

      if (result) {
        setPendingSpacePath(result);
        // Default name is the folder name
        const folderName = isElectron() 
          ? (result.split(/[/\\]/).pop() || 'Новое пространство')
          : 'Новое пространство';
          
        setSpaceNameInput(folderName);
        setSpaceNameDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAddSpace = async () => {
    if (!pendingSpacePath || !spaceNameInput) return;

    try {
      let finalPath = pendingSpacePath;
      
      // Determine separator
      const sep = pendingSpacePath.includes('\\') ? '\\' : '/';
      const pathParts = pendingSpacePath.split(/[/\\]/);
      const lastFolder = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

      if (isElectron() && electron && electron.fs) {
         if (spaceNameInput !== lastFolder) {
             // Create new folder
             finalPath = pendingSpacePath.endsWith(sep) 
                 ? `${pendingSpacePath}${spaceNameInput}`
                 : `${pendingSpacePath}${sep}${spaceNameInput}`;
         }
      }

      // Add to store first to allow access
      const newSpace = { id: crypto.randomUUID(), name: spaceNameInput, path: finalPath };
      const newSpaces = [...spaces, newSpace];
      
      // Persist spaces first so isPathAllowed checks pass
      await setStoreValue('spaces', newSpaces);
      setSpaces(newSpaces);

      // Create directory if needed
      if (isElectron() && electron && electron.fs && finalPath !== pendingSpacePath) {
          const res = await electron.fs.createDirectory(finalPath);
          if (!res.success) {
              console.error('Failed to create directory:', res.error);
              // Revert spaces change?
              // Maybe not revert, but warn user. 
              // If it fails (e.g. exists?), maybe it's fine if it exists.
              // fs-create-directory uses recursive: true, so it succeeds if exists.
              // If permission error, then we have a problem.
              if (res.error?.includes('Access denied')) {
                   // This shouldn't happen if we updated store correctly and main process re-reads it.
                   // But IPC might be async or main process cache? 
                   // Store set is async.
                   toast({ variant: "destructive", title: "Ошибка", description: "Не удалось создать папку: Доступ запрещен" });
                   // Revert
                   const reverted = spaces;
                   setSpaces(reverted);
                   await setStoreValue('spaces', reverted);
                   return;
              }
          }
      }

      toast({ title: "Пространство добавлено", description: `Пространство "${spaceNameInput}" успешно добавлено` });
      
      // If it's the first space, switch to it
      if (newSpaces.length === 1) { 
        handleSwitchSpace(newSpace);
      }
      
      setSpaceNameDialogOpen(false);
      setPendingSpacePath(null);
      setSpaceNameInput('');
    } catch (err) {
       console.error(err);
       toast({ variant: "destructive", title: "Ошибка", description: "Не удалось сохранить пространство" });
    }
  };

  const handleSwitchSpace = async (space: { id: string, name: string, path: string }) => {
    try {
      setStoragePath(space.path);
      await setStoreValue('storagePath', space.path);
      
      toast({ title: "Пространство переключено", description: `Вы перешли в "${space.name}"` });
      
      // Reload to refresh data
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось переключить пространство" });
    }
  };

  const handleRemoveSpace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const spaceToRemove = spaces.find(s => s.id === id);
    if (spaceToRemove?.path === storagePath) {
        toast({ title: "Ошибка", description: "Нельзя удалить активное пространство", variant: "destructive" });
        return;
    }
    if (!confirm(`Вы уверены, что хотите удалить пространство "${spaceToRemove?.name}" из списка?`)) return;

    const newSpaces = spaces.filter(s => s.id !== id);
    setSpaces(newSpaces);
    await setStoreValue('spaces', newSpaces);
  };

  const filteredItems = searchQuery 
    ? items.filter(i => {
        const query = searchQuery.toLowerCase();
        const nameMatch = i.name.toLowerCase().includes(query);
        const tagsMatch = i.tags?.some(tag => tag.toLowerCase().includes(query));

        if (i.type === 'folder') return nameMatch || tagsMatch;
        const contentMatch = (i.content || '').toLowerCase().includes(query);
        return nameMatch || contentMatch || tagsMatch;
      })
    : [];

  const getBreadcrumbs = (fileId: string | null) => {
    if (!fileId) return [];
    const breadcrumbs = [];
    let currentItem = items.find(i => i.id === fileId);
    while (currentItem) {
      breadcrumbs.unshift(currentItem);
      if (currentItem.parentId) {
        currentItem = items.find(i => i.id === currentItem?.parentId);
      } else {
        currentItem = undefined;
      }
    }
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs(activeFileId);
  const themeClass = theme === 'obsidian-dark' ? '' : `theme-${theme}`;

  const recentFiles = [...items]
    .filter(i => i.type === 'file')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className={cn(
      "h-screen w-full bg-background text-foreground overflow-hidden flex flex-col border border-sidebar-border transition-all duration-500", 
      themeClass,
      isZenMode && "zen-mode"
    )}>
      <style>{`
        .zen-mode #sidebar-panel, 
        .zen-mode .custom-title-bar-left,
        .zen-mode .custom-title-bar-center,
        .zen-mode .tab-bar-container,
        .zen-mode .breadcrumbs-container,
        .zen-mode .status-bar {
          display: none !important;
        }
        .zen-mode .custom-title-bar {
          background: transparent !important;
          border-bottom: none !important;
          position: absolute;
          top: 0;
          right: 0;
          width: auto;
          z-index: 50;
        }
        .zen-mode #main-panel {
          flex: 1 !important;
          max-width: 100% !important;
        }
        .zen-mode .editor-container {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>
      
      <UserProfileDialog open={userProfileOpen} onOpenChange={setUserProfileOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingDialog />

      <Dialog open={spaceNameDialogOpen} onOpenChange={setSpaceNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Название пространства</DialogTitle>
            <DialogDescription>
              Введите название для папки: {pendingSpacePath}
            </DialogDescription>
          </DialogHeader>
          <Input 
            value={spaceNameInput} 
            onChange={(e) => setSpaceNameInput(e.target.value)} 
            placeholder="Мои заметки"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpaceNameDialogOpen(false)}>Отмена</Button>
            <Button onClick={confirmAddSpace}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Title Bar */}
      <div className="h-9 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-3 select-none app-drag-region shrink-0 custom-title-bar">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/70 custom-title-bar-left">
           <Logo className="h-4 w-4 text-foreground" />
           <span className="text-foreground tracking-tight">Godnotes</span>
           
           <div className="h-3 w-px bg-border mx-1" />

           <div className="flex items-center gap-1 no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddSpace} title="Добавить пространство">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 px-0 w-auto gap-1 hover:bg-muted/50">
                     <span className="max-w-[100px] truncate hidden sm:inline-block">{spaces.find(s => s.path === storagePath)?.name || 'GodNotes'}</span>
                     <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {spaces.map(space => (
                    <DropdownMenuItem key={space.id} onClick={() => handleSwitchSpace(space)} className="flex items-center justify-between">
                      <span className="truncate">{space.name}</span>
                      {storagePath === space.path && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                  {spaces.length > 0 && <DropdownMenuSeparator />}
                   <DropdownMenuItem onSelect={() => handleAddSpace()}>
                        <Plus className="mr-2 h-3.5 w-3.5" /> Добавить пространство
                   </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
           </div>

           {breadcrumbs.length > 0 && (
             <div className="flex items-center gap-1 custom-title-bar-center">
               <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
               <div className="flex items-center gap-1 text-[10px]">
                 {breadcrumbs.map((item, index) => (
                   <div key={item.id} className="flex items-center">
                     {index > 0 && <ChevronRight className="h-3 w-3 mx-0.5 opacity-40" />}
                     <span className="truncate max-w-[150px] hover:text-foreground transition-colors cursor-default">
                       {item.name}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>
        
        <div className="flex items-center gap-1 no-drag px-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-7 w-7", isZenMode ? "text-primary bg-primary/10" : "text-muted-foreground")}
              onClick={toggleZenMode}
              title={isZenMode ? "Выйти из Zen-режима" : "Zen-режим (фокус)"}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-7 w-7", isAiSidebarOpen ? "text-primary bg-primary/10" : "text-muted-foreground")}
              onClick={toggleAiSidebar}
              title="AI Ассистент"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar */}
          {isSidebarCollapsed ? (
            <ResizablePanel defaultSize={4} minSize={4} maxSize={4} className="bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-4 shrink-0 transition-all duration-300">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSidebarCollapsed(false)}>
                <Sidebar className="h-4 w-4" />
              </Button>
              <div className="w-8 h-px bg-sidebar-border" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Search className="h-4 w-4" />
              </Button>
            </ResizablePanel>
          ) : (
            <>
              <ResizablePanel id="sidebar-panel" order={1} defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar flex flex-col min-w-[200px] transition-all duration-300">
                {/* Sidebar Header */}
                <div className="p-3 border-b border-sidebar-border bg-sidebar/50 backdrop-blur-sm sticky top-0 z-10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsSidebarCollapsed(true)} title="Свернуть сайдбар">
                        <PanelLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsReadOnly(!isReadOnly)} title={isReadOnly ? "Режим редактирования" : "Режим чтения"}>
                         {isReadOnly ? <PenLine className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </Button>
                      <div className="h-4 w-px bg-border mx-1" />
                      <Link href="/calendar">
                         <Button variant="ghost" size="icon" className={cn("h-7 w-7", location === '/calendar' ? "text-primary bg-primary/10" : "text-muted-foreground")} title="Календарь">
                           <CalendarIcon className="h-4 w-4" />
                         </Button>
                      </Link>
                      <Link href="/todo">
                         <Button variant="ghost" size="icon" className={cn("h-7 w-7", location === '/todo' ? "text-primary bg-primary/10" : "text-muted-foreground")} title="Задачи">
                           <ListTodo className="h-4 w-4" />
                         </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-7 w-7", isGraphOpen ? "text-primary bg-primary/10" : "text-muted-foreground")} 
                        onClick={() => setIsGraphOpen(true)}
                        title="Граф связей"
                      >
                         <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="h-8 px-2 bg-background/50 rounded-md border border-border/50 flex items-center gap-2 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Поиск... (Ctrl+P)" 
                      className="bg-transparent border-none outline-none text-xs w-full h-full placeholder:text-muted-foreground/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                       <button onClick={() => setSearchQuery('')} className="hover:text-foreground">
                          <X className="h-3 w-3" />
                       </button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                  {searchQuery ? (
                    <FileTree items={filteredItems} searchQuery={searchQuery} />
                  ) : (
                    <FileTree />
                  )}
                </div>
                
                {/* Sidebar Footer */}
                <div className="p-3 border-t border-sidebar-border bg-sidebar/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <button className="flex items-center gap-2 hover:bg-white/5 p-1.5 rounded-md text-xs font-medium transition-colors w-full text-left">
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Настройки</span>
                         </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                         <DropdownMenuItem onSelect={(e) => {
                           e.preventDefault();
                           setUserProfileOpen(true);
                         }}>
                            <User className="mr-2 h-3.5 w-3.5" />
                            <span>Профиль</span>
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem onSelect={(e) => {
                           e.preventDefault();
                           setSettingsOpen(true);
                         }}>
                              <Settings className="mr-2 h-3.5 w-3.5" /> Общие настройки
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem className="text-muted-foreground/50 text-[10px]">Версия 1.1.0</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   
                   <div className="flex items-center gap-1">
                      <button 
                        className="p-1.5 hover:bg-white/5 rounded-md text-muted-foreground hover:text-yellow-500 transition-colors" 
                        title="Избранное"
                        onClick={() => setFavoritesOpen(true)}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-red-500/10 rounded-md text-muted-foreground hover:text-red-500 transition-colors" 
                        title="Корзина"
                        onClick={() => setTrashOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                   </div>
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle className="bg-transparent hover:bg-primary/20 w-1 transition-colors" />
          </>
        )}
        
        <ResizablePanel id="main-panel" order={2} defaultSize={isAiSidebarOpen ? 50 : 80} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="tab-bar-container">
              <TabBar />
            </div>
            {breadcrumbs.length > 0 && (
              <div className="flex items-center px-8 py-2 text-xs text-muted-foreground border-b border-sidebar-border/50 shrink-0 breadcrumbs-container">
                {breadcrumbs.map((item, index) => (
                  <div key={item.id} className="flex items-center">
                    {index > 0 && <ChevronRight className="h-3 w-3 mx-1 opacity-40" />}
                    <span
                      className={cn(
                        "transition-colors cursor-pointer",
                        index === breadcrumbs.length - 1
                          ? "text-foreground font-medium cursor-default"
                          : "hover:text-foreground"
                      )}
                      onClick={() => {
                        if (index === breadcrumbs.length - 1) return;
                        
                        if (item.type === 'folder') {
                          if (!expandedFolders.has(item.id)) {
                            toggleFolder(item.id);
                          }
                        } else {
                          selectFile(item.id);
                        }
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-hidden editor-container">
                <ErrorBoundary fallback={<div className="flex items-center justify-center h-full">Ошибка загрузки редактора</div>}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Загрузка редактора...</div>}>
                    <TiptapEditor isReadOnly={isReadOnly} searchTerm={searchHighlight} />
                  </Suspense>
                </ErrorBoundary>
              </div>
          </div>
        </ResizablePanel>

        {isAiSidebarOpen && (
          <>
            <ResizableHandle className="bg-transparent hover:bg-primary/20 w-1 transition-colors" />
            <ResizablePanel id="ai-panel" order={3} defaultSize={30} minSize={20} maxSize={40} className="bg-sidebar border-l border-sidebar-border">
              <AIChatSidebar />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
    
    {/* Windows Status Bar */}
    <div className="h-6 bg-sidebar border-t border-sidebar-border flex items-center justify-between px-3 text-[10px] text-muted-foreground/60 select-none shrink-0 status-bar">
       <div className="flex items-center gap-4">
          <span className="hover:text-foreground cursor-pointer transition-colors">Стр 1, Кол 1</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">{breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1].content?.length || 0) : 0} симв.</span>
       </div>
       <div className="flex items-center gap-4 uppercase tracking-tighter">
         <span className="hover:text-foreground cursor-pointer uppercase">Слова: {breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1].content?.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length || 0) : 0}</span>
         <span className="hover:text-foreground cursor-pointer">UTF-8</span>
       </div>
    </div>
    <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
    <FavoritesDialog open={favoritesOpen} onOpenChange={setFavoritesOpen} />
    <CommandPalette />
    {isGraphOpen && <GraphView onClose={() => setIsGraphOpen(false)} />}
  </div>
  );
}