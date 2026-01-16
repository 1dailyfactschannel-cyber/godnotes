import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { FileTree } from '@/components/sidebar/FileTree';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Search, Hash, ChevronRight, Minimize2, Square, X, Settings, Check, Clock, Star, Trash2, Sidebar, BookOpen, PenLine } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useState } from 'react';
import { useLocation } from "wouter";

export default function AppLayout() {
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId, theme, setTheme, toggleFolder, expandedFolders } = useFileSystem();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [, setLocation] = useLocation();
  const [searchHighlight, setSearchHighlight] = useState('');

  const filteredItems = searchQuery 
    ? items.filter(i => {
        if (i.type !== 'file') return false;
        const query = searchQuery.toLowerCase();
        const nameMatch = i.name.toLowerCase().includes(query);
        const contentMatch = (i.content || '').toLowerCase().includes(query);
        return nameMatch || contentMatch;
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
      {/* Windows Title Bar */}
      <div className="h-8 bg-sidebar flex items-center justify-between select-none shrink-0 drag-region">
        <div className="flex items-center h-full">
           <div className="px-3 flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
                 <div className="w-2 h-2 bg-primary-foreground rotate-45" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">Obsidian</span>
           </div>
           
           <div className="flex items-center text-[11px] text-muted-foreground/60 ml-2 border-l border-white/5 pl-4">
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-white/5 rounded transition-colors mr-2 no-drag"
                title={isSidebarCollapsed ? "Развернуть панель" : "Свернуть панель"}
              >
                <Sidebar className="h-3 w-3" />
              </button>
              <span className="hover:text-foreground transition-colors cursor-pointer no-drag">Хранилище</span>
              {breadcrumbs.map((item, index) => (
                 <div key={item.id} className="flex items-center">
                    <ChevronRight className="h-3 w-3 mx-1 opacity-40" />
                    <span
                      className={
                        index === breadcrumbs.length - 1
                          ? "text-muted-foreground no-drag"
                          : "hover:text-foreground transition-colors cursor-pointer no-drag"
                      }
                      onClick={() => {
                        if (index === breadcrumbs.length - 1) {
                          if (item.type === 'file') {
                            selectFile(item.id);
                          }
                          return;
                        }
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
        </div>
        
        {/* Windows Control Buttons */}
        <div className="flex h-full no-drag">
           <button 
             onClick={() => setIsReadOnly(!isReadOnly)}
             className={cn(
               "h-full px-3 flex items-center justify-center transition-colors group",
               isReadOnly ? "bg-primary/20 text-primary" : "hover:bg-white/10"
             )}
             title={isReadOnly ? "Режим редактирования" : "Режим чтения"}
           >
             {isReadOnly ? <BookOpen className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />}
           </button>
           <button className="h-full px-4 hover:bg-white/10 transition-colors flex items-center justify-center group">
              <Minimize2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
           </button>
           <button className="h-full px-4 hover:bg-white/10 transition-colors flex items-center justify-center group">
              <Square className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
           </button>
           <button className="h-full px-4 hover:bg-red-500 transition-colors flex items-center justify-center group">
              <X className="h-4 w-4 text-muted-foreground group-hover:text-white" />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {!isSidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar border-r border-sidebar-border/50 animate-in slide-in-from-left duration-300">
                <div className="h-full flex flex-col">
                  <div className="p-2">
                    <div className="relative group">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Поиск..." 
                        className="w-full bg-accent/30 border border-transparent focus:border-primary/30 rounded py-1 pl-8 pr-3 text-xs focus:outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {searchQuery && (
                      <div className="p-2">
                        <div className="text-[10px] font-bold text-muted-foreground px-2 mb-2 uppercase tracking-widest">Результаты поиска</div>
                        {filteredItems.length === 0 ? (
                          <div className="text-xs text-muted-foreground/50 px-2 py-4 text-center italic">Ничего не найдено</div>
                        ) : (
                          filteredItems.map(item => (
                            <div 
                              key={item.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer text-xs group"
                              onClick={() => {
                                setSearchHighlight(searchQuery);
                                selectFile(item.id);
                                setSearchQuery('');
                              }}
                            >
                              <Hash className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                              <span className="truncate">{item.name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    <FileTree />
                  </div>

                  <div className="mt-auto p-2 border-t border-sidebar-border flex items-center justify-between">
                     <DropdownMenu>
                       <Dialog>
                         <DropdownMenuTrigger asChild>
                           <button className="p-1.5 hover:bg-accent/50 rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Настройки">
                             <Settings className="h-4 w-4" />
                           </button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent side="right" align="end" className="w-56 bg-popover/95 backdrop-blur-sm">
                           <DropdownMenuItem onClick={() => setLocation('/profile')}>
                             Профиль
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DialogTrigger asChild>
                             <DropdownMenuItem>
                               Общие настройки
                             </DropdownMenuItem>
                           </DialogTrigger>
                           <DropdownMenuSeparator />
                           <DropdownMenuSub>
                             <DropdownMenuSubTrigger>
                               Выбор темы
                             </DropdownMenuSubTrigger>
                             <DropdownMenuPortal>
                               <DropdownMenuSubContent className="bg-popover/95 backdrop-blur-sm">
                                 <ThemeMenuItem 
                                   label="Тёмная (Obsidian)" 
                                   active={theme === 'obsidian-dark'} 
                                   onClick={() => setTheme('obsidian-dark')} 
                                 />
                                 <ThemeMenuItem 
                                   label="Полночная синяя" 
                                   active={theme === 'midnight-blue'} 
                                   onClick={() => setTheme('midnight-blue')} 
                                 />
                                 <ThemeMenuItem 
                                   label="Графитовая" 
                                   active={theme === 'graphite'} 
                                   onClick={() => setTheme('graphite')} 
                                 />
                                 <ThemeMenuItem 
                                   label="Светлая тема" 
                                   active={theme === 'light-mode'} 
                                   onClick={() => setTheme('light-mode')} 
                                 />
                               </DropdownMenuSubContent>
                             </DropdownMenuPortal>
                           </DropdownMenuSub>
                           <DropdownMenuItem>Плагины</DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem className="text-muted-foreground/50 text-[10px]">Версия 1.0.0</DropdownMenuItem>
                         </DropdownMenuContent>
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
                           </div>
                         </DialogContent>
                       </Dialog>
                     </DropdownMenu>
                     
                     <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-white/5 rounded-md text-muted-foreground hover:text-primary transition-colors" title="Помощь">
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-red-500/10 rounded-md text-muted-foreground hover:text-red-500 transition-colors" title="Корзина">
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
            <TiptapEditor isReadOnly={isReadOnly} searchTerm={searchHighlight} />
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
