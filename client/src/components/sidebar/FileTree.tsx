import { useState } from 'react';
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
  GripVertical
} from 'lucide-react';
import { useFileSystem, FileSystemItem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

export function FileTree() {
  const { items, addFile, addFolder, moveItem } = useFileSystem();
  
  // Get root items, sorted by pinned first
  const rootItems = items
    .filter(i => i.parentId === null)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });

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
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => addFile(null)} title="Новая заметка">
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => addFolder(null)} title="Новая папка">
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rootItems.map(item => (
          <FileTreeItem key={item.id} item={item} level={0} />
        ))}
      </div>
    </div>
  );
}

function FileTreeItem({ item, level }: { item: FileSystemItem, level: number }) {
  const { items, expandedFolders, toggleFolder, activeFileId, selectFile, deleteItem, addFile, addFolder, renameItem, togglePin, moveItem } = useFileSystem();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const isExpanded = expandedFolders.has(item.id);
  const isActive = activeFileId === item.id;
  
  // Children sorted by pinned first
  const children = items
    .filter(i => i.parentId === item.id)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });
  
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
      setIsDragOver(false);
      const draggedId = e.dataTransfer.getData('text/plain');
      moveItem(draggedId, item.id);
      if (!isExpanded) toggleFolder(item.id);
    }
  };

  const itemContent = (
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
      onClick={() => item.type === 'folder' ? toggleFolder(item.id) : selectFile(item.id)}
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
        </span>
        {isEditing ? (
          <input
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
                <DropdownMenuItem onClick={() => addFile(item.id)}>
                  <FilePlus className="mr-2 h-4 w-4" /> Новый файл
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addFolder(item.id)}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Новая папка
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => togglePin(item.id)}>
                {item.isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                {item.isPinned ? 'Открепить' : 'Закрепить'}
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
  );

  return (
    <div>
      {itemContent}
      {item.type === 'folder' && isExpanded && (
        <div>
          {children.map(child => (
            <FileTreeItem key={child.id} item={child} level={level + 1} />
          ))}
          {children.length === 0 && (
            <div 
              className="text-[10px] text-muted-foreground/50 py-0.5 italic"
              style={{ paddingLeft: `${(level + 1) * 12 + 22}px` }}
            >
              Пусто
            </div>
          )}
        </div>
      )}
    </div>
  );
}
