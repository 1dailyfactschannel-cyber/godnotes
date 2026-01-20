import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { File, Folder, StarOff } from 'lucide-react';
import { useFileSystem, FileSystemItem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';

interface FavoritesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FavoritesDialog({ open, onOpenChange }: FavoritesDialogProps) {
  const { items, selectFile, toggleFolder, toggleFavorite } = useFileSystem();
  
  const favorites = items.filter(i => i.isFavorite);
  const folders = favorites.filter(i => i.type === 'folder');
  const files = favorites.filter(i => i.type === 'file');

  const handleItemClick = (item: FileSystemItem) => {
    if (item.type === 'folder') {
        toggleFolder(item.id); 
    } else {
        selectFile(item.id);
    }
    onOpenChange(false);
  };

  const FavoriteItem = ({ item }: { item: FileSystemItem }) => (
    <div 
        className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 group cursor-pointer border border-transparent hover:border-border/50 transition-all"
        onClick={() => handleItemClick(item)}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={cn("p-2 rounded-md", item.type === 'folder' ? "bg-primary/10" : "bg-secondary")}>
          {item.type === 'folder' ? (
            <Folder className="h-4 w-4 text-primary" />
          ) : (
            <File className="h-4 w-4 text-secondary-foreground" />
          )}
        </div>
        <span className="font-medium text-sm truncate">{item.name}</span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
        }}
        title="Убрать из избранного"
      >
        <StarOff className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Избранное</DialogTitle>
          <DialogDescription>
            Быстрый доступ к важным файлам и папкам
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mr-4 pr-4">
            <div className="space-y-4 py-4">
                {favorites.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-4">
                            <StarOff className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p>Список избранного пуст</p>
                        <p className="text-xs mt-1 opacity-70">Добавляйте важные файлы и папки для быстрого доступа</p>
                    </div>
                )}

                {folders.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Папки</h4>
                        <div className="grid gap-1">
                            {folders.map(item => <FavoriteItem key={item.id} item={item} />)}
                        </div>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Файлы</h4>
                        <div className="grid gap-1">
                            {files.map(item => <FavoriteItem key={item.id} item={item} />)}
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
