import { apiRequest } from './api';
import type { FileSystemItem } from './data-store';

export async function searchGlobalUtility(
  query: string,
  get: () => { items: FileSystemItem[]; isOfflineMode: boolean }
): Promise<FileSystemItem[]> {
  if (!query) return [];

  // Client-side search
  const localResults = get().items.filter(i =>
    i.type === 'file' && !i.tags?.some(t => t.startsWith('deleted:')) &&
    (i.name.toLowerCase().includes(query.toLowerCase()) ||
      (i.content && i.content.toLowerCase().includes(query.toLowerCase())))
  );

  if (get().isOfflineMode) {
    return localResults;
  }

  try {
    const notes = await apiRequest('GET', '/notes');
    const matched = notes
      .filter((n: any) => n.content && n.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    const serverItems: FileSystemItem[] = matched.map((n: any) => ({
      id: n.id,
      name: n.title,
      type: 'file',
      parentId: n.folderId || null,
      content: n.content,
      createdAt: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
      isFavorite: !!n.isFavorite,
      tags: n.tags || [],
    }));

    const serverIds = new Set(serverItems.map(i => i.id));
    const filteredLocal = localResults.filter(i => !serverIds.has(i.id));

    return [...serverItems, ...filteredLocal];
  } catch (e) {
    return localResults;
  }
}