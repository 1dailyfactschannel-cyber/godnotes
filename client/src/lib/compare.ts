import type { FileSystemItem } from './data-store';

// Custom equality function to ignore 'content' changes
export function compareItems(prev: FileSystemItem[], next: FileSystemItem[]) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    
    if (a === b) continue;
    
    // Check all properties except content
    if (a.id !== b.id || 
        a.name !== b.name || 
        a.type !== b.type || 
        a.parentId !== b.parentId || 
        a.isPinned !== b.isPinned || 
        a.isFavorite !== b.isFavorite || 
        a.createdAt !== b.createdAt ||
        a.updatedAt !== b.updatedAt ||
        a.isPending !== b.isPending) {
      return false;
    }
    
    // Deep compare tags if needed
    if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) return false;
  }
  
  return true;
}