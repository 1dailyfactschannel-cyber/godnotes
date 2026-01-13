import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { FileTree } from '@/components/sidebar/FileTree';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Search, Hash, ChevronRight } from 'lucide-react';
import { useFileSystem } from '@/lib/mock-fs';

export default function AppLayout() {
  const { items, searchQuery, setSearchQuery, selectFile, activeFileId } = useFileSystem();

  const filteredItems = searchQuery 
    ? items.filter(i => i.type === 'file' && i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Breadcrumbs Calculation
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
    <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
      {/* Top Title Bar (Windows Style) */}
      <div className="h-9 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-3 select-none shrink-0 drag-region">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-default">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center text-xs text-muted-foreground ml-4 font-medium">
             <span className="text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer">Vault</span>
             {breadcrumbs.map((item, index) => (
                <div key={item.id} className="flex items-center">
                   <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground/40" />
                   <span className={index === breadcrumbs.length - 1 ? "text-foreground" : "hover:text-foreground transition-colors cursor-pointer"}>
                      {item.name}
                   </span>
                </div>
             ))}
          </div>
        </div>
        
        <div className="text-[10px] text-muted-foreground/50 font-mono">
           obsidian-clone-v1.0.0
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar/50 border-r border-sidebar-border">
            <div className="h-full flex flex-col">
              {/* Search Bar */}
              <div className="p-2 border-b border-sidebar-border/30">
                <div className="relative group">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Type to search..." 
                    className="w-full bg-sidebar-accent/30 hover:bg-sidebar-accent/50 focus:bg-sidebar-accent border border-transparent focus:border-sidebar-border rounded-md py-1.5 pl-8 pr-3 text-xs text-sidebar-foreground focus:outline-none transition-all placeholder:text-muted-foreground/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {searchQuery ? (
                 <div className="flex-1 overflow-y-auto p-2">
                    <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wider">Search Results</div>
                    {filteredItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground px-2 py-4 text-center italic opacity-50">No results found</div>
                    ) : (
                      filteredItems.map(item => (
                        <div 
                          key={item.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-sidebar-accent/50 cursor-pointer text-sm text-sidebar-foreground group"
                          onClick={() => {
                            selectFile(item.id);
                            setSearchQuery(''); // Clear search on select
                          }}
                        >
                          <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="truncate group-hover:text-foreground transition-colors">{item.name}</span>
                        </div>
                      ))
                    )}
                 </div>
              ) : (
                <FileTree />
              )}
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="bg-sidebar-border hover:bg-primary transition-colors w-[1px]" />
          
          <ResizablePanel defaultSize={80}>
            <TiptapEditor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-sidebar/80 border-t border-sidebar-border flex items-center justify-between px-3 text-[10px] text-muted-foreground select-none shrink-0 backdrop-blur-sm">
         <div className="flex items-center gap-4">
            <span className="hover:text-foreground cursor-pointer">Ln 1, Col 1</span>
            <span className="hover:text-foreground cursor-pointer">{breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1].content?.length || 0) : 0} characters</span>
         </div>
         <div className="flex items-center gap-4">
           <span className="hover:text-foreground cursor-pointer">Spaces: 2</span>
           <span className="hover:text-foreground cursor-pointer">UTF-8</span>
         </div>
      </div>
    </div>
  );
}
