import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileSystem, FileSystemItem } from "@/lib/mock-fs";
import { Loader2, History, RotateCcw, Plus } from "lucide-react";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

interface VersionHistoryDialogProps {
  fileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({ fileId, open, onOpenChange }: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<FileSystemItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<FileSystemItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { getVersions, restoreVersion, createVersion } = useFileSystem();
  const { toast } = useToast();

  const loadVersions = async () => {
    setLoading(true);
    try {
      const list = await getVersions(fileId);
      setVersions(list);
      if (list.length > 0) {
        setSelectedVersion(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, fileId]);

  const handleCreateVersion = async () => {
    setCreating(true);
    try {
      await createVersion(fileId);
      toast({ title: "Версия создана", description: "Текущее состояние сохранено в истории." });
      await loadVersions();
    } catch (e) {
      toast({ title: "Ошибка", description: "Не удалось создать версию.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion || !selectedVersion.content) return;
    
    try {
      await restoreVersion(fileId, selectedVersion.content);
      toast({ title: "Версия восстановлена", description: "Содержимое заметки обновлено." });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Ошибка", description: "Не удалось восстановить версию.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История версий
          </DialogTitle>
          <DialogDescription>
            Просмотр и восстановление предыдущих версий заметки.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden border-t border-border mt-2">
          {/* Sidebar */}
          <div className="w-64 border-r border-border flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
                <Button 
                    className="w-full" 
                    onClick={handleCreateVersion} 
                    disabled={creating || loading}
                    size="sm"
                >
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Создать версию
                </Button>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Нет сохраненных версий
                </div>
              ) : (
                <div className="flex flex-col">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => setSelectedVersion(version)}
                      className={`
                        text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent/50
                        ${selectedVersion?.id === version.id ? 'bg-accent text-accent-foreground' : ''}
                      `}
                    >
                      <div className="font-medium text-sm">
                        {format(version.createdAt, 'd MMM yyyy, HH:mm', { locale: ru })}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {version.name.replace(/\(v\..*\)/, '')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col bg-background">
            <div className="flex-1 overflow-auto p-6 font-mono text-sm whitespace-pre-wrap">
               {selectedVersion ? (
                   selectedVersion.content || <span className="text-muted-foreground italic">Пустое содержимое</span>
               ) : (
                   <div className="h-full flex items-center justify-center text-muted-foreground">
                       Выберите версию для просмотра
                   </div>
               )}
            </div>
            
            {selectedVersion && (
                <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/10">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button onClick={handleRestore} variant="default">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Восстановить эту версию
                    </Button>
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
