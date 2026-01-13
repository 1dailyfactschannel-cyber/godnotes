import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { FileTree } from '@/components/sidebar/FileTree';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Search, Hash, ChevronRight, Minimize2, Square, X, Settings, Check } from 'lucide-react';
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

export default function AppLayout() {
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId, theme, setTheme } = useFileSystem();

  const filteredItems = searchQuery 
    ? items.filter(i => i.type === 'file' && i.name.toLowerCase().includes(searchQuery.toLowerCase()))
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

  return (
    <div className={cn("h-screen w-full bg-background text-foreground overflow-hidden flex flex-col border border-sidebar-border", themeClass)}>
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
              <span className="hover:text-foreground transition-colors cursor-pointer">Хранилище</span>
              {breadcrumbs.map((item, index) => (
                 <div key={item.id} className="flex items-center">
                    <ChevronRight className="h-3 w-3 mx-1 opacity-40" />
                    <span className={index === breadcrumbs.length - 1 ? "text-muted-foreground" : "hover:text-foreground transition-colors cursor-pointer"}>
                       {item.name}
                    </span>
                 </div>
              ))}
           </div>
        </div>
        
        {/* Windows Control Buttons */}
        <div className="flex h-full no-drag">
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
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar border-r border-sidebar-border/50">
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

              {searchQuery ? (
                 <div className="flex-1 overflow-y-auto p-2">
                    <div className="text-[10px] font-bold text-muted-foreground px-2 mb-2 uppercase tracking-widest">Результаты поиска</div>
                    {filteredItems.length === 0 ? (
                      <div className="text-xs text-muted-foreground/50 px-2 py-4 text-center italic">Ничего не найдено</div>
                    ) : (
                      filteredItems.map(item => (
                        <div 
                          key={item.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer text-xs group"
                          onClick={() => {
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
              ) : (
                <FileTree />
              )}

              {/* Sidebar Bottom Actions */}
              <div className="mt-auto p-2 border-t border-sidebar-border flex items-center">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <button className="p-1.5 hover:bg-accent/50 rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Настройки">
                          <Settings className="h-4 w-4" />
                       </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" className="w-56 bg-popover/95 backdrop-blur-sm">
                       <DropdownMenuItem>
                          Общие настройки
                       </DropdownMenuItem>
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
                 </DropdownMenu>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="bg-transparent hover:bg-primary/20 w-1 transition-colors" />
          
          <ResizablePanel defaultSize={80}>
            <TiptapEditor />
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
           <span className="hover:text-foreground cursor-pointer">Пробелы: 2</span>
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
