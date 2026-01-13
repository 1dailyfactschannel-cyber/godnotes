import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { FileTree } from '@/components/sidebar/FileTree';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Search, Hash, ChevronRight, Minimize2, Square, X } from 'lucide-react';
import { useFileSystem } from '@/lib/mock-fs';

export default function AppLayout() {
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId } = useFileSystem();

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

  return (
    <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col border border-sidebar-border">
      {/* Windows Title Bar */}
      <div className="h-8 bg-[#1e1e1e] flex items-center justify-between select-none shrink-0 drag-region">
        <div className="flex items-center h-full">
           <div className="px-3 flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
                 <div className="w-2 h-2 bg-background rotate-45" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">Obsidian</span>
           </div>
           
           <div className="flex items-center text-[11px] text-muted-foreground/60 ml-2 border-l border-white/5 pl-4">
              <span className="hover:text-foreground transition-colors cursor-pointer">Vault</span>
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

      <div className="flex-1 overflow-hidden bg-[#161616]">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar border-r border-sidebar-border/50">
            <div className="h-full flex flex-col">
              <div className="p-2">
                <div className="relative group">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-full bg-[#2a2a2a] border border-transparent focus:border-primary/30 rounded py-1 pl-8 pr-3 text-xs focus:outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {searchQuery ? (
                 <div className="flex-1 overflow-y-auto p-2">
                    {filteredItems.map(item => (
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
                    ))}
                 </div>
              ) : (
                <FileTree />
              )}
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="bg-transparent hover:bg-primary/20 w-1 transition-colors" />
          
          <ResizablePanel defaultSize={80}>
            <TiptapEditor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* Windows Status Bar */}
      <div className="h-6 bg-[#1e1e1e] border-t border-white/5 flex items-center justify-between px-3 text-[10px] text-muted-foreground/60 select-none shrink-0">
         <div className="flex items-center gap-4">
            <span className="hover:text-foreground cursor-pointer transition-colors">Ln 1, Col 1</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">{breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1].content?.length || 0) : 0} chars</span>
         </div>
         <div className="flex items-center gap-4 uppercase tracking-tighter">
           <span className="hover:text-foreground cursor-pointer">Spaces: 2</span>
           <span className="hover:text-foreground cursor-pointer">UTF-8</span>
         </div>
      </div>
    </div>
  );
}
