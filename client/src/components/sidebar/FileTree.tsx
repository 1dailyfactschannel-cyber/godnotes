import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  FilePlus, 
  FolderPlus, 
  Pin, 
  PinOff, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  Star, 
  StarOff, 
  Tag, 
  ArrowUpDown, 
  Check, 
  CloudDownload,
  Lock,
  LockOpen,
  Globe
} from 'lucide-react';
import { useFileSystem, FileSystemItem, SortOrder, compareItems } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { TagsDialog } from '@/components/tags/TagsDialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isElectron } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

function getSortFunction(order: SortOrder) {
  return (a: FileSystemItem, b: FileSystemItem) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.type !== b.type) {
      if (a.type === 'folder') return -1;
      if (b.type === 'folder') return 1;
    }
    
    switch (order) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-newest':
        return b.createdAt - a.createdAt;
      case 'date-oldest':
        return a.createdAt - b.createdAt;
      default:
        return a.name.localeCompare(b.name);
    }
  };
}

// Flatten the tree into a list of visible items
const useVisibleItems = (
  items: FileSystemItem[], 
  expandedFolders: Set<string>, 
  sortOrder: SortOrder, 
  isSearch: boolean
) => {
  return useMemo(() => {
    if (isSearch) {
      return items.map(item => ({ item, level: 0 }));
    }

    const result: { item: FileSystemItem; level: number }[] = [];
    const getChildren = (parentId: string | null) => 
      items.filter(i => i.parentId === parentId).sort(getSortFunction(sortOrder));

    const traverse = (parentId: string | null, level: number) => {
      const children = getChildren(parentId);
      for (const child of children) {
        result.push({ item: child, level });
        if (child.type === 'folder' && expandedFolders.has(child.id)) {
          traverse(child.id, level + 1);
        }
      }
    };

    traverse(null, 0);
    return result;
  }, [items, expandedFolders, sortOrder, isSearch]);
};

export function FileTree({ items: propItems }: { items?: FileSystemItem[] }) {
  const storeItems = useFileSystem(state => state.items);
  const expandedFolders = useFileSystem(state => state.expandedFolders);
  const sortOrder = useFileSystem(state => state.sortOrder);
  const { addFile, addFolder, moveItem, setSortOrder, downloadAllFiles, activeFileId, lastCreatedFileId, lastCreatedFolderId } = useFileSystem();
  const [taggingItemId, setTaggingItemId] = useState<string | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  const items = propItems || storeItems;
  const isSearch = !!propItems;

  const visibleItems = useVisibleItems(items, expandedFolders, sortOrder, isSearch);

  // Auto-scroll to newly created item
  useEffect(() => {
    if (lastCreatedFileId || lastCreatedFolderId) {
      const idToFind = lastCreatedFileId || lastCreatedFolderId;
      const index = visibleItems.findIndex(x => x.item.id === idToFind);
      if (index !== -1 && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index, align: 'center' });
      }
    }
  }, [lastCreatedFileId, lastCreatedFolderId, visibleItems]);

  const handleCreateFile = () => {
    const state = useFileSystem.getState();
    const activeItem = state.items.find(i => i.id === state.activeFileId);
    let parentId = null;
    if (activeItem) {
      parentId = activeItem.type === 'folder' ? activeItem.id : activeItem.parentId;
    }
    addFile(parentId);
  };

  const handleCreateFolder = () => {
    const activeItem = storeItems.find(i => i.id === activeFileId);
    let parentId = null;
    if (activeItem) {
      parentId = activeItem.type === 'folder' ? activeItem.id : activeItem.parentId;
    }
    addFolder(parentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    moveItem(id, null);
  };

  return (
    <div 
      className="h-full flex flex-col select-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="p-2 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground px-2 uppercase tracking-widest">Файлы</span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCreateFile}>
                <FilePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Новая заметка</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCreateFolder}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Новая папка</TooltipContent>
          </Tooltip>

          {isElectron() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => downloadAllFiles()}>
                  <CloudDownload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Скачать все файлы</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Сортировка</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 bg-popover/95 backdrop-blur-sm border-sidebar-border shadow-xl">
              <DropdownMenuItem onClick={() => setSortOrder('name-asc')}>
                По имени (А-Я) {sortOrder === 'name-asc' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('name-desc')}>
                По имени (Я-А) {sortOrder === 'name-desc' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('date-newest')}>
                Сначала новые {sortOrder === 'date-newest' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('date-oldest')}>
                Сначала старые {sortOrder === 'date-oldest' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden px-2 pb-4">
        <Virtuoso
          ref={virtuosoRef}
          data={visibleItems}
          computeItemKey={(index, item) => item.item.id}
          itemContent={(index, { item, level }) => (
            <FileTreeRow 
              item={item} 
              level={level} 
              onOpenTags={() => setTaggingItemId(item.id)}
            />
          )}
        />
      </div>
      
      <TagsDialog 
        itemId={taggingItemId || ''} 
        open={!!taggingItemId} 
        onOpenChange={(open) => !open && setTaggingItemId(null)} 
      />
    </div>
  );
}

