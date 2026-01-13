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
  PinOff
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
  const { items, expandedFolders, toggleFolder, activeFileId, selectFile, addFile, addFolder } = useFileSystem();
  
  // Get root items, sorted by pinned first
  const rootItems = items
    .filter(i => i.parentId === null)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="h-full flex flex-col select-none">
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
  const { items, expandedFolders, toggleFolder, activeFileId, selectFile, deleteItem, addFile, addFolder, renameItem, togglePin } = useFileSystem();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

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

  if (item.type === 'folder') {
    return (
      <div>
        <div 
          className={cn(
            "group flex items-center justify-between py-1 px-2 rounded-sm hover:bg-sidebar-accent/50 cursor-pointer transition-colors text-sm mb-0.5",
          )}
          style={{ paddingLeft: `${level * 12 + 4}px` }}
          onClick={(e) => {
            e.stopPropagation();
            toggleFolder(item.id);
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
            <span className="text-muted-foreground/50 shrink-0">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
            <span className="text-muted-foreground shrink-0 flex items-center gap-1">
               {isExpanded ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
               {item.isPinned && <Pin className="h-2 w-2 text-primary fill-primary" />}
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
              <span className="truncate font-medium text-muted-foreground group-hover:text-sidebar-foreground transition-colors">{item.name}</span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sidebar-accent rounded text-muted-foreground hover:text-foreground transition-all">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover/95 backdrop-blur-sm border-sidebar-border shadow-xl">
              <DropdownMenuItem onClick={() => addFile(item.id)}>
                <FilePlus className="mr-2 h-4 w-4" /> Новый файл
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addFolder(item.id)}>
                <FolderPlus className="mr-2 h-4 w-4" /> Новая папка
              </DropdownMenuItem>
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
        
        {isExpanded && (
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

  return (
    <div 
      className={cn(
        "group flex items-center justify-between py-1 px-2 rounded-sm cursor-pointer transition-all text-sm mb-0.5",
        isActive 
          ? "bg-primary/20 text-primary-foreground" 
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      style={{ paddingLeft: `${level * 12 + 20}px` }}
      onClick={() => selectFile(item.id)}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <File className={cn(
            "h-3.5 w-3.5 transition-colors", 
            isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
          )} />
          {item.isPinned && <Pin className="h-2 w-2 text-primary fill-primary" />}
        </div>
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
            isActive ? "text-foreground" : ""
          )}>{item.name}</span>
        )}
      </div>

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
  );
}
