import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileIcon, FolderIcon, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useFileSystem, FileSystemItem } from '@/lib/mock-fs';
import { useEffect, useState } from 'react';

interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashDialog({ open, onOpenChange }: TrashDialogProps) {
  const { trashItems, fetchTrash, restoreItem, permanentDeleteItem } = useFileSystem();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetchTrash().finally(() => setIsLoading(false));
    }
  }, [open, fetchTrash]);

  const handleRestore = async (id: string) => {
    await restoreItem(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить безвозвратно?')) {
      await permanentDeleteItem(id);
    }
  };

  const folders = trashItems.filter(i => i.type === 'folder');
  const notes = trashItems.filter(i => i.type === 'file');

  const getDeletedDate = (item: FileSystemItem) => {
     const deletedTag = item.tags?.find(t => t.startsWith('deleted:'));
     if (deletedTag) {
         const ts = parseInt(deletedTag.split(':')[1]);
         if (!isNaN(ts)) return new Date(ts);
     }
     return new Date(); 
  };

  const FolderItem = ({ folder }: { folder: FileSystemItem }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <FolderIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{folder.name}</span>
          <span className="text-xs text-muted-foreground">
            Удалено: {format(getDeletedDate(folder), 'dd MMM yyyy, HH:mm', { locale: ru })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={() => handleRestore(folder.id)}
          title="Восстановить"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10" 
          onClick={() => handleDelete(folder.id)}
          title="Удалить навсегда"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const NoteItem = ({ note }: { note: FileSystemItem }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-secondary rounded-full">
          <FileIcon className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{note.name}</span>
          <span className="text-xs text-muted-foreground">
            Удалено: {format(getDeletedDate(note), 'dd MMM yyyy, HH:mm', { locale: ru })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={() => handleRestore(note.id)}
          title="Восстановить"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10" 
          onClick={() => handleDelete(note.id)}
          title="Удалить навсегда"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Корзина</DialogTitle>
          <DialogDescription>
            Управление удаленными файлами и папками
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="all">Все ({folders.length + notes.length})</TabsTrigger>
              <TabsTrigger value="folders">Папки ({folders.length})</TabsTrigger>
              <TabsTrigger value="notes">Заметки ({notes.length})</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden mt-4 border rounded-md bg-accent/10">
                <ScrollArea className="h-full">
                     <TabsContent value="all" className="m-0 p-4 space-y-2 h-full">
                        {folders.length === 0 && notes.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">Корзина пуста</div>
                        )}
                        {folders.map((f) => <FolderItem key={f.id} folder={f} />)}
                        {notes.map((n) => <NoteItem key={n.id} note={n} />)}
                     </TabsContent>
                     <TabsContent value="folders" className="m-0 p-4 space-y-2 h-full">
                        {folders.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">Нет удаленных папок</div>
                        )}
                        {folders.map((f) => <FolderItem key={f.id} folder={f} />)}
                     </TabsContent>
                     <TabsContent value="notes" className="m-0 p-4 space-y-2 h-full">
                        {notes.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">Нет удаленных заметок</div>
                        )}
                        {notes.map((n) => <NoteItem key={n.id} note={n} />)}
                     </TabsContent>
                </ScrollArea>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
