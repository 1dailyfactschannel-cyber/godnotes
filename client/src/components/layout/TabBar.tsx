import { X, FileText, RefreshCw, Check } from 'lucide-react';
import { useFileSystem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { MouseEvent, useRef, useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function TabBar() {
  const { openFiles, activeFileId, selectFile, closeFile, closeAllFiles, items, isOfflineMode, downloadAllFiles } = useFileSystem();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Scroll to active tab when it changes
  useEffect(() => {
    if (activeFileId && scrollContainerRef.current) {
      const activeTab = scrollContainerRef.current.querySelector(`[data-tab-id="${activeFileId}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeFileId]);

  const handleClose = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    closeFile(id);
  };

  const handleAuxClick = (e: MouseEvent, id: string) => {
    // Middle click to close
    if (e.button === 1) {
      e.stopPropagation();
      closeFile(id);
    }
  };

  const handleSync = async () => {
    if (isOfflineMode) return;
    
    setIsSyncing(true);
    setIsSynced(false);
    try {
      await downloadAllFiles();
      setIsSynced(true);
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex w-full h-10 bg-muted/30 border-b border-border">
      <div 
        ref={scrollContainerRef}
        className="flex flex-1 overflow-x-auto no-scrollbar items-end h-full"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            scrollContainerRef.current!.scrollLeft += e.deltaY;
          }
        }}
      >
        {openFiles.map((fileId) => {
          const file = items.find(i => i.id === fileId);
          if (!file) return null; // Should check if file exists, maybe was deleted

          const isActive = fileId === activeFileId;

          return (
            <div
              key={fileId}
              data-tab-id={fileId}
              onClick={() => selectFile(fileId)}
              onAuxClick={(e) => handleAuxClick(e, fileId)}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] h-9 text-sm cursor-pointer select-none border-r border-border/40 transition-colors",
                isActive 
                  ? "bg-background text-foreground border-t-2 border-t-primary border-b-0 rounded-t-sm" 
                  : "bg-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              title={file.name}
            >
              <FileText className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "opacity-70")} />
              <span className="truncate flex-1 text-xs">{file.name}</span>
              <div
                onClick={(e) => handleClose(e, fileId)}
                className={cn(
                  "ml-1 p-0.5 rounded-sm hover:bg-muted-foreground/20 opacity-0 transition-opacity",
                  isActive ? "opacity-100" : "group-hover:opacity-100"
                )}
              >
                <X className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center border-l border-border/40 bg-muted/30">
        {openFiles.length > 0 && (
          <div className="flex items-center px-2 border-r border-border/40 h-full">
            <button
              onClick={closeAllFiles}
              className="p-1.5 rounded-sm hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              title="Закрыть все вкладки"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isOfflineMode && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-full rounded-none px-3 gap-2 text-muted-foreground hover:text-foreground border-r border-border/40 font-normal",
              isSynced && "text-emerald-500 hover:text-emerald-600"
            )}
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : isSynced ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">
              {isSyncing ? 'Синхронизация...' : isSynced ? 'Синхронизировано' : 'Синхронизация'}
            </span>
          </Button>
        )}
        
        <div className="flex items-center justify-center px-3 h-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-muted/30 transition-colors cursor-help",
                  isOfflineMode 
                    ? "bg-stone-500 ring-stone-500/30" 
                    : "bg-emerald-500 ring-emerald-500/30"
                )} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{isOfflineMode ? "Офлайн режим" : "Синхронизация включена"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
