import { X, FileText } from 'lucide-react';
import { useFileSystem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { MouseEvent, useRef, useEffect } from 'react';

export function TabBar() {
  const { openFiles, activeFileId, selectFile, closeFile, closeAllFiles, items } = useFileSystem();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to active tab when it changes
  useEffect(() => {
    if (activeFileId && scrollContainerRef.current) {
      const activeTab = scrollContainerRef.current.querySelector(`[data-tab-id="${activeFileId}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeFileId]);

  if (openFiles.length === 0) return null;

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
      <div className="flex items-center px-2 border-l border-border/40 bg-muted/30">
        <button
          onClick={closeAllFiles}
          className="p-1.5 rounded-sm hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
          title="Закрыть все вкладки"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
