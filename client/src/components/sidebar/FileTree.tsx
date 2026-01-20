import { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Edit2,
  FilePlus,
  FolderPlus,
  Pin,
  PinOff,
  GripVertical,
  Star,
  StarOff,
  Tag,
  ArrowUpDown,
  Check,
  CloudDownload
} from 'lucide-react';
import { useFileSystem, FileSystemItem, SortOrder } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { TagsDialog } from '@/components/tags/TagsDialog';
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
import { Button } from '@/components/ui/button';

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

export function FileTree({ items: propItems }: { items?: FileSystemItem[] }) {
  // Select items directly from the store to ensure reactivity if propItems is not provided
  const storeItems = useFileSystem(state => state.items);
  const { addFile, addFolder, moveItem, sortOrder, setSortOrder, downloadAllFiles, activeFileId } = useFileSystem();
  
  const items = propItems || storeItems;
  const isSearch = !!propItems;

  // Log items length on every render to verify if store update reached the component
  // console.log(`[FileTree] Render. Items count: ${items.length}. IsSearch: ${isSearch}`);

  const rootItems = items
    .filter(i => !i.parentId)
    .sort(getSortFunction(sortOrder));

  const handleCreateFile = () => {
    const state = useFileSystem.getState();
    const activeItem = state.items.find(i => i.id === state.activeFileId);
    
    let parentId = null;

    if (activeItem) {
      if (activeItem.type === 'folder') {
        parentId = activeItem.id;
      } else {
        parentId = activeItem.parentId;
      }
    }
    
    addFile(parentId);
  };

  const handleCreateFolder = () => {
    const activeItem = storeItems.find(i => i.id === activeFileId);
    let parentId = null;
    if (activeItem) {
      if (activeItem.type === 'folder') {
        parentId = activeItem.id;
      } else {
        parentId = activeItem.parentId;
      }
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
      <div className="p-2 flex items-center justify-between group">
        <span className="text-[10px] font-bold text-muted-foreground px-2 uppercase tracking-widest">Файлы</span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCreateFile} title="Новая заметка">
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCreateFolder} title="Новая папка">
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => downloadAllFiles()} title="Скачать все файлы">
            <CloudDownload className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Сортировка">
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
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
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rootItems.map(item => (
          <FileTreeItem key={item.id} item={item} level={0} isSearch={isSearch} />
        ))}
      </div>
    </div>
  );
}

function FileTreeItem({ item, level, isSearch }: { item: FileSystemItem, level: number, isSearch: boolean }) {
  const { items: allItems } = useFileSystem(); // ALWAYS use full store items for children lookup
  const { expandedFolders, toggleFolder, activeFileId, selectFile, deleteItem, addFile, addFolder, renameItem, togglePin, toggleFavorite, moveItem, lastCreatedFolderId, lastCreatedFileId, sortOrder, fetchContent } = useFileSystem();
  const [isEditing, setIsEditing] = useState(
    (item.type === 'folder' && item.id === lastCreatedFolderId) || 
    (item.type === 'file' && item.id === lastCreatedFileId)
  );
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  
  const children = isSearch ? [] : allItems
    .filter(i => {
       return i.parentId === item.id;
    })
    .sort(getSortFunction(sortOrder));

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
    // Add a visual preview if needed, but default is fine
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
        inputRef.current.select();
      }
      if (item.type === 'folder' && item.id === lastCreatedFolderId) {
        useFileSystem.setState({ lastCreatedFolderId: null });
      }
      if (item.type === 'file' && item.id === lastCreatedFileId) {
        useFileSystem.setState({ lastCreatedFileId: null });
      }
    }
  }, [item.id, item.type, lastCreatedFolderId, lastCreatedFileId, isEditing]);

  const itemContent = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group flex items-center justify-between py-1 px-2 rounded-sm cursor-pointer transition-all text-sm mb-0.5",
            isActive 
              ? "bg-primary/20 text-primary-foreground" 
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            isDragOver && "bg-primary/10 ring-1 ring-primary/30"
          )}
          style={{ paddingLeft: `${level * 12 + (item.type === 'folder' ? 4 : 20)}px` }}
          onClick={(e) => {
            // Only toggle/select if clicking the item content, not if clicking children container (which shouldn't bubble here anyway)
            if (item.type === 'folder') {
              toggleFolder(item.id);
              selectFile(item.id);
            } else {
              selectFile(item.id);
            }
          }}
          onContextMenu={(e) => {
            // Prevent default context menu and select the file if it's not selected
            // e.preventDefault(); // handled by ContextMenuTrigger
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
                <DropdownMenuItem onClick={() => setIsTagsOpen(true)}>
                  <Tag className="mr-2 h-4 w-4" /> Теги
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="mr-2 h-4 w-4" /> Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteItem(item.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {item.type === 'folder' && (
          <>
            <ContextMenuItem onClick={(e) => {
            e.stopPropagation();
            addFile(item.id);
          }}>
            <FilePlus className="mr-2 h-4 w-4" /> Новый файл
          </ContextMenuItem>
          <ContextMenuItem onClick={(e) => {
            e.stopPropagation();
            addFolder(item.id);
          }}>
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
        <ContextMenuItem onClick={() => setIsTagsOpen(true)}>
            <Tag className="mr-2 h-4 w-4" /> Теги
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" /> Переименовать
        </ContextMenuItem>
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteItem(item.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Удалить
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  return (
    <div>
      {itemContent}
      <TagsDialog itemId={item.id} open={isTagsOpen} onOpenChange={setIsTagsOpen} />
      {item.type === 'folder' && isExpanded && (
        <div>
          {children.map(child => (
            <FileTreeItem key={child.id} item={child} level={level + 1} isSearch={isSearch} />
          ))}
        </div>
      )}
    </div>
  );
}
