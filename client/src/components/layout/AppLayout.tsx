import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { selectDirectory, getStoreValue, setStoreValue } from '@/lib/electron';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { TrashDialog } from '@/components/trash/TrashDialog';
import { Logo } from '@/components/Logo';
import { TabBar } from '@/components/layout/TabBar';

import { CommandPalette } from '@/components/CommandPalette';
import { FileTree } from '@/components/sidebar/FileTree';
import { FavoritesDialog } from '@/components/favorites/FavoritesDialog';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Search, Hash, ChevronRight, Minimize2, Square, X, Settings, Check, Clock, Star, Trash2, Sidebar, BookOpen, PenLine, FolderOpen, Plus, CheckCircle2, User, ChevronsUpDown, PanelLeft } from 'lucide-react';
import { useFileSystem, ThemeType } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
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
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId, theme, setTheme, toggleFolder, expandedFolders, hotkeys, setHotkey, initLocalFs, startPeriodicSync, stopPeriodicSync } = useFileSystem();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [, setLocation] = useLocation();
  const [searchHighlight, setSearchHighlight] = useState('');
  const [storagePath, setStoragePath] = useState<string>('');
  const [spaces, setSpaces] = useState<{ id: string; name: string; path: string }[]>([]);
  const { toast } = useToast();
  const [trashOpen, setTrashOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const [spaceNameDialogOpen, setSpaceNameDialogOpen] = useState(false);
  const [pendingSpacePath, setPendingSpacePath] = useState<string | null>(null);
  const [spaceNameInput, setSpaceNameInput] = useState('');

  useEffect(() => {
    // Initialize local file system for sync
    initLocalFs();
    startPeriodicSync();
    
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
      const result = await selectDirectory();
      if (result) {
        setPendingSpacePath(result);
        // Default name is the folder name
        const folderName = result.split(/[/\\]/).pop() || 'Новое пространство';
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
      const newSpace = { id: crypto.randomUUID(), name: spaceNameInput, path: pendingSpacePath };
      const newSpaces = [...spaces, newSpace];
      setSpaces(newSpaces);
      await setStoreValue('spaces', newSpaces);

      toast({ title: "Пространство добавлено", description: `Пространство "${spaceNameInput}" успешно добавлено` });
      
      // If it's the first space, switch to it
      if (spaces.length === 1) { // 1 because we just added it to array but spaces state might be stale in this closure? No, using newSpaces
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
    <div className={cn("h-screen w-full bg-background text-foreground overflow-hidden flex flex-col border border-sidebar-border transition-all duration-500", themeClass)}>
      
      <UserProfileDialog open={userProfileOpen} onOpenChange={setUserProfileOpen} />

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
      <div className="h-9 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-3 select-none app-drag-region shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/70">
           <Logo className="h-4 w-4 text-foreground" />
           <span className="text-foreground tracking-tight">Godnotes</span>
           
           <div className="h-3 w-px bg-border mx-1" />

           <div className="flex items-center gap-1 no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
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
             <>
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
             </>
           )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar */}
          {isSidebarCollapsed ? (
            <div className="w-12 h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-4 shrink-0 transition-all duration-300">
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
            </div>
          ) : (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar flex flex-col min-w-[200px] transition-all duration-300">
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
                    <FileTree items={filteredItems} />
                  ) : (
                    <FileTree />
                  )}
                </div>
                
                {/* Sidebar Footer */}
                <div className="p-3 border-t border-sidebar-border bg-sidebar/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Dialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <button className="flex items-center gap-2 hover:bg-white/5 p-1.5 rounded-md text-xs font-medium transition-colors w-full text-left">
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Настройки</span>
                         </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                         <DropdownMenuItem onSelect={() => setUserProfileOpen(true)}>
                            <User className="mr-2 h-3.5 w-3.5" />
                            <span>Профиль</span>
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuSub>
                           <DropdownMenuSubTrigger>
                             <Check className="mr-2 h-3.5 w-3.5" /> Тема оформления
                           </DropdownMenuSubTrigger>
                           <DropdownMenuPortal>
                             <DropdownMenuSubContent>
                               <ThemeMenuItem label="Obsidian Dark" active={theme === 'obsidian-dark'} onClick={() => setTheme('obsidian-dark')} />
                               <ThemeMenuItem label="Midnight Blue" active={theme === 'midnight-blue'} onClick={() => setTheme('midnight-blue')} />
                               <ThemeMenuItem label="Graphite" active={theme === 'graphite'} onClick={() => setTheme('graphite')} />
                               <ThemeMenuItem label="Light Mode" active={theme === 'light-mode'} onClick={() => setTheme('light-mode')} />
                             </DropdownMenuSubContent>
                           </DropdownMenuPortal>
                         </DropdownMenuSub>
                         <DropdownMenuItem>Плагины</DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem className="text-muted-foreground/50 text-[10px]">Версия 1.0.0</DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Settings className="mr-2 h-3.5 w-3.5" /> Общие настройки
                            </DropdownMenuItem>
                         </DialogTrigger>
                       </DropdownMenuContent>
                     </DropdownMenu>
                       <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Общие настройки</DialogTitle>
                          <DialogDescription>
                            Настройте приложение под себя.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span>Автофокус на последней заметке</span>
                            <Switch disabled />
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Открывать последнее состояние дерева папок</span>
                            <Switch disabled />
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Размер шрифта редактора по умолчанию</span>
                            <span className="text-xs text-muted-foreground">Настраивается в панели редактора</span>
                          </div>

                          <div className="pt-3 border-t border-border/40">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-semibold">Пространства</div>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddSpace} title="Добавить пространство">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {spaces.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic">Нет добавленных пространств</div>
                              ) : (
                                spaces.map(space => (
                                  <div key={space.id} className={cn(
                                    "flex items-center justify-between p-2 rounded-md border text-xs transition-colors",
                                    storagePath === space.path ? "bg-primary/10 border-primary/20" : "bg-background/50 border-border/50 hover:bg-accent/50"
                                  )}>
                                    <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer" onClick={() => handleSwitchSpace(space)}>
                                      {storagePath === space.path ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                      ) : (
                                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      )}
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="font-medium truncate">{space.name}</span>
                                        <span className="text-[10px] text-muted-foreground truncate opacity-70" title={space.path}>{space.path}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      {storagePath !== space.path && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive" 
                                          onClick={(e) => handleRemoveSpace(space.id, e)}
                                          title="Удалить пространство"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                            <div className="pt-3 border-t border-border/40">
                              <div className="text-xs font-semibold mb-2">Настройка горячих клавиш</div>
                              <div className="space-y-2 text-xs text-muted-foreground">
                                <HotkeySetting 
                                  label="Командная панель" 
                                  value={hotkeys.commandPalette || 'Ctrl+K'} 
                                  onChange={(v) => setHotkey('commandPalette', v)} 
                                />
                                <HotkeySetting 
                                  label="Жирный (Bold)" 
                                  value={hotkeys.bold || 'Ctrl+B'} 
                                  onChange={(v) => setHotkey('bold', v)} 
                                />
                                <HotkeySetting 
                                  label="Курсив (Italic)" 
                                  value={hotkeys.italic || 'Ctrl+I'} 
                                  onChange={(v) => setHotkey('italic', v)} 
                                />
                                <HotkeySetting 
                                  label="Вставить ссылку" 
                                  value={hotkeys.link || 'Ctrl+K'} 
                                  onChange={(v) => setHotkey('link', v)} 
                                />
                                <HotkeySetting 
                                  label="Список задач" 
                                  value={hotkeys.taskList || 'Ctrl+Shift+9'} 
                                  onChange={(v) => setHotkey('taskList', v)} 
                                />
                              </div>
                            </div>
                        </div>
                       </DialogContent>
                     </Dialog>
                   
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
        
        <ResizablePanel defaultSize={80}>
          <div className="flex flex-col h-full">
            <TabBar />
            {breadcrumbs.length > 0 && (
              <div className="flex items-center px-8 py-2 text-xs text-muted-foreground border-b border-sidebar-border/50 shrink-0">
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
            <div className="flex-1 overflow-hidden">
              <TiptapEditor isReadOnly={isReadOnly} searchTerm={searchHighlight} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    
    {/* Windows Status Bar */}
    <div className="h-6 bg-sidebar border-t border-sidebar-border flex items-center justify-between px-3 text-[10px] text-muted-foreground/60 select-none shrink-0">
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
  </div>
  );
}

function ThemeMenuItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <DropdownMenuItem onClick={onClick} className="flex items-center justify-between">
      {label}
      {active && <Check className="h-3 w-3 text-primary" />}
    </DropdownMenuItem>
  );
}

function HotkeySetting({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      let key = '';
      if (e.code.startsWith('Key')) {
        key = e.code.replace('Key', '');
      } else if (e.code.startsWith('Digit')) {
        key = e.code.replace('Digit', '');
      } else {
        key = e.key.toUpperCase();
      }
      
      if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;

      const shortcut = [...modifiers, key].join('+');
      onChange(shortcut);
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecording, onChange]);

  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <button 
        className={cn(
            "px-2 py-1 rounded text-xs border min-w-[60px] text-center transition-colors",
            isRecording ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/80"
        )}
        onClick={() => setIsRecording(true)}
      >
        {isRecording ? "Нажмите..." : value}
      </button>
    </div>
  );
}