const FileTreeRow = memo(({ item, level, onOpenTags }: { item: FileSystemItem, level: number, onOpenTags: () => void }) => {
  const expandedFolders = useFileSystem(state => state.expandedFolders);
  const activeFileId = useFileSystem(state => state.activeFileId);
  const lastCreatedFolderId = useFileSystem(state => state.lastCreatedFolderId);
  const lastCreatedFileId = useFileSystem(state => state.lastCreatedFileId);

  const { 
    toggleFolder, 
    selectFile, 
    deleteItem, 
    addFile, 
    addFolder, 
    renameItem, 
    togglePin, 
    toggleFavorite, 
    moveItem, 
    fetchContent,
    toggleLock,
    togglePublic
  } = useFileSystem.getState();

  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editName when item name changes (e.g. from external update)
  useEffect(() => {
    if (!isEditing) {
      setEditName(item.name);
    }
  }, [item.name, isEditing]);

  // Handle auto-edit for new items
  useEffect(() => {
    const isNewFolder = item.type === 'folder' && item.id === lastCreatedFolderId;
    const isNewFile = item.type === 'file' && item.id === lastCreatedFileId;
    
    if (isNewFolder || isNewFile) {
      setIsEditing(true);
      setEditName(item.name);
      
      // Clear the "last created" flag immediately to prevent re-triggering
      if (isNewFolder) useFileSystem.setState({ lastCreatedFolderId: null });
      if (isNewFile) useFileSystem.setState({ lastCreatedFileId: null });
      
      // We use a small timeout to ensure focus happens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [item.id, item.type, item.name, lastCreatedFolderId, lastCreatedFileId]);

  const isExpanded = expandedFolders.has(item.id);
  const isActive = activeFileId === item.id;
  const isNotLoaded = item.type === 'file' && item.content === undefined;

  const handleManualDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    
    setIsDownloading(true);
    try {
      await fetchContent(item.id);
    } catch (error) {
      console.error("Failed to download file", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRename = () => {
    if (editName.trim()) {
      renameItem(item.id, editName);
    } else {
      setEditName(item.name); // revert if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditName(item.name);
      setIsEditing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (item.type === 'folder') {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (item.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const draggedId = e.dataTransfer.getData('text/plain');
      moveItem(draggedId, item.id);
      if (!isExpanded) toggleFolder(item.id);
    }
  };

  useEffect(() => {
    if (isEditing) {
      if (inputRef.current) {
        inputRef.current.focus();
        // Only select if it's not currently focused (prevent re-selection loops)
        if (document.activeElement !== inputRef.current) {
           inputRef.current.select();
        }
      }
    }
  }, [isEditing]);

  return (
    <div className="py-0.5">
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.type === 'folder' 
                ? 'Эта папка и все файлы внутри нее будут перемещены в корзину.' 
                : 'Этот файл будет перемещен в корзину.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.stopPropagation();
                deleteItem(item.id);
                setIsAlertOpen(false);
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group flex items-center justify-between py-1 px-2 rounded-sm cursor-pointer transition-all text-sm",
            isActive 
              ? "bg-primary/20 text-primary-foreground" 
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            isDragOver && "bg-primary/10 ring-1 ring-primary/30"
          )}
          style={{ paddingLeft: `${level * 12 + (item.type === 'folder' ? 4 : 20)}px` }}
          onClick={(e) => {
            if (item.type === 'folder') {
              toggleFolder(item.id);
              selectFile(item.id);
            } else {
              selectFile(item.id);
            }
          }}
          onContextMenu={(e) => {
            if (!isActive) {
              selectFile(item.id);
            }
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
            {item.type === 'folder' && (
              <span className="text-muted-foreground/50 shrink-0">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </span>
            )}
            <span className="text-muted-foreground shrink-0 flex items-center gap-1">
               {item.type === 'folder' ? (
                 isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-primary/70" /> : <Folder className="h-3.5 w-3.5 text-primary/70" />
               ) : (
                 <File className={cn(
                   "h-3.5 w-3.5 transition-colors", 
                   isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                 )} />
               )}
               {item.isPinned && <Pin className="h-2 w-2 text-primary fill-primary shrink-0" />}
               {item.isFavorite && <Star className="h-2 w-2 text-yellow-500 fill-yellow-500 shrink-0 ml-0.5" />}
               {item.isProtected && <Lock className="h-2 w-2 text-orange-500 shrink-0 ml-0.5" />}
               {item.isPublic && <Globe className="h-2 w-2 text-blue-500 shrink-0 ml-0.5" />}
               {item.tags && item.tags.length > 0 && <Tag className="h-2 w-2 text-blue-400 shrink-0 ml-0.5" />}
               {isNotLoaded && (
                 <div 
                   className="ml-1 cursor-pointer hover:bg-sidebar-accent rounded-sm p-0.5 group/download" 
                   onClick={handleManualDownload}
                   title="Файл не загружен. Нажмите чтобы скачать."
                 >
                   <CloudDownload className={cn(
                     "h-2.5 w-2.5 text-muted-foreground group-hover/download:text-primary transition-colors",
                     isDownloading && "animate-pulse text-primary"
                   )} />
                 </div>
               )}
            </span>
            {isEditing ? (
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                className="bg-sidebar-accent text-sidebar-foreground border-none outline-none h-5 w-full text-sm px-1 rounded focus:ring-1 focus:ring-primary/50"
              />
            ) : (
              <span className={cn(
                "truncate font-medium transition-colors",
                item.type === 'folder' ? "text-muted-foreground group-hover:text-sidebar-foreground" : (isActive ? "text-foreground" : "")
              )}>{item.name}</span>
            )}
          </div>

          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className={cn(
                  "p-0.5 rounded transition-all", 
                  isActive 
                    ? "text-primary hover:bg-primary/20 opacity-100" 
                    : "text-muted-foreground hover:bg-sidebar-accent opacity-0 group-hover:opacity-100"
                )}>
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover/95 backdrop-blur-sm border-sidebar-border shadow-xl">
                {item.type === 'folder' && (
                  <>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        addFile(item.id);
                      }}
                    >
                      <FilePlus className="mr-2 h-4 w-4" /> Новый файл
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        addFolder(item.id);
                      }}
                    >
                      <FolderPlus className="mr-2 h-4 w-4" /> Новая папка
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => togglePin(item.id)}>
                    {item.isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                    {item.isPinned ? 'Открепить' : 'Закрепить'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleFavorite(item.id)}>
                    {item.isFavorite ? <StarOff className="mr-2 h-4 w-4" /> : <Star className="mr-2 h-4 w-4" />}
                    {item.isFavorite ? 'Убрать из избранного' : 'В избранное'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleLock(item.id)}>
                    {item.isProtected ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {item.isProtected ? 'Снять защиту' : 'Защитить'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenTags}>
                  <Tag className="mr-2 h-4 w-4" /> Теги
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="mr-2 h-4 w-4" /> Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => {
                  e.stopPropagation();
                  setIsAlertOpen(true);
                }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 bg-popover/95 backdrop-blur-sm border-sidebar-border shadow-xl">
        {item.type === 'folder' && (
          <>
            <ContextMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                addFile(item.id);
              }}
            >
              <FilePlus className="mr-2 h-4 w-4" /> Новый файл
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                addFolder(item.id);
              }}
            >
              <FolderPlus className="mr-2 h-4 w-4" /> Новая папка
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={() => togglePin(item.id)}>
            {item.isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
            {item.isPinned ? 'Открепить' : 'Закрепить'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => toggleFavorite(item.id)}>
            {item.isFavorite ? <StarOff className="mr-2 h-4 w-4" /> : <Star className="mr-2 h-4 w-4" />}
            {item.isFavorite ? 'Убрать из избранного' : 'В избранное'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => toggleLock(item.id)}>
            {item.isProtected ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {item.isProtected ? 'Снять защиту' : 'Защитить'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleTogglePublic}>
            <Globe className="mr-2 h-4 w-4" />
            {item.isPublic ? 'Закрыть доступ' : 'Открыть доступ'}
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenTags}>
            <Tag className="mr-2 h-4 w-4" /> Теги
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" /> Переименовать
        </ContextMenuItem>
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => setIsAlertOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Удалить
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    </div>
  );
});